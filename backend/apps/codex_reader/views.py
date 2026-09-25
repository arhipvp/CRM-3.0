"""A deliberately separate, read-only interface for Codex deal research."""

from __future__ import annotations

import base64
import email
import hashlib
import hmac
import imaplib
import json
import mimetypes
import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

from apps.chat.models import ChatMessage
from apps.common.drive import (
    DriveError,
    build_drive_file_tree_map,
    download_drive_file,
)
from apps.deals.history_utils import HISTORY_LOG_LIMIT, get_related_audit_logs
from apps.deals.models import Deal, DealEvent, Quote
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.mailboxes.models import Mailbox
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.conf import settings
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CodexReadKey

PAGE_SIZE = 50
MAX_PAGE_SIZE = 100
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_RESPONSE_TEXT = 20000
MAX_FILES = 5000
MAX_PASSPORT_BYTES = 5 * 1024 * 1024
SECTIONS = {
    "client",
    "policies",
    "quotes",
    "notes",
    "tasks",
    "history",
    "finances",
    "chat",
    "mailbox",
}


def _serialize_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (list, dict)):
        return value
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _model_data(instance, *, exclude=(), max_text=MAX_RESPONSE_TEXT):
    data = {}
    truncated_fields = []
    for field in instance._meta.concrete_fields:
        if field.name in exclude:
            continue
        value = getattr(instance, field.attname)
        if max_text is not None and isinstance(value, str) and len(value) > max_text:
            value = value[:max_text]
            truncated_fields.append(field.name)
        elif max_text is not None and isinstance(value, (dict, list)):
            encoded = json.dumps(value, ensure_ascii=False, default=str)
            if len(encoded) > max_text:
                value = encoded[:max_text]
                truncated_fields.append(field.name)
        data[field.name] = _serialize_value(value)
    if truncated_fields:
        data["_truncated_fields"] = truncated_fields
    return data


def _page(request, queryset_or_list):
    try:
        page = max(1, int(request.query_params.get("page", "1")))
        size = max(
            1, min(MAX_PAGE_SIZE, int(request.query_params.get("page_size", PAGE_SIZE)))
        )
    except ValueError:
        return Response({"detail": "Invalid pagination."}, status=400)
    count = (
        len(queryset_or_list)
        if isinstance(queryset_or_list, list)
        else queryset_or_list.count()
    )
    offset = (page - 1) * size
    items = list(queryset_or_list[offset : offset + size])

    def page_url(number):
        if number < 1 or (number - 1) * size >= count:
            return None
        query = request.query_params.copy()
        query["page"] = number
        query["page_size"] = size
        return request.build_absolute_uri(f"{request.path}?{query.urlencode()}")

    return {
        "count": count,
        "next": page_url(page + 1),
        "previous": page_url(page - 1),
        "results": items,
    }


def _deal(deal_id):
    return get_object_or_404(Deal.objects.select_related("client"), pk=deal_id)


class CodexReadView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            self.permission_denied(request, message="Valid Codex read key required.")
        token = authorization[7:]
        parts = token.split("_", 2)
        if len(parts) != 3 or parts[0] != "crm3" or len(token) > 200:
            self.permission_denied(request, message="Valid Codex read key required.")
        key = CodexReadKey.objects.filter(
            prefix=parts[1], revoked_at__isnull=True
        ).first()
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        if key is None or not hmac.compare_digest(key.token_hash, digest):
            self.permission_denied(request, message="Valid Codex read key required.")


class DealListView(CodexReadView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) > 200:
            return Response(
                {"detail": "q must contain 1 to 200 characters."}, status=400
            )
        match = re.search(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
            query,
        )
        search_filter = (
            Q(title__icontains=query)
            | Q(client__name__icontains=query)
            | Q(client__phone__icontains=query)
            | Q(client__email__icontains=query)
        )
        if match:
            search_filter |= Q(pk=match.group())
        deals = (
            Deal.objects.select_related("client")
            .filter(search_filter)
            .order_by("-created_at")
            .distinct()
        )
        page = _page(request, deals)
        if isinstance(page, Response):
            return page
        page["results"] = [
            {
                "id": str(deal.id),
                "title": deal.title,
                "status": deal.status,
                "client": {"id": str(deal.client_id), "name": deal.client.name},
                "created_at": deal.created_at.isoformat(),
                "updated_at": deal.updated_at.isoformat(),
            }
            for deal in page["results"]
        ]
        return Response(page)


class DealDetailView(CodexReadView):
    def get(self, request, deal_id):
        deal = _deal(deal_id)
        data = _model_data(deal)
        data["client_name"] = deal.client.name
        data["sections"] = sorted(SECTIONS)
        return Response(data)


class DealPassportView(CodexReadView):
    """One bounded, source-preserving snapshot for insurance research."""

    def get(self, request, deal_id):
        deal = _deal(deal_id)
        policies = Policy.objects.filter(deal=deal).select_related(
            "insurance_company", "insurance_type", "mortgage_bank", "client"
        )
        quotes = Quote.objects.filter(deal=deal).select_related(
            "insurance_company", "insurance_type"
        )

        def named_record(record):
            item = _model_data(record, max_text=None)
            item["insurance_company_name"] = (
                record.insurance_company.name if record.insurance_company else None
            )
            item["insurance_type_name"] = (
                record.insurance_type.name if record.insurance_type else None
            )
            return item

        policy_items = []
        for policy in policies:
            item = named_record(policy)
            item["mortgage_bank_name"] = (
                policy.mortgage_bank.name if policy.mortgage_bank else None
            )
            item["client_name"] = policy.client.name if policy.client else None
            policy_items.append(item)

        warnings = []
        files_status = "ok"
        try:
            files = _catalog(deal)
            for item in files:
                item["download_url"] = request.build_absolute_uri(
                    f"/api/v1/codex/deals/{deal.id}/files/{item['id']}/download/"
                )
        except DriveError:
            files = []
            files_status = "unavailable"
            warnings.append("Drive is unavailable; file catalog is incomplete.")
        except ValueError:
            files = []
            files_status = "too_large"
            warnings.append("File catalog exceeds limit; files cannot be listed.")

        payload = {
            "schema_version": 1,
            "generated_at": timezone.now().isoformat(),
            "deal": _model_data(deal, max_text=None),
            "client": _model_data(deal.client, max_text=None),
            "policies": policy_items,
            "quotes": [named_record(quote) for quote in quotes],
            "notes": [
                _model_data(note, max_text=None)
                for note in Note.objects.filter(deal=deal)
            ],
            "files": {"status": files_status, "items": files},
            "warnings": warnings,
        }
        if (
            len(json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"))
            > MAX_PASSPORT_BYTES
        ):
            return Response(
                {
                    "code": "passport_too_large",
                    "detail": "Passport exceeds 5 MiB limit; use paginated sections.",
                },
                status=413,
            )
        return Response(payload)


class DealSectionView(CodexReadView):
    def get(self, request, deal_id, section):
        deal = _deal(deal_id)
        if section not in SECTIONS:
            raise Http404
        if section == "client":
            return Response(_model_data(deal.client))
        if section == "mailbox":
            return self._mailbox(request, deal)

        if section == "policies":
            records = Policy.objects.filter(deal=deal).select_related(
                "insurance_company", "insurance_type", "client"
            )
        elif section == "quotes":
            records = Quote.objects.filter(deal=deal).select_related(
                "insurance_company", "insurance_type"
            )
        elif section == "notes":
            records = Note.objects.filter(deal=deal)
        elif section == "tasks":
            records = Task.objects.filter(deal=deal)
        elif section == "history":
            kind = request.query_params.get("kind", "events")
            if kind == "events":
                records = DealEvent.objects.filter(deal=deal)
            elif kind == "audit":
                records = get_related_audit_logs(deal)
            else:
                return Response({"detail": "kind must be events or audit."}, status=400)
        elif section == "finances":
            kind = request.query_params.get("kind", "payments")
            payments = Payment.objects.filter(
                Q(deal=deal) | Q(policy__deal=deal)
            ).distinct()
            if kind == "payments":
                records = payments
            elif kind == "records":
                records = FinancialRecord.objects.filter(payment__in=payments)
            else:
                return Response(
                    {"detail": "kind must be payments or records."}, status=400
                )
        else:
            records = ChatMessage.objects.filter(deal=deal)

        page = _page(request, records)
        if isinstance(page, Response):
            return page
        items = []
        for record in page["results"]:
            item = _model_data(record)
            if section in ("policies", "quotes"):
                item["insurance_company_name"] = (
                    record.insurance_company.name if record.insurance_company else None
                )
                item["insurance_type_name"] = (
                    record.insurance_type.name if record.insurance_type else None
                )
            if section == "policies":
                item["client_name"] = record.client.name if record.client else None
            items.append(item)
        page["results"] = items
        if section == "history" and request.query_params.get("kind") == "audit":
            page["capped_at"] = HISTORY_LOG_LIMIT
        return Response(page)

    def _mailbox(self, request, deal):
        from apps.mailboxes.mailcow_client import MailcowError
        from apps.mailboxes.services import _decode_header_value, _imap_login

        mailbox = Mailbox.objects.filter(deal=deal).first()
        if mailbox is None:
            return Response(
                {
                    "email": None,
                    "recent_limit": 100,
                    "messages": {
                        "count": 0,
                        "next": None,
                        "previous": None,
                        "results": [],
                    },
                }
            )
        host = getattr(settings, "MAILCOW_IMAP_HOST", "")
        master_user = getattr(settings, "MAILCOW_IMAP_MASTER_USER", "")
        master_pass = getattr(settings, "MAILCOW_IMAP_MASTER_PASS", "")
        if not all((host, master_user, master_pass)):
            return Response({"detail": "Mailbox is unavailable."}, status=502)
        try:
            with imaplib.IMAP4_SSL(host, int(settings.MAILCOW_IMAP_PORT)) as imap:
                _imap_login(imap, mailbox.email, master_user, master_pass)
                result, _ = imap.select("INBOX", readonly=True)
                if result != "OK":
                    raise MailcowError("Cannot select mailbox")
                result, uid_data = imap.uid("search", None, "ALL")
                if result != "OK":
                    raise MailcowError("Cannot list mailbox")
                uids = ((uid_data[0] if uid_data else b"") or b"").split()[-100:]
                messages = []
                for uid in reversed(uids):
                    result, data = imap.uid("fetch", uid, "(BODY.PEEK[HEADER])")
                    if result != "OK" or not data:
                        continue
                    raw = b"".join(part[1] for part in data if isinstance(part, tuple))
                    if not raw:
                        continue
                    message = email.message_from_bytes(raw)
                    messages.append(
                        {
                            "id": uid.decode("ascii"),
                            "subject": _decode_header_value(message.get("Subject")),
                            "from": _decode_header_value(message.get("From")),
                            "date": _decode_header_value(message.get("Date")),
                        }
                    )
        except (OSError, MailcowError, imaplib.IMAP4.error):
            return Response({"detail": "Mailbox is unavailable."}, status=502)
        page = _page(request, messages)
        if isinstance(page, Response):
            return page
        return Response({"email": mailbox.email, "recent_limit": 100, "messages": page})


def _opaque_drive_id(drive_id):
    return "d_" + base64.urlsafe_b64encode(drive_id.encode("utf-8")).decode(
        "ascii"
    ).rstrip("=")


def _catalog(deal):
    """Enumerate only file identities reached from this deal's explicit roots."""
    results = []
    seen = set()
    entries_by_id = {}
    for document in Document.objects.filter(deal=deal):
        if not document.file:
            continue
        file_id = f"l_{document.id}"
        entry = {
            "id": file_id,
            "name": document.title or Path(document.file.name).name,
            "mime_type": document.mime_type
            or mimetypes.guess_type(document.file.name)[0]
            or "application/octet-stream",
            "size": document.file_size or None,
            "source": "deal_document",
            "source_id": str(document.id),
        }
        results.append(entry)
        entries_by_id[file_id] = entry
        seen.add(file_id)
        if len(results) >= MAX_FILES:
            raise ValueError("File catalog is too large.")

    roots = [deal.drive_folder_id, deal.client.drive_folder_id]
    authorized_drive_ids = set()
    roots.extend(
        Policy.objects.filter(deal=deal)
        .exclude(drive_folder_id__isnull=True)
        .exclude(drive_folder_id="")
        .values_list("drive_folder_id", flat=True)
    )
    for root in dict.fromkeys(root for root in roots if root):
        tree = build_drive_file_tree_map(root)
        authorized_drive_ids.update(
            item["id"] for item in tree.values() if not item["is_folder"]
        )
        for item in tree.values():
            if item["is_folder"]:
                continue
            file_id = _opaque_drive_id(item["id"])
            if file_id in seen:
                continue
            entry = {
                "id": file_id,
                "name": item["name"],
                "mime_type": item["mime_type"] or "application/octet-stream",
                "size": item["size"],
                "source": "drive_folder",
                "source_id": item["id"],
            }
            results.append(entry)
            entries_by_id[file_id] = entry
            seen.add(file_id)
            if len(results) >= MAX_FILES:
                raise ValueError("File catalog is too large.")

    for note in Note.objects.filter(deal=deal):
        for attachment in note.attachments or []:
            if not isinstance(attachment, dict) or not attachment.get("id"):
                continue
            if str(attachment["id"]) not in authorized_drive_ids:
                continue
            file_id = _opaque_drive_id(str(attachment["id"]))
            if file_id in seen:
                entries_by_id[file_id].setdefault("note_ids", []).append(str(note.id))
                continue
            results.append(
                {
                    "id": file_id,
                    "name": str(attachment.get("name") or "attachment"),
                    "mime_type": str(
                        attachment.get("mime_type") or "application/octet-stream"
                    ),
                    "size": attachment.get("size"),
                    "source": "note_attachment",
                    "source_id": str(note.id),
                }
            )
            seen.add(file_id)
            if len(results) >= MAX_FILES:
                raise ValueError("File catalog is too large.")
    return results


class DealFilesView(CodexReadView):
    def get(self, request, deal_id):
        deal = _deal(deal_id)
        try:
            files = _catalog(deal)
        except DriveError:
            return Response({"detail": "Drive is unavailable."}, status=502)
        except ValueError:
            return Response({"detail": "File catalog exceeds limit."}, status=413)
        page = _page(request, files)
        if isinstance(page, Response):
            return page
        for item in page["results"]:
            item["download_url"] = request.build_absolute_uri(
                f"/api/v1/codex/deals/{deal.id}/files/{item['id']}/download/"
            )
        return Response(page)


class DealFileDownloadView(CodexReadView):
    def get(self, request, deal_id, file_id):
        deal = _deal(deal_id)
        try:
            selected = next(
                (item for item in _catalog(deal) if item["id"] == file_id), None
            )
        except DriveError:
            return Response({"detail": "Drive is unavailable."}, status=502)
        except ValueError:
            return Response({"detail": "File catalog exceeds limit."}, status=413)
        if selected is None:
            raise Http404
        size = selected["size"]
        if size is not None and int(size) > MAX_FILE_BYTES:
            return Response({"detail": "File exceeds 25 MB limit."}, status=413)
        if file_id.startswith("l_"):
            document = get_object_or_404(
                Document.objects.filter(deal=deal), pk=file_id[2:]
            )
            try:
                if document.file.size > MAX_FILE_BYTES:
                    return Response({"detail": "File exceeds 25 MB limit."}, status=413)
                content = document.file.open("rb")
            except (OSError, ValueError):
                return Response({"detail": "File is unavailable."}, status=502)
            return FileResponse(content, as_attachment=True, filename=selected["name"])
        if not file_id.startswith("d_"):
            raise Http404
        try:
            raw = file_id[2:]
            drive_id = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode(
                "utf-8"
            )
        except (ValueError, UnicodeDecodeError):
            raise Http404
        if _opaque_drive_id(drive_id) != file_id:
            raise Http404
        try:
            content = download_drive_file(drive_id)
        except DriveError:
            return Response({"detail": "File is unavailable."}, status=502)
        if len(content) > MAX_FILE_BYTES:
            return Response({"detail": "File exceeds 25 MB limit."}, status=413)
        response = HttpResponse(content, content_type=selected["mime_type"])
        safe_name = quote(selected["name"], safe="")
        response["Content-Disposition"] = f"attachment; filename*=UTF-8''{safe_name}"
        return response


class DealMailboxMessageView(CodexReadView):
    def get(self, request, deal_id, message_id):
        from apps.mailboxes.mailcow_client import MailcowError
        from apps.mailboxes.services import (
            _decode_header_value,
            _extract_email_payload,
            _imap_login,
        )

        deal = _deal(deal_id)
        mailbox = Mailbox.objects.filter(deal=deal).first()
        if mailbox is None or not message_id.isascii() or not message_id.isdigit():
            raise Http404
        host = getattr(settings, "MAILCOW_IMAP_HOST", "")
        master_user = getattr(settings, "MAILCOW_IMAP_MASTER_USER", "")
        master_pass = getattr(settings, "MAILCOW_IMAP_MASTER_PASS", "")
        if not all((host, master_user, master_pass)):
            return Response({"detail": "Mailbox is unavailable."}, status=502)
        try:
            with imaplib.IMAP4_SSL(host, int(settings.MAILCOW_IMAP_PORT)) as imap:
                _imap_login(imap, mailbox.email, master_user, master_pass)
                imap.select("INBOX", readonly=True)
                result, data = imap.uid("fetch", message_id.encode("ascii"), "(RFC822)")
                if result != "OK" or not data:
                    raise Http404
                raw = b"".join(part[1] for part in data if isinstance(part, tuple))
                if not raw:
                    raise Http404
                message = email.message_from_bytes(raw)
                body, _ = _extract_email_payload(message)
                return Response(
                    {
                        "id": message_id,
                        "subject": _decode_header_value(message.get("Subject")),
                        "from": _decode_header_value(message.get("From")),
                        "date": _decode_header_value(message.get("Date")),
                        "body": body[:MAX_RESPONSE_TEXT],
                        "truncated": len(body) > MAX_RESPONSE_TEXT,
                    }
                )
        except (OSError, MailcowError, imaplib.IMAP4.error):
            return Response({"detail": "Mailbox is unavailable."}, status=502)
