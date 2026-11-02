from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from oauth2_provider.models import get_access_token_model, get_refresh_token_model

from ...contracts import SCOPES, default_scopes
from ...models import McpAccessGrant


class Command(BaseCommand):
    help = "Explicitly grant or revoke MCP access for one existing CRM user."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--revoke", action="store_true")
        parser.add_argument("--scopes", nargs="+", choices=list(SCOPES))

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.get(username=options["username"])
        except get_user_model().DoesNotExist as exc:
            raise CommandError("No such CRM user; no user was created.") from exc
        if not user.is_active and not options["revoke"]:
            raise CommandError("Cannot grant MCP access to an inactive user.")
        grant, _ = McpAccessGrant.objects.get_or_create(user=user)
        grant.enabled = not options["revoke"]
        if options["scopes"] is not None:
            grant.scopes = options["scopes"]
        elif not options["revoke"]:
            grant.scopes = default_scopes()
        grant.full_clean()
        grant.save()
        if options["revoke"]:
            get_refresh_token_model().objects.filter(
                user=user, resource=[settings.MCP_PUBLIC_URL]
            ).delete()
            get_access_token_model().objects.filter(
                user=user, resource=[settings.MCP_PUBLIC_URL]
            ).delete()
        self.stdout.write(
            f"MCP access {'disabled' if options['revoke'] else 'enabled'} for user ID {user.pk}."
        )
