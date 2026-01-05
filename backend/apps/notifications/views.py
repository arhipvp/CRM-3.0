from django.conf import settings
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
