import secrets
from urllib.parse import urlsplit

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from oauth2_provider.models import get_application_model


class Command(BaseCommand):
    help = "Create a predefined ChatGPT OAuth client; print a new secret only once."

    def add_arguments(self, parser):
        parser.add_argument("--redirect-uri", required=True)
        parser.add_argument("--name", default="ChatGPT")
        parser.add_argument("--rotate-secret", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        redirect_uri = options["redirect_uri"]
        url = urlsplit(redirect_uri)
        if (
            url.scheme != "https"
            or url.hostname != "chatgpt.com"
            or url.port not in (None, 443)
            or url.username
            or url.password
            or url.fragment
            or "*" in redirect_uri
            or any(character.isspace() for character in redirect_uri)
        ):
            raise CommandError(
                "Use the exact HTTPS chatgpt.com callback shown by ChatGPT."
            )
        model = get_application_model()
        clients = model.objects.select_for_update().filter(name=options["name"])
        if clients.count() > 1:
            raise CommandError(
                "Multiple OAuth clients have this name; choose a unique name."
            )
        client = clients.first()
        created = client is None
        if created:
            client = model(name=options["name"])
        client.client_type = model.CLIENT_CONFIDENTIAL
        client.authorization_grant_type = model.GRANT_AUTHORIZATION_CODE
        client.redirect_uris = redirect_uri
        client.skip_authorization = False
        secret = None
        if created or options["rotate_secret"]:
            secret = secrets.token_urlsafe(48)
            client.client_secret = secret
        client.full_clean()
        client.save()
        self.stdout.write(f"client_id: {client.client_id}")
        if secret:
            self.stdout.write(f"client_secret: {secret}")
            self.stdout.write(
                "Store this secret securely; it will not be displayed again."
            )
        else:
            self.stdout.write(
                "Existing secret preserved. Use --rotate-secret to replace it."
            )
