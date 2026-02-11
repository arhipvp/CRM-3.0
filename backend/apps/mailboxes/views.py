from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .mailcow_client import MailcowClient, MailcowError
from .models import Mailbox
from .serializers import MailboxCreateSerializer, MailboxSerializer
from .services import (
    ensure_mailcow_domain,
    extract_quota_left,
    fetch_mailbox_messages,
    generate_mailbox_password,
)


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
            ensure_mailcow_domain(client, domain)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        password = generate_mailbox_password()
        requested_quota = int(getattr(settings, "MAILCOW_MAILBOX_QUOTA_MB", 3072))
        try:
            client.create_mailbox(
                domain,
                local_part,
                display_name,
                password,
                quota_mb=requested_quota,
            )
        except MailcowError as exc:
            exc_text = str(exc)
            quota_left = extract_quota_left(exc_text)
            if quota_left and quota_left < requested_quota:
                try:
                    client.create_mailbox(
                        domain,
                        local_part,
                        display_name,
                        password,
                        quota_mb=quota_left,
                    )
                except MailcowError as retry_exc:
                    return Response(
                        {"detail": str(retry_exc)}, status=status.HTTP_502_BAD_GATEWAY
                    )
            else:
                return Response(
                    {"detail": exc_text}, status=status.HTTP_502_BAD_GATEWAY
                )

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
            messages = fetch_mailbox_messages(mailbox.email, limit)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"items": messages})
