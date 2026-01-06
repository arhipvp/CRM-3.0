from apps.common.drive import (
    DriveError,
    DriveOperationError,
    download_drive_file,
    ensure_deal_folder,
    ensure_trash_folder,
    move_drive_file_to_folder,
)
from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def get_base_queryset(self):
        return Note.objects.with_deleted().select_related("deal")

    def _apply_deal_filter(self, queryset):
        deal_id = self.request.query_params.get("deal")
        if deal_id:
            return queryset.filter(deal_id=deal_id)
        return queryset

    def _apply_access_control(self, queryset):
        user = self.request.user
        if not user or not user.is_authenticated:
            return queryset

        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()
        if is_admin:
            return queryset

        return queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

    def get_queryset(self):
        queryset = self.get_base_queryset()
        archived_flag = self.request.query_params.get("archived")
        if archived_flag == "true":
            queryset = queryset.dead()
        else:
            queryset = queryset.alive()

        queryset = self._apply_access_control(queryset)
        return self._apply_deal_filter(queryset)

    def perform_create(self, serializer):
        user = self.request.user
        deal = serializer.validated_data.get("deal")
        self._ensure_user_can_create_note(deal)
        author = None
        author_name = serializer.validated_data.get("author_name")
        if user and user.is_authenticated:
            author = user
            full_name = (user.get_full_name() or "").strip()
            author_name = full_name or user.username
        serializer.save(author=author, author_name=author_name or "")

    def _is_deal_seller(self, user, deal):
        if not user or not user.is_authenticated or not deal:
            return False
        return bool(deal and deal.seller_id == user.id)

    def _is_deal_executor(self, user, deal):
        if not user or not user.is_authenticated or not deal:
            return False
        return deal.executor_id == user.id

    def _get_user_name_variants(self, user):
        names = set()
        if not user or not user.is_authenticated:
            return names
        full_name = (user.get_full_name() or "").strip()
        if full_name:
            names.add(full_name.casefold())
        username = (user.username or "").strip()
        if username:
            names.add(username.casefold())
        return names

    def _is_note_author(self, user, instance):
        if not user or not user.is_authenticated or not instance:
            return False
        author_id = getattr(instance, "author_id", None)
        if author_id and author_id == user.id:
            return True
        author_name = (getattr(instance, "author_name", "") or "").strip()
        if not author_name:
            return False
        return author_name.casefold() in self._get_user_name_variants(user)

    def _ensure_user_can_create_note(self, deal):
        user = self.request.user
        if not user or not user.is_authenticated or not deal:
            raise PermissionDenied(
                "Только владелец сделки (продавец) или исполнитель может создавать заметки."
            )

        if not (self._is_deal_seller(user, deal) or self._is_deal_executor(user, deal)):
            raise PermissionDenied(
                "Только владелец сделки (продавец) или исполнитель может создавать заметки."
            )

    def _can_modify(self, user, instance):
        if self._is_admin(user):
            return True
        deal = getattr(instance, "deal", None)
        if self._is_deal_seller(user, deal):
            return True
        return self._is_deal_executor(user, deal) and self._is_note_author(
            user, instance
        )

    def _move_attachments_to_trash(self, note: Note) -> None:
        attachments = note.attachments or []
        if not attachments:
            return

        deal = getattr(note, "deal", None)
        if not deal:
            return

        folder_id = getattr(deal, "drive_folder_id", None)
        if not folder_id:
            folder_id = ensure_deal_folder(deal)
        if not folder_id:
            raise DriveOperationError("Google Drive папка для сделки не найдена.")

        trash_folder_id = ensure_trash_folder(folder_id)
        for item in attachments:
            file_id = str(item.get("id") or "").strip()
            if file_id:
                move_drive_file_to_folder(file_id, trash_folder_id)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self._move_attachments_to_trash(instance)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        queryset = self.get_base_queryset()
        queryset = self._apply_access_control(queryset)
        note = get_object_or_404(queryset, pk=pk)
        note.restore()
        serializer = self.get_serializer(note)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["get"],
        url_path="attachments/(?P<file_id>[^/.]+)/download",
    )
    def download_attachment(self, request, pk=None, file_id=None):
        queryset = self.get_base_queryset()
        queryset = self._apply_access_control(queryset)
        note = get_object_or_404(queryset, pk=pk)
        attachments = note.attachments or []
        attachment = next(
            (item for item in attachments if str(item.get("id")) == str(file_id)),
            None,
        )
        if not attachment:
            return Response(
                {"detail": "Файл не найден."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            content = download_drive_file(str(file_id))
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        content_type = attachment.get("mime_type") or "application/octet-stream"
        response = HttpResponse(content, content_type=content_type)
        filename = attachment.get("name") or "attachment"
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response
