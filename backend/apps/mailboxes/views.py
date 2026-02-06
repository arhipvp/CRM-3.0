import email
import imaplib
import secrets
import string
from typing import Any

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .mailcow_client import MailcowClient, MailcowError
from .models import Mailbox
from .serializers import MailboxCreateSerializer, MailboxSerializer


def _generate_mailbox_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Mail" + "".join(secrets.choice(alphabet) for _ in range(8))


def _imap_login(
    imap: imaplib.IMAP4_SSL, mailbox_email: str, master_user: str, master_pass: str
) -> None:
    if "@" in master_user:
        master_login = master_user
    else:
        master_login = f"{master_user}@mailcow.local"
    try:
        imap.login(f"{mailbox_email}*{master_login}", master_pass)
        return
    except imaplib.IMAP4.error:
        imap.login(f"{master_login}*{mailbox_email}", master_pass)


def _fetch_messages(mailbox_email: str, limit: int) -> list[dict[str, Any]]:
    host = getattr(settings, "MAILCOW_IMAP_HOST", "")
    port = int(getattr(settings, "MAILCOW_IMAP_PORT", 993))
    master_user = getattr(settings, "MAILCOW_IMAP_MASTER_USER", "")
    master_pass = getattr(settings, "MAILCOW_IMAP_MASTER_PASS", "")
    if not host or not master_user or not master_pass:
        raise MailcowError("MAILCOW IMAP is not configured.")

    with imaplib.IMAP4_SSL(host, port) as imap:
        _imap_login(imap, mailbox_email, master_user, master_pass)
        imap.select("INBOX", readonly=True)
        status_code, data = imap.search(None, "ALL")
        if status_code != "OK" or not data:
            return []
        ids = data[0].split()
        selected_ids = ids[-limit:]
        messages: list[dict[str, Any]] = []
        for msg_id in reversed(selected_ids):
            status_code, msg_data = imap.fetch(
                msg_id, "(BODY.PEEK[HEADER] BODY.PEEK[TEXT])"
            )
            if status_code != "OK" or not msg_data:
                continue
            raw = b""
            for part in msg_data:
                if isinstance(part, tuple):
                    raw += part[1]
            message = email.message_from_bytes(raw)
            subject = message.get("Subject", "")
            sender = message.get("From", "")
            date = message.get("Date", "")
            snippet = ""
            if message.is_multipart():
                for part in message.walk():
                    if part.get_content_type() == "text/plain":
                        payload = part.get_payload(decode=True) or b""
                        snippet = payload.decode(errors="ignore")
                        break
            else:
                payload = message.get_payload(decode=True) or b""
                snippet = payload.decode(errors="ignore")
            snippet = " ".join(snippet.strip().split())[:240]
            messages.append(
                {
                    "id": msg_id.decode("utf-8"),
                    "subject": subject,
                    "from": sender,
                    "date": date,
                    "snippet": snippet,
                }
            )
        return messages


class MailboxViewSet(viewsets.ModelViewSet):
    serializer_class = MailboxSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Mailbox.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return MailboxCreateSerializer
        return MailboxSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        local_part = serializer.validated_data["local_part"]
        display_name = serializer.validated_data.get("display_name", "")
        domain = getattr(settings, "MAILCOW_DOMAIN", "")
        if not domain:
            return Response(
                {"detail": "MAILCOW_DOMAIN is not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        email_address = f"{local_part}@{domain}".lower()
        if Mailbox.objects.filter(email=email_address).exists():
            return Response(
                {"detail": "Такой ящик уже существует."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = MailcowClient()
        try:
            client.ensure_domain(domain)
        except MailcowError as exc:
            lowered = str(exc).lower()
            if "domain" not in lowered or "exist" not in lowered:
                return Response(
                    {"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY
                )

        password = _generate_mailbox_password()
        try:
            client.create_mailbox(domain, local_part, display_name, password)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        mailbox = Mailbox.objects.create(
            user=request.user,
            email=email_address,
            local_part=local_part,
            domain=domain,
            display_name=display_name,
        )
        payload = MailboxSerializer(mailbox).data
        payload["initial_password"] = password
        return Response(payload, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        mailbox = self.get_object()
        client = MailcowClient()
        try:
            client.delete_mailbox(mailbox.email)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        mailbox.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        mailbox = self.get_object()
        limit_raw = request.query_params.get("limit", "20")
        try:
            limit = max(1, min(100, int(limit_raw)))
        except ValueError:
            limit = 20
        try:
            messages = _fetch_messages(mailbox.email, limit)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"items": messages})
