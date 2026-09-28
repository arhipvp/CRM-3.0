"""Small, key-scoped deal mailbox endpoints for insurance calculations."""

from apps.deals.models import Deal
from apps.mailboxes.mailcow_client import MailcowClient, MailcowError
from apps.mailboxes.models import Mailbox
from apps.mailboxes.services import (
    build_mailbox_local_part,
    ensure_mailcow_domain,
    extract_quota_left,
    generate_mailbox_password,
)
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import Http404
from rest_framework.response import Response

from .views import CodexReadView
from .write_views import CodexWriteView


def _mailbox_response(deal_id, mailbox, *, created=False):
    return {
        "deal_id": str(deal_id),
        "email": mailbox.email if mailbox else None,
        "created": created,
    }


class DealMailboxAddressView(CodexReadView):
    def get(self, request, deal_id):
        if not Deal.objects.filter(pk=deal_id).exists():
            raise Http404
        mailbox = Mailbox.objects.filter(deal_id=deal_id).only("email").first()
        return Response(_mailbox_response(deal_id, mailbox))


class DealMailboxEnsureView(CodexWriteView):
    def post(self, request, deal_id):
        if request.data:
            return Response({"detail": "Request body must be empty."}, status=400)
        with transaction.atomic():
            # Serialize Codex requests for the same deal before checking Mailcow.
            deal = (
                Deal.objects.select_for_update()
                .select_related("client")
                .filter(pk=deal_id)
                .first()
            )
            if deal is None:
                raise Http404
            mailbox = Mailbox.objects.filter(deal=deal).first()
            if mailbox:
                return Response(_mailbox_response(deal_id, mailbox))

            owner = deal.seller or deal.executor
            if owner is None:
                return Response(
                    {"detail": "Deal has no seller or executor for mailbox ownership."},
                    status=409,
                )
            domain = getattr(settings, "MAILCOW_DOMAIN", "").strip()
            if not domain:
                return Response(
                    {"detail": "MAILCOW_DOMAIN is not configured."}, status=503
                )
            local_part = build_mailbox_local_part(deal.client.name, domain)
            email_address = f"{local_part}@{domain}".lower()
            try:
                client = MailcowClient()
                ensure_mailcow_domain(client, domain)
                password = generate_mailbox_password()
                requested_quota = int(
                    getattr(settings, "MAILCOW_MAILBOX_QUOTA_MB", 3072)
                )
                try:
                    client.create_mailbox(
                        domain,
                        local_part,
                        deal.title,
                        password,
                        quota_mb=requested_quota,
                    )
                except MailcowError as exc:
                    quota_left = extract_quota_left(str(exc))
                    if not quota_left or quota_left >= requested_quota:
                        raise
                    client.create_mailbox(
                        domain,
                        local_part,
                        deal.title,
                        password,
                        quota_mb=quota_left,
                    )
            except MailcowError:
                # Mailcow errors can contain upstream payloads; never return them.
                return Response(
                    {"detail": "Mailcow mailbox creation failed."}, status=502
                )

            try:
                with transaction.atomic():
                    mailbox = Mailbox.objects.create(
                        user=owner,
                        deal=deal,
                        email=email_address,
                        local_part=local_part,
                        domain=domain,
                        display_name=deal.title,
                    )
            except IntegrityError:
                # Another writer may have attached a mailbox outside this API.
                mailbox = Mailbox.objects.filter(deal=deal).first()
                if not Mailbox.objects.filter(email=email_address).exists():
                    try:
                        client.delete_mailbox(email_address)
                    except MailcowError:
                        pass
                if mailbox:
                    return Response(_mailbox_response(deal_id, mailbox))
                return Response(
                    {"detail": "Mailbox address conflict; retry the request."},
                    status=409,
                )
            return Response(
                _mailbox_response(deal_id, mailbox, created=True), status=201
            )
