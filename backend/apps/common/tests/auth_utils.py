from __future__ import annotations

from typing import Mapping, MutableMapping, Union

from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class AuthenticatedAPITestCase(APITestCase):
    """Расширяет стандартный APITestCase, чтобы упростить работу с JWT."""

    client: APIClient

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.api_client = self.client
        self._token_cache: MutableMapping[str, str] = {}

    def token_for(self, user: User) -> str:
        """Возвращает участие токена для пользователя, кэшируя результат."""
        username = user.username
        token = self._token_cache.get(username)
        if token is None:
            token = str(RefreshToken.for_user(user).access_token)
            self._token_cache[username] = token
        return token

    def authenticate(self, user_or_token: Union[User, str]) -> str:
        """Устанавливает заголовок авторизации для клиента."""
        token = (
            user_or_token
            if isinstance(user_or_token, str)
            else self.token_for(user_or_token)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return token

    def clear_authentication(self) -> None:
        """Сбрасывает заголовки клиента."""
        self.client.credentials()

    def tokens_for(self, users: Mapping[str, User]) -> Mapping[str, str]:
        """Генерирует токены для множества пользователей."""
        return {name: self.token_for(user) for name, user in users.items()}
