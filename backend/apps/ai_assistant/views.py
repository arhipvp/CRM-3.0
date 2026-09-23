from __future__ import annotations

import mimetypes
import uuid
from urllib.parse import quote

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Max, Sum
from django.http import FileResponse
from django.utils.text import get_valid_filename
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AiConversation, AiDocument, AiMessage, AiRun
from .rag_services import default_model, delete_document_index, get_models
from .serializers import (
    CLASSIFICATION_FIELDS,
    conversation_payload,
    document_payload,
    message_payload,
    run_payload,
)


def _can_manage_library(user) -> bool:
    return bool(
        user.is_superuser
        or user.is_staff
        or user.username.casefold()
        == settings.INSURANCE_ASSISTANT_LIBRARY_MANAGER.casefold()
    )


def _owned_conversation(request, conversation_id):
    return AiConversation.objects.filter(id=conversation_id, owner=request.user).first()


def _scope_valid(value) -> bool:
    if not isinstance(value, list):
        return False
    for branch in value:
        if not isinstance(branch, dict):
            return False
        if not any(branch.get(field) for field in ("unclassified", "insurer")):
            return False
        if any(
            key not in {"unclassified", "insurer", "insurance_kind", "product"}
            for key in branch
        ):
            return False
    return True


def _provider_models() -> tuple[list[str], bool]:
    try:
        return get_models(), bool(settings.AI_API_KEY)
    except Exception:
        return [default_model()], False


def _catalog() -> dict:
    documents = list(AiDocument.objects.values(*CLASSIFICATION_FIELDS))
    unclassified = 0
    tree = {}
    for item in documents:
        insurer_name = item["insurer"]
        if not insurer_name:
            unclassified += 1
            continue
        insurer = tree.setdefault(
            insurer_name, {"name": insurer_name, "count": 0, "kinds": {}}
        )
        insurer["count"] += 1
        kind_name = item["insurance_kind"] or "Без вида страхования"
        kind = insurer["kinds"].setdefault(
            kind_name, {"name": kind_name, "count": 0, "products": {}}
        )
        kind["count"] += 1
        product_name = item["product"] or "Без продукта"
        product = kind["products"].setdefault(
            product_name, {"name": product_name, "count": 0}
        )
        product["count"] += 1
    insurers = []
    for insurer in tree.values():
        insurer["kinds"] = [
            {**kind, "products": list(kind["products"].values())}
            for kind in insurer["kinds"].values()
        ]
        insurers.append(insurer)
    return {
        "total": len(documents),
        "unclassified": unclassified,
        "insurers": insurers,
        "suggestions": {
            "insurers": sorted(
                {item["insurer"] for item in documents if item["insurer"]}
            ),
            "insurance_kinds": sorted(
                {item["insurance_kind"] for item in documents if item["insurance_kind"]}
            ),
            "products": sorted(
                {item["product"] for item in documents if item["product"]}
            ),
        },
    }


class ProvidersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        models, available = _provider_models()
        return Response(
            {
                "providers": [
                    {
                        "id": "polza",
                        "label": "Polza",
                        "available": available,
                        "models": models,
                        "default_model": default_model(),
                        "billing": "paid",
                    }
                ]
            }
        )


class UsageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        answers = AiMessage.objects.filter(
            conversation__owner=request.user, role="assistant", provider="polza"
        )
        aggregate = answers.aggregate(
            cost=Sum("cost_rub"),
            input=Sum("input_tokens"),
            output=Sum("output_tokens"),
            total=Sum("total_tokens"),
        )
        provider = {
            "provider": "polza",
            "requests": answers.count(),
            "cost_rub": float(aggregate["cost"] or 0),
            "input_tokens": aggregate["input"] or 0,
            "output_tokens": aggregate["output"] or 0,
            "total_tokens": aggregate["total"] or 0,
        }
        return Response(
            {
                "providers": [provider],
                "cost_rub": provider["cost_rub"],
                "requests": provider["requests"],
            }
        )


class CatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_catalog())


class ConversationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            [
                conversation_payload(item)
                for item in AiConversation.objects.filter(owner=request.user)
            ]
        )

    def post(self, request):
        title = str(request.data.get("title") or "Новый чат").strip()[:255]
        conversation = AiConversation.objects.create(
            owner=request.user, title=title, model=default_model()
        )
        return Response(conversation_payload(conversation), status=201)


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, conversation_id):
        if "provider" in request.data and request.data["provider"] != "polza":
            return Response({"detail": "В CRM доступен только Polza."}, status=400)
        model = None
        if "model" in request.data:
            model = request.data["model"]
            models, available = _provider_models()
            if not available or not isinstance(model, str) or model not in models:
                return Response({"detail": "Выбранная модель недоступна."}, status=400)
        if "scope" in request.data:
            if not _scope_valid(request.data["scope"]):
                return Response({"detail": "Некорректная область поиска."}, status=400)
        with transaction.atomic():
            conversation = (
                AiConversation.objects.select_for_update()
                .filter(id=conversation_id, owner=request.user)
                .first()
            )
            if conversation is None:
                return Response({"detail": "Чат не найден."}, status=404)
            if AiRun.objects.filter(
                conversation=conversation, status__in=AiRun.ACTIVE
            ).exists():
                return Response(
                    {"detail": "Дождитесь завершения текущего ответа."}, status=409
                )
            if model is not None:
                conversation.model = model
            if "scope" in request.data:
                conversation.scope = request.data["scope"]
            conversation.save(update_fields=["model", "scope"])
        return Response(conversation_payload(conversation))

    def delete(self, request, conversation_id):
        conversation = _owned_conversation(request, conversation_id)
        if conversation is None:
            return Response({"detail": "Чат не найден."}, status=404)
        if AiRun.objects.filter(
            conversation=conversation, status__in=AiRun.ACTIVE
        ).exists():
            return Response(
                {"detail": "Остановите ответ перед удалением чата."}, status=409
            )
        conversation.delete()
        return Response(status=204)


class ConversationMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        conversation = _owned_conversation(request, conversation_id)
        if conversation is None:
            return Response({"detail": "Чат не найден."}, status=404)
        messages = AiMessage.objects.filter(conversation=conversation).select_related(
            "answer_run"
        )
        return Response([message_payload(message) for message in messages])

    def post(self, request, conversation_id):
        content = str(request.data.get("content") or "").strip()
        client_request_id = str(request.data.get("client_request_id") or "").strip()
        if (
            not content
            or len(content) > 10000
            or not client_request_id
            or len(client_request_id) > 128
        ):
            return Response(
                {"detail": "Укажите вопрос и client_request_id."}, status=400
            )
        try:
            with transaction.atomic():
                conversation = (
                    AiConversation.objects.select_for_update()
                    .filter(id=conversation_id, owner=request.user)
                    .first()
                )
                if conversation is None:
                    return Response({"detail": "Чат не найден."}, status=404)
                previous = AiRun.objects.filter(
                    conversation=conversation, client_request_id=client_request_id
                ).first()
                if previous:
                    return Response(
                        {
                            "run_id": str(previous.id),
                            "message_id": str(previous.question_id),
                            "assistant_message_id": str(previous.answer_id),
                            "status": previous.status,
                        },
                        status=202,
                    )
                if AiRun.objects.filter(
                    conversation=conversation, status__in=AiRun.ACTIVE
                ).exists():
                    return Response(
                        {"detail": "В этом чате уже готовится ответ."}, status=409
                    )
                position = (
                    AiMessage.objects.filter(conversation=conversation).aggregate(
                        Max("position")
                    )["position__max"]
                    or 0
                ) + 1
                question = AiMessage.objects.create(
                    conversation=conversation,
                    role="user",
                    content=content,
                    position=position,
                )
                answer = AiMessage.objects.create(
                    conversation=conversation,
                    role="assistant",
                    content="",
                    position=position + 1,
                    provider="polza",
                    model=conversation.model or default_model(),
                    request_status="queued",
                )
                run = AiRun.objects.create(
                    conversation=conversation,
                    question=question,
                    answer=answer,
                    client_request_id=client_request_id,
                    model=answer.model,
                    scope=conversation.scope,
                )
                if conversation.title == "Новый чат":
                    conversation.title = content[:80]
                    conversation.save(update_fields=["title"])
        except IntegrityError:
            previous = AiRun.objects.filter(
                conversation_id=conversation_id,
                conversation__owner=request.user,
                client_request_id=client_request_id,
            ).first()
            if previous:
                return Response(
                    {
                        "run_id": str(previous.id),
                        "message_id": str(previous.question_id),
                        "assistant_message_id": str(previous.answer_id),
                        "status": previous.status,
                    },
                    status=202,
                )
            return Response({"detail": "В этом чате уже готовится ответ."}, status=409)
        return Response(
            {
                "run_id": str(run.id),
                "message_id": str(question.id),
                "assistant_message_id": str(answer.id),
                "status": run.status,
            },
            status=202,
        )


class StopRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id, run_id):
        from django.utils import timezone

        with transaction.atomic():
            run = (
                AiRun.objects.select_for_update()
                .filter(
                    id=run_id,
                    conversation_id=conversation_id,
                    conversation__owner=request.user,
                )
                .first()
            )
            if run is None:
                return Response({"detail": "Задание не найдено."}, status=404)
            if run.status == "queued":
                run.status = "stopped"
                run.stop_requested = True
                run.finished_at = timezone.now()
                run.save(
                    update_fields=[
                        "status",
                        "stop_requested",
                        "finished_at",
                        "updated_at",
                    ]
                )
                AiMessage.objects.filter(pk=run.answer_id).update(
                    request_status="stopped"
                )
            elif run.status in AiRun.ACTIVE:
                run.stop_requested = True
                run.save(update_fields=["stop_requested", "updated_at"])
        return Response(run_payload(run))


class DocumentsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        return Response([document_payload(item) for item in AiDocument.objects.all()])

    def post(self, request):
        if not _can_manage_library(request.user):
            return Response(
                {"detail": "Недостаточно прав для загрузки источников."}, status=403
            )
        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "Не переданы файлы."}, status=400)
        documents = []
        for uploaded in files:
            document = AiDocument(filename=uploaded.name)
            document.file.save(get_valid_filename(uploaded.name), uploaded, save=False)
            document.save()
            documents.append(document_payload(document))
        return Response(documents, status=201)


class DocumentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, document_id):
        if not _can_manage_library(request.user):
            return Response(
                {"detail": "Недостаточно прав для удаления источников."}, status=403
            )
        document = AiDocument.objects.filter(id=document_id).first()
        if document is None:
            return Response({"detail": "Документ не найден."}, status=404)
        if document.status == "processing":
            return Response(
                {"detail": "Дождитесь окончания обработки документа."}, status=409
            )
        delete_document_index(document.id)
        document.file.delete(save=False)
        document.delete()
        return Response(status=204)


class DocumentClassificationView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        if not _can_manage_library(request.user):
            return Response(
                {"detail": "Недостаточно прав для классификации источников."},
                status=403,
            )
        ids = request.data.get("document_ids")
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "Выберите документы."}, status=400)
        values = {
            field: str(request.data.get(field) or "").strip()
            for field in CLASSIFICATION_FIELDS
        }
        if any(not values[field] for field in ("insurer", "insurance_kind", "product")):
            return Response(
                {"detail": "Укажите страховщика, вид страхования и продукт."},
                status=400,
            )
        try:
            ids = [str(uuid.UUID(str(item))) for item in ids]
        except (ValueError, TypeError, AttributeError):
            return Response(
                {"detail": "Некорректный идентификатор документа."}, status=400
            )
        documents = list(AiDocument.objects.filter(id__in=ids))
        if len(documents) != len(set(ids)):
            return Response(
                {"detail": "Один или несколько документов не найдены."}, status=404
            )
        if any(item.insurer for item in documents):
            return Response(
                {
                    "detail": "Распределять можно только документы из папки «Нераспределено»."
                },
                status=409,
            )
        AiDocument.objects.filter(id__in=ids).update(**values)
        for document in documents:
            for key, value in values.items():
                setattr(document, key, value)
        return Response([document_payload(item) for item in documents])


class DocumentContentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        document = AiDocument.objects.filter(id=document_id).first()
        if document is None or not document.file:
            return Response({"detail": "Документ не найден."}, status=404)
        content_type = (
            mimetypes.guess_type(document.filename)[0] or "application/octet-stream"
        )
        response = FileResponse(document.file.open("rb"), content_type=content_type)
        disposition = (
            "inline"
            if content_type
            in {"application/pdf", "text/plain", "image/png", "image/jpeg"}
            else "attachment"
        )
        response["Content-Disposition"] = (
            f"{disposition}; filename*=UTF-8''{quote(document.filename)}"
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response
