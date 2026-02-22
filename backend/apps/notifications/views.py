import base64
import secrets
from io import BytesIO

from apps.common.drive import DriveError, ensure_deal_folder, upload_file_to_drive
from apps.deals.models import Deal
from apps.deals.permissions import is_admin_user
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer, NotificationSettingsSerializer
from .telegram_notifications import (
    generate_link_code,
    get_or_create_profile,
    get_or_create_settings,
)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Если пользователь не аутентифицирован, возвращаем пустой queryset
        if not self.request.user.is_authenticated:
            return Notification.objects.none()
        return Notification.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return self._build_response(request)

    def put(self, request):
        return self._update_settings(request, partial=False)

    def patch(self, request):
        return self._update_settings(request, partial=True)

    def _update_settings(self, request, partial: bool):
        settings_obj = get_or_create_settings(request.user)
        serializer = NotificationSettingsSerializer(
            settings_obj, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self._build_response(request)

    def _build_response(self, request):
        settings_obj = get_or_create_settings(request.user)
        profile = get_or_create_profile(request.user)
        bot_username = getattr(settings, "TELEGRAM_BOT_USERNAME", "").strip()
        return Response(
            {
                "settings": NotificationSettingsSerializer(settings_obj).data,
                "telegram": {
                    "linked": bool(profile.chat_id),
                    "linked_at": profile.linked_at,
                },
                "bot_username": bot_username,
            }
        )


class TelegramLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = generate_link_code(request.user)
        bot_username = getattr(settings, "TELEGRAM_BOT_USERNAME", "").strip()
        deep_link = (
            f"https://t.me/{bot_username}?start={profile.link_code}"
            if bot_username
            else ""
        )
        return Response(
            {
                "link_code": profile.link_code,
                "expires_at": profile.link_code_expires_at,
                "deep_link": deep_link or None,
                "bot_username": bot_username,
            },
            status=status.HTTP_201_CREATED,
        )


class TelegramUnlinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = get_or_create_profile(request.user)
        profile.chat_id = None
        profile.linked_at = None
        profile.link_code = ""
        profile.link_code_expires_at = None
        profile.save(
            update_fields=[
                "chat_id",
                "linked_at",
                "link_code",
                "link_code_expires_at",
            ]
        )
        return Response({"linked": False}, status=status.HTTP_200_OK)


class TelegramIntakeDriveUploadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        configured_token = str(
            getattr(settings, "TELEGRAM_INTERNAL_API_TOKEN", "")
        ).strip()
        received_token = str(
            request.headers.get("X-Telegram-Internal-Token") or ""
        ).strip()
        if not configured_token or not secrets.compare_digest(
            received_token, configured_token
        ):
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_id = str(request.data.get("user_id") or "").strip()
        deal_id = str(request.data.get("deal_id") or "").strip()
        file_name = str(request.data.get("file_name") or "").strip()
        mime_type = str(request.data.get("mime_type") or "").strip()
        content_base64 = str(request.data.get("content_base64") or "").strip()

        if not all([user_id, deal_id, file_name, content_base64]):
            return Response(
                {
                    "detail": "user_id, deal_id, file_name and content_base64 are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content = base64.b64decode(content_base64)
        except Exception:  # noqa: BLE001
            return Response(
                {"detail": "Invalid base64 content."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = get_user_model().objects.filter(id=user_id).first()
        if not user:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        deal = self._deal_queryset_for_user(user).filter(id=deal_id).first()
        if not deal:
            return Response(
                {"detail": "Deal not found or inaccessible."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            folder_id = ensure_deal_folder(deal) or deal.drive_folder_id
            if not folder_id:
                return Response(
                    {"detail": "Google Drive folder for deal is unavailable."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            drive_file = upload_file_to_drive(
                folder_id=folder_id,
                file_obj=BytesIO(content),
                file_name=file_name,
                mime_type=mime_type or "application/octet-stream",
            )
            return Response(
                {"ok": True, "file": drive_file},
                status=status.HTTP_201_CREATED,
            )
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def _deal_queryset_for_user(self, user):
        qs = Deal.objects.alive()
        if is_admin_user(user):
            return qs
        return qs.filter(
            Q(seller=user) | Q(executor=user) | Q(visible_users=user)
        ).distinct()
