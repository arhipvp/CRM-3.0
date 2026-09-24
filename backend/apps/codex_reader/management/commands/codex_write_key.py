from apps.codex_reader.models import CodexWriteKey
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Issue, list, or revoke Codex create-only API keys."

    def add_arguments(self, parser):
        subparsers = parser.add_subparsers(dest="action", required=True)
        issue = subparsers.add_parser("issue", help="Issue a new key")
        issue.add_argument("--name", required=True)
        subparsers.add_parser("list", help="List key prefixes and status")
        revoke = subparsers.add_parser("revoke", help="Revoke an existing key")
        revoke.add_argument("--prefix", required=True)

    def handle(self, *args, **options):
        action = options["action"]
        if action == "issue":
            key, token = CodexWriteKey.issue(options["name"])
            self.stdout.write(f"prefix: {key.prefix}")
            self.stdout.write(f"token: {token}")
            self.stdout.write("Store this token securely; it is shown only once.")
            return
        if action == "list":
            for key in CodexWriteKey.objects.order_by("-created_at"):
                state = "revoked" if key.revoked_at else "active"
                self.stdout.write(f"{key.prefix}\t{key.name}\t{state}")
            return
        key = CodexWriteKey.objects.filter(prefix=options["prefix"]).first()
        if key is None:
            raise CommandError("Unknown key prefix.")
        if key.revoked_at is None:
            key.revoke()
        self.stdout.write(f"Revoked {key.prefix}.")
