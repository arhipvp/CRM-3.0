from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from itertools import cycle, product

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.deals.models import (
    Deal,
    DealPin,
    DealTimeTick,
    DealViewer,
    InsuranceCompany,
    InsuranceType,
    Quote,
    SalesChannel,
)
from apps.documents.models import Document, OpenNotebookSession
from apps.finances.models import FinancialRecord, Payment, Statement
from apps.mailboxes.models import Mailbox, MailboxProcessedMessage
from apps.notes.models import Note
from apps.notifications.models import (
    Notification,
    NotificationDelivery,
    NotificationSettings,
    TelegramDealRoutingSession,
    TelegramInboundMessage,
    TelegramProfile,
)
from apps.policies.models import Policy, PolicyIssuanceExecution
from apps.tasks.models import Task
from apps.users.models import AuditLog, Permission, Role, RolePermission, UserRole
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

DEMO_TAG = "[DEMO]"
DEMO_DOMAIN = "demo.local"


@dataclass(frozen=True)
class SeedSummary:
    label: str
    count: int


class Command(BaseCommand):
    help = "Populate the local database with deterministic demo data."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--count",
            type=int,
            default=30,
            help="How many demo records to create per main table.",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete previous demo records created by this command before seeding.",
        )

    def handle(self, *args, **options):
        count = max(1, int(options["count"]))
        if options["replace"]:
            self._cleanup_demo_data()

        summaries = self._seed_demo_data(count)
        for summary in summaries:
            self.stdout.write(f"{summary.label}: {summary.count}")

    def _cleanup_demo_data(self) -> None:
        demo_users = list(User.objects.filter(username__startswith="demo_user_"))
        demo_user_ids = [user.id for user in demo_users]
        demo_roles = list(Role.objects.filter(name__startswith=f"{DEMO_TAG} Role "))
        demo_role_ids = [role.id for role in demo_roles]
        demo_deals = list(Deal.objects.filter(title__startswith=f"{DEMO_TAG} Deal "))
        demo_deal_ids = [deal.id for deal in demo_deals]
        demo_clients = list(
            Client.objects.filter(name__startswith=f"{DEMO_TAG} Client ")
        )
        demo_client_ids = [client.id for client in demo_clients]
        demo_policies = list(Policy.objects.filter(number__startswith="DEMO-POL-"))
        demo_policy_ids = [policy.id for policy in demo_policies]
        demo_mailboxes = list(
            Mailbox.objects.filter(email__iendswith=f"@{DEMO_DOMAIN}")
        )
        demo_mailbox_ids = [mailbox.id for mailbox in demo_mailboxes]
        demo_statements = list(
            Statement.objects.filter(name__startswith=f"{DEMO_TAG} Statement ")
        )
        demo_statement_ids = [statement.id for statement in demo_statements]
        demo_payments = list(
            Payment.objects.filter(description__startswith=f"{DEMO_TAG} Payment ")
        )
        demo_payment_ids = [payment.id for payment in demo_payments]
        demo_sessions = list(
            TelegramDealRoutingSession.objects.filter(
                aggregated_text__startswith=f"{DEMO_TAG} Telegram batch "
            )
        )
        demo_session_ids = [session.id for session in demo_sessions]

        MailboxProcessedMessage.objects.filter(mailbox_id__in=demo_mailbox_ids).delete()
        Mailbox.objects.filter(id__in=demo_mailbox_ids).delete()
        TelegramInboundMessage.objects.filter(
            routing_session_id__in=demo_session_ids
        ).delete()
        TelegramDealRoutingSession.objects.filter(id__in=demo_session_ids).delete()
        NotificationDelivery.objects.filter(
            event_type__startswith="demo_event_"
        ).delete()
        Notification.objects.filter(type__startswith="demo_notice_").delete()
        NotificationSettings.objects.filter(user_id__in=demo_user_ids).delete()
        TelegramProfile.objects.filter(user_id__in=demo_user_ids).delete()
        PolicyIssuanceExecution.objects.filter(
            resume_token__startswith="demo-resume-"
        ).delete()
        FinancialRecord.objects.filter(payment_id__in=demo_payment_ids).delete()
        Statement.objects.filter(id__in=demo_statement_ids).delete()
        Payment.objects.filter(id__in=demo_payment_ids).delete()
        Policy.objects.filter(id__in=demo_policy_ids).delete()
        Task.objects.filter(title__startswith=f"{DEMO_TAG} Task ").delete()
        Note.objects.filter(body__startswith=f"{DEMO_TAG} Note ").delete()
        ChatMessage.objects.filter(body__startswith=f"{DEMO_TAG} Chat ").delete()
        Document.objects.filter(title__startswith=f"{DEMO_TAG} Document ").delete()
        for session in OpenNotebookSession.objects.with_deleted().filter(
            notebook_id__startswith="demo-notebook-"
        ):
            session.hard_delete()
        Quote.objects.filter(comments__startswith=f"{DEMO_TAG} Quote ").delete()
        DealTimeTick.objects.filter(source="demo_seed").delete()
        DealViewer.objects.filter(deal_id__in=demo_deal_ids).delete()
        DealPin.objects.filter(deal_id__in=demo_deal_ids).delete()
        Deal.objects.filter(id__in=demo_deal_ids).delete()
        Client.objects.filter(id__in=demo_client_ids).delete()
        for channel in SalesChannel.objects.with_deleted().filter(
            name__startswith=f"{DEMO_TAG} Channel "
        ):
            channel.hard_delete()
        for insurance_type in InsuranceType.objects.with_deleted().filter(
            name__startswith=f"{DEMO_TAG} Type "
        ):
            insurance_type.hard_delete()
        for company in InsuranceCompany.objects.with_deleted().filter(
            name__startswith=f"{DEMO_TAG} Company "
        ):
            company.hard_delete()
        AuditLog.objects.filter(description__startswith=f"{DEMO_TAG} ").delete()
        UserRole.objects.filter(user_id__in=demo_user_ids).delete()
        RolePermission.objects.filter(role_id__in=demo_role_ids).delete()
        for role in Role.objects.with_deleted().filter(id__in=demo_role_ids):
            role.hard_delete()
        User.objects.filter(id__in=demo_user_ids).delete()

    def _seed_demo_data(self, count: int) -> list[SeedSummary]:
        now = timezone.now()
        today = timezone.localdate()
        creator = User.objects.order_by("id").first()

        with transaction.atomic():
            permissions = self._ensure_permissions(count)
            roles = self._ensure_demo_roles(count)
            role_links = self._ensure_role_permissions(roles, permissions)
            users = self._ensure_demo_users(count)
            user_roles = self._ensure_user_roles(users, roles)
            companies = self._ensure_companies(count)
            insurance_types = self._ensure_insurance_types(count)
            channels = self._ensure_channels(count)
            clients = self._ensure_clients(users, count)
            deals = self._ensure_deals(
                users=users,
                clients=clients,
                count=count,
                today=today,
            )
            deal_pins = self._ensure_deal_pins(users, deals)
            deal_viewers = self._ensure_deal_viewers(users, deals, creator)
            time_ticks = self._ensure_deal_time_ticks(users, deals, now)
            quotes = self._ensure_quotes(
                deals=deals,
                users=users,
                companies=companies,
                insurance_types=insurance_types,
            )
            policies = self._ensure_policies(
                deals=deals,
                clients=clients,
                companies=companies,
                insurance_types=insurance_types,
                channels=channels,
                today=today,
            )
            statements = self._ensure_statements(users, count, today)
            payments = self._ensure_payments(deals, policies, today)
            financial_records = self._ensure_financial_records(
                payments, statements, today
            )
            tasks = self._ensure_tasks(users, deals, count, now)
            notes = self._ensure_notes(users, deals, count)
            chat_messages = self._ensure_chat_messages(users, deals, count)
            documents = self._ensure_documents(users, deals, count)
            notebook_sessions = self._ensure_notebook_sessions(count)
            mailboxes = self._ensure_mailboxes(users, deals, count)
            processed_messages = self._ensure_processed_messages(mailboxes, count)
            notifications = self._ensure_notifications(users, deals, count, now)
            telegram_profiles = self._ensure_telegram_profiles(users, count, now)
            notification_settings = self._ensure_notification_settings(users, count)
            deliveries = self._ensure_notification_deliveries(
                users, deals, count, today
            )
            routing_sessions = self._ensure_routing_sessions(
                users, deals, clients, telegram_profiles, count, now
            )
            inbound_messages = self._ensure_inbound_messages(
                users, deals, routing_sessions, telegram_profiles, count, now
            )
            issuance_executions = self._ensure_issuance_executions(
                policies, users, count, now
            )
            audit_logs = self._ensure_audit_logs(users, deals, count)

        return [
            SeedSummary("permissions_total", len(permissions)),
            SeedSummary("demo_roles", len(roles)),
            SeedSummary("role_permissions", len(role_links)),
            SeedSummary("demo_users", len(users)),
            SeedSummary("user_roles", len(user_roles)),
            SeedSummary("clients", len(clients)),
            SeedSummary("insurance_companies", len(companies)),
            SeedSummary("insurance_types", len(insurance_types)),
            SeedSummary("sales_channels", len(channels)),
            SeedSummary("deals", len(deals)),
            SeedSummary("deal_pins", len(deal_pins)),
            SeedSummary("deal_viewers", len(deal_viewers)),
            SeedSummary("deal_time_ticks", len(time_ticks)),
            SeedSummary("quotes", len(quotes)),
            SeedSummary("policies", len(policies)),
            SeedSummary("policy_issuance_executions", len(issuance_executions)),
            SeedSummary("payments", len(payments)),
            SeedSummary("statements", len(statements)),
            SeedSummary("financial_records", len(financial_records)),
            SeedSummary("tasks", len(tasks)),
            SeedSummary("notes", len(notes)),
            SeedSummary("chat_messages", len(chat_messages)),
            SeedSummary("documents", len(documents)),
            SeedSummary("open_notebook_sessions", len(notebook_sessions)),
            SeedSummary("mailboxes", len(mailboxes)),
            SeedSummary("mailbox_processed_messages", len(processed_messages)),
            SeedSummary("notifications", len(notifications)),
            SeedSummary("telegram_profiles", len(telegram_profiles)),
            SeedSummary("notification_settings", len(notification_settings)),
            SeedSummary("notification_deliveries", len(deliveries)),
            SeedSummary("telegram_routing_sessions", len(routing_sessions)),
            SeedSummary("telegram_inbound_messages", len(inbound_messages)),
            SeedSummary("audit_logs", len(audit_logs)),
        ]

    def _ensure_permissions(self, count: int) -> list[Permission]:
        wanted: list[Permission] = []
        for resource, action in product(
            [choice[0] for choice in Permission.RESOURCE_CHOICES],
            [choice[0] for choice in Permission.ACTION_CHOICES],
        ):
            permission, _ = Permission.objects.get_or_create(
                resource=resource,
                action=action,
            )
            wanted.append(permission)
            if len(wanted) >= count:
                break
        return wanted

    def _ensure_demo_roles(self, count: int) -> list[Role]:
        roles: list[Role] = []
        for index in range(1, count + 1):
            role, _ = Role.objects.update_or_create(
                name=f"{DEMO_TAG} Role {index:02d}",
                defaults={
                    "description": f"{DEMO_TAG} Системная демо-роль {index:02d}",
                },
            )
            roles.append(role)
        return roles

    def _ensure_role_permissions(
        self, roles: list[Role], permissions: list[Permission]
    ) -> list[RolePermission]:
        links: list[RolePermission] = []
        permission_cycle = cycle(permissions)
        for role in roles:
            for _ in range(2):
                permission = next(permission_cycle)
                link, _ = RolePermission.objects.get_or_create(
                    role=role,
                    permission=permission,
                )
                links.append(link)
        return links

    def _ensure_demo_users(self, count: int) -> list[User]:
        users: list[User] = []
        for index in range(1, count + 1):
            username = f"demo_user_{index:02d}"
            user, _ = User.objects.update_or_create(
                username=username,
                defaults={
                    "email": f"{username}@{DEMO_DOMAIN}",
                    "first_name": f"Демо{index:02d}",
                    "last_name": "Пользователь",
                    "is_active": True,
                    "is_staff": index <= 3,
                },
            )
            user.set_password("demo12345")
            user.save(update_fields=["password"])
            users.append(user)
        return users

    def _ensure_user_roles(
        self, users: list[User], roles: list[Role]
    ) -> list[UserRole]:
        links: list[UserRole] = []
        for user, role in zip(users, roles):
            link, _ = UserRole.objects.get_or_create(user=user, role=role)
            links.append(link)
        return links

    def _ensure_companies(self, count: int) -> list[InsuranceCompany]:
        companies: list[InsuranceCompany] = []
        for index in range(1, count + 1):
            item, _ = InsuranceCompany.objects.update_or_create(
                name=f"{DEMO_TAG} Company {index:02d}",
                defaults={"description": f"{DEMO_TAG} Страховая компания {index:02d}"},
            )
            companies.append(item)
        return companies

    def _ensure_insurance_types(self, count: int) -> list[InsuranceType]:
        items: list[InsuranceType] = []
        for index in range(1, count + 1):
            item, _ = InsuranceType.objects.update_or_create(
                name=f"{DEMO_TAG} Type {index:02d}",
                defaults={"description": f"{DEMO_TAG} Вид страхования {index:02d}"},
            )
            items.append(item)
        return items

    def _ensure_channels(self, count: int) -> list[SalesChannel]:
        items: list[SalesChannel] = []
        for index in range(1, count + 1):
            item, _ = SalesChannel.objects.update_or_create(
                name=f"{DEMO_TAG} Channel {index:02d}",
                defaults={"description": f"{DEMO_TAG} Канал продаж {index:02d}"},
            )
            items.append(item)
        return items

    def _ensure_clients(self, users: list[User], count: int) -> list[Client]:
        items: list[Client] = []
        for index in range(1, count + 1):
            item, _ = Client.objects.update_or_create(
                name=f"{DEMO_TAG} Client {index:02d}",
                defaults={
                    "created_by": users[index - 1],
                    "phone": f"+7999000{index:04d}",
                    "email": f"demo.client.{index:02d}@{DEMO_DOMAIN}",
                    "notes": f"{DEMO_TAG} Карточка клиента {index:02d}",
                    "is_counterparty": index % 5 == 0,
                },
            )
            items.append(item)
        return items

    def _ensure_deals(
        self, *, users: list[User], clients: list[Client], count: int, today
    ) -> list[Deal]:
        statuses = list(Deal.DealStatus.values)
        items: list[Deal] = []
        for index in range(1, count + 1):
            item, _ = Deal.objects.update_or_create(
                title=f"{DEMO_TAG} Deal {index:02d}",
                defaults={
                    "description": f"{DEMO_TAG} Описание сделки {index:02d}",
                    "client": clients[index - 1],
                    "seller": users[index - 1],
                    "executor": users[index % count],
                    "status": statuses[(index - 1) % len(statuses)],
                    "stage_name": f"Этап {((index - 1) % 6) + 1}",
                    "expected_close": today + timedelta(days=index),
                    "next_contact_date": today + timedelta(days=(index % 10)),
                    "next_review_date": today + timedelta(days=(index % 7)),
                    "source": f"{DEMO_TAG} source {index:02d}",
                    "loss_reason": "" if index % 4 else f"{DEMO_TAG} loss {index:02d}",
                    "closing_reason": (
                        "" if index % 3 else f"{DEMO_TAG} close {index:02d}"
                    ),
                },
            )
            items.append(item)
        return items

    def _ensure_deal_pins(self, users: list[User], deals: list[Deal]) -> list[DealPin]:
        items: list[DealPin] = []
        for user, deal in zip(users, deals):
            item, _ = DealPin.objects.get_or_create(user=user, deal=deal)
            items.append(item)
        return items

    def _ensure_deal_viewers(
        self, users: list[User], deals: list[Deal], creator: User | None
    ) -> list[DealViewer]:
        items: list[DealViewer] = []
        total = len(users)
        for index, deal in enumerate(deals):
            user = users[(index + 1) % total]
            item, _ = DealViewer.objects.get_or_create(
                deal=deal,
                user=user,
                defaults={"added_by": creator or users[index]},
            )
            items.append(item)
        return items

    def _ensure_deal_time_ticks(
        self, users: list[User], deals: list[Deal], now
    ) -> list[DealTimeTick]:
        items: list[DealTimeTick] = []
        for index, (user, deal) in enumerate(zip(users, deals), start=1):
            bucket = (now - timedelta(hours=index)).replace(
                minute=0, second=0, microsecond=0
            )
            item, _ = DealTimeTick.objects.update_or_create(
                user=user,
                bucket_start=bucket,
                defaults={
                    "deal": deal,
                    "seconds": 10 + (index % 5) * 5,
                    "source": "demo_seed",
                },
            )
            items.append(item)
        return items

    def _ensure_quotes(
        self,
        *,
        deals: list[Deal],
        users: list[User],
        companies: list[InsuranceCompany],
        insurance_types: list[InsuranceType],
    ) -> list[Quote]:
        items: list[Quote] = []
        for index, deal in enumerate(deals, start=1):
            item, _ = Quote.objects.update_or_create(
                deal=deal,
                comments=f"{DEMO_TAG} Quote {index:02d}",
                defaults={
                    "seller": users[index - 1],
                    "insurance_company": companies[index - 1],
                    "insurance_type": insurance_types[index - 1],
                    "sum_insured": Decimal("1000000.00") + Decimal(index * 10000),
                    "premium": Decimal("25000.00") + Decimal(index * 300),
                    "deductible": Decimal("10000.00") + Decimal(index * 100),
                    "official_dealer": index % 2 == 0,
                    "gap": index % 3 == 0,
                },
            )
            items.append(item)
        return items

    def _ensure_policies(
        self,
        *,
        deals: list[Deal],
        clients: list[Client],
        companies: list[InsuranceCompany],
        insurance_types: list[InsuranceType],
        channels: list[SalesChannel],
        today,
    ) -> list[Policy]:
        statuses = list(Policy.PolicyStatus.values)
        items: list[Policy] = []
        for index, deal in enumerate(deals, start=1):
            item, _ = Policy.objects.update_or_create(
                number=f"DEMO-POL-{index:04d}",
                defaults={
                    "insurance_company": companies[index - 1],
                    "insurance_type": insurance_types[index - 1],
                    "deal": deal,
                    "client": clients[index - 1],
                    "insured_client": clients[index - 1],
                    "is_vehicle": index % 2 == 0,
                    "brand": f"Brand {index:02d}",
                    "model": f"Model {index:02d}",
                    "vin": f"VIN{index:014d}"[:17],
                    "counterparty": f"{DEMO_TAG} Counterparty {index:02d}",
                    "note": f"{DEMO_TAG} Policy note {index:02d}",
                    "sales_channel": channels[index - 1],
                    "start_date": today - timedelta(days=index),
                    "end_date": today + timedelta(days=365 - index),
                    "status": statuses[(index - 1) % len(statuses)],
                },
            )
            items.append(item)
        return items

    def _ensure_statements(
        self, users: list[User], count: int, today
    ) -> list[Statement]:
        items: list[Statement] = []
        types = [Statement.TYPE_INCOME, Statement.TYPE_EXPENSE]
        for index in range(1, count + 1):
            item, _ = Statement.objects.update_or_create(
                name=f"{DEMO_TAG} Statement {index:02d}",
                defaults={
                    "statement_type": types[(index - 1) % len(types)],
                    "counterparty": f"{DEMO_TAG} Counterparty {index:02d}",
                    "status": (
                        Statement.STATUS_PAID
                        if index % 2 == 0
                        else Statement.STATUS_DRAFT
                    ),
                    "paid_at": today if index % 2 == 0 else None,
                    "comment": f"{DEMO_TAG} Ведомость {index:02d}",
                    "created_by": users[index - 1],
                },
            )
            items.append(item)
        return items

    def _ensure_payments(
        self, deals: list[Deal], policies: list[Policy], today
    ) -> list[Payment]:
        items: list[Payment] = []
        for index, policy in enumerate(policies, start=1):
            item, _ = Payment.objects.update_or_create(
                policy=policy,
                description=f"{DEMO_TAG} Payment {index:02d}",
                defaults={
                    "deal": deals[index - 1],
                    "amount": Decimal("5000.00") + Decimal(index * 250),
                    "scheduled_date": today + timedelta(days=index),
                    "actual_date": today if index % 3 == 0 else None,
                },
            )
            items.append(item)
        return items

    def _ensure_financial_records(
        self, payments: list[Payment], statements: list[Statement], today
    ) -> list[FinancialRecord]:
        items: list[FinancialRecord] = []
        for index, payment in enumerate(payments, start=1):
            record_type = (
                FinancialRecord.RecordType.EXPENSE
                if index % 4 == 0
                else FinancialRecord.RecordType.INCOME
            )
            raw_amount = Decimal("1500.00") + Decimal(index * 50)
            if record_type == FinancialRecord.RecordType.EXPENSE:
                raw_amount = -raw_amount
            item, _ = FinancialRecord.objects.update_or_create(
                payment=payment,
                description=f"{DEMO_TAG} Financial record {index:02d}",
                defaults={
                    "statement": statements[index - 1],
                    "amount": raw_amount,
                    "record_type": record_type,
                    "date": today - timedelta(days=index % 10),
                    "source": f"{DEMO_TAG} source {index:02d}",
                    "note": f"{DEMO_TAG} note {index:02d}",
                },
            )
            items.append(item)
        return items

    def _ensure_tasks(
        self, users: list[User], deals: list[Deal], count: int, now
    ) -> list[Task]:
        items: list[Task] = []
        statuses = list(Task.TaskStatus.values)
        priorities = list(Task.PriorityChoices.values)
        for index in range(1, count + 1):
            item, _ = Task.objects.update_or_create(
                title=f"{DEMO_TAG} Task {index:02d}",
                defaults={
                    "description": f"{DEMO_TAG} Задача {index:02d}",
                    "deal": deals[index - 1],
                    "assignee": users[index - 1],
                    "created_by": users[index % count],
                    "completed_by": users[index - 1] if index % 3 == 0 else None,
                    "due_at": now + timedelta(days=index),
                    "remind_at": now + timedelta(days=index, hours=-2),
                    "completed_at": now - timedelta(days=1) if index % 3 == 0 else None,
                    "status": statuses[(index - 1) % len(statuses)],
                    "priority": priorities[(index - 1) % len(priorities)],
                    "checklist": [
                        {
                            "text": f"{DEMO_TAG} checklist {index:02d}-1",
                            "done": index % 2 == 0,
                        },
                        {"text": f"{DEMO_TAG} checklist {index:02d}-2", "done": False},
                    ],
                },
            )
            items.append(item)
        return items

    def _ensure_notes(
        self, users: list[User], deals: list[Deal], count: int
    ) -> list[Note]:
        items: list[Note] = []
        for index in range(1, count + 1):
            item, _ = Note.objects.update_or_create(
                body=f"{DEMO_TAG} Note {index:02d}",
                defaults={
                    "deal": deals[index - 1],
                    "author_name": users[index - 1].get_full_name()
                    or users[index - 1].username,
                    "author": users[index - 1],
                    "attachments": [
                        {"name": f"demo-note-{index:02d}.txt", "provider": "local"}
                    ],
                    "is_important": index % 5 == 0,
                },
            )
            items.append(item)
        return items

    def _ensure_chat_messages(
        self, users: list[User], deals: list[Deal], count: int
    ) -> list[ChatMessage]:
        items: list[ChatMessage] = []
        for index in range(1, count + 1):
            item, _ = ChatMessage.objects.update_or_create(
                deal=deals[index - 1],
                body=f"{DEMO_TAG} Chat {index:02d}",
                defaults={
                    "author_name": users[index - 1].username,
                    "author": users[index - 1],
                },
            )
            items.append(item)
        return items

    def _ensure_documents(
        self, users: list[User], deals: list[Deal], count: int
    ) -> list[Document]:
        items: list[Document] = []
        statuses = [choice[0] for choice in Document._meta.get_field("status").choices]
        for index in range(1, count + 1):
            title = f"{DEMO_TAG} Document {index:02d}"
            item, _ = Document.objects.update_or_create(
                title=title,
                defaults={
                    "deal": deals[index - 1],
                    "owner": users[index - 1],
                    "doc_type": "demo_text",
                    "status": statuses[(index - 1) % len(statuses)],
                    "mime_type": "text/plain",
                    "checksum": f"demo-checksum-{index:02d}",
                },
            )
            file_name = f"demo_document_{index:02d}.txt"
            item.file.save(
                file_name,
                ContentFile(f"{DEMO_TAG} file content {index:02d}\n"),
                save=False,
            )
            item.file_size = item.file.size
            item.save()
            items.append(item)
        return items

    def _ensure_notebook_sessions(self, count: int) -> list[OpenNotebookSession]:
        items: list[OpenNotebookSession] = []
        for index in range(1, count + 1):
            item, _ = OpenNotebookSession.objects.update_or_create(
                notebook_id=f"demo-notebook-{index:02d}",
                defaults={"chat_session_id": f"demo-chat-session-{index:02d}"},
            )
            items.append(item)
        return items

    def _ensure_mailboxes(
        self, users: list[User], deals: list[Deal], count: int
    ) -> list[Mailbox]:
        items: list[Mailbox] = []
        for index in range(1, count + 1):
            local_part = f"demo.deal{index:02d}"
            item, _ = Mailbox.objects.update_or_create(
                email=f"{local_part}@{DEMO_DOMAIN}",
                defaults={
                    "user": users[index - 1],
                    "deal": deals[index - 1],
                    "local_part": local_part,
                    "domain": DEMO_DOMAIN,
                    "display_name": f"{DEMO_TAG} Mailbox {index:02d}",
                    "is_active": True,
                },
            )
            items.append(item)
        return items

    def _ensure_processed_messages(
        self, mailboxes: list[Mailbox], count: int
    ) -> list[MailboxProcessedMessage]:
        items: list[MailboxProcessedMessage] = []
        for index in range(1, count + 1):
            item, _ = MailboxProcessedMessage.objects.update_or_create(
                mailbox=mailboxes[index - 1],
                uid=f"demo-uid-{index:04d}",
                defaults={
                    "message_id": f"<demo-{index:04d}@{DEMO_DOMAIN}>",
                    "subject": f"{DEMO_TAG} Mail subject {index:02d}",
                    "sender": f"sender{index:02d}@{DEMO_DOMAIN}",
                },
            )
            items.append(item)
        return items

    def _ensure_notifications(
        self, users: list[User], deals: list[Deal], count: int, now
    ) -> list[Notification]:
        items: list[Notification] = []
        for index in range(1, count + 1):
            item, _ = Notification.objects.update_or_create(
                user=users[index - 1],
                type=f"demo_notice_{index:02d}",
                defaults={
                    "payload": {
                        "demo": True,
                        "deal_id": str(deals[index - 1].id),
                        "message": f"{DEMO_TAG} Notification {index:02d}",
                    },
                    "is_read": index % 2 == 0,
                    "read_at": now if index % 2 == 0 else None,
                },
            )
            items.append(item)
        return items

    def _ensure_telegram_profiles(
        self, users: list[User], count: int, now
    ) -> list[TelegramProfile]:
        items: list[TelegramProfile] = []
        for index in range(1, count + 1):
            item, _ = TelegramProfile.objects.update_or_create(
                user=users[index - 1],
                defaults={
                    "chat_id": 900000000000 + index,
                    "linked_at": now - timedelta(days=index % 7),
                    "link_code": f"demo-link-{index:02d}",
                    "link_code_expires_at": now + timedelta(days=1),
                },
            )
            items.append(item)
        return items

    def _ensure_notification_settings(
        self, users: list[User], count: int
    ) -> list[NotificationSettings]:
        items: list[NotificationSettings] = []
        for index in range(1, count + 1):
            item, _ = NotificationSettings.objects.update_or_create(
                user=users[index - 1],
                defaults={
                    "next_contact_lead_days": 30 + index,
                    "telegram_enabled": index % 2 == 0,
                    "notify_tasks": True,
                    "notify_deal_events": index % 3 != 0,
                    "notify_deal_expected_close": True,
                    "notify_payment_due": index % 4 != 0,
                    "notify_policy_expiry": True,
                    "remind_days": [7, 3, 1],
                    "sber_login": f"demo_sber_{index:02d}",
                    "sber_password": f"demo_sber_pass_{index:02d}",
                },
            )
            items.append(item)
        return items

    def _ensure_notification_deliveries(
        self, users: list[User], deals: list[Deal], count: int, today
    ) -> list[NotificationDelivery]:
        items: list[NotificationDelivery] = []
        for index in range(1, count + 1):
            item, _ = NotificationDelivery.objects.update_or_create(
                user=users[index - 1],
                event_type=f"demo_event_{index:02d}",
                object_type="deal",
                object_id=str(deals[index - 1].id),
                trigger_date=today - timedelta(days=index % 5),
                defaults={"metadata": {"demo": True, "index": index}},
            )
            items.append(item)
        return items

    def _ensure_routing_sessions(
        self,
        users: list[User],
        deals: list[Deal],
        clients: list[Client],
        telegram_profiles: list[TelegramProfile],
        count: int,
        now,
    ) -> list[TelegramDealRoutingSession]:
        items: list[TelegramDealRoutingSession] = []
        states = list(TelegramDealRoutingSession.State.values)
        for index in range(1, count + 1):
            deal = deals[index - 1]
            item, _ = TelegramDealRoutingSession.objects.update_or_create(
                user=users[index - 1],
                aggregated_text=f"{DEMO_TAG} Telegram batch {index:02d}",
                defaults={
                    "state": states[(index - 1) % len(states)],
                    "expires_at": now + timedelta(hours=4),
                    "last_message_at": now - timedelta(minutes=index),
                    "batch_timeout_seconds": 60,
                    "batch_message_ids": [1000 + index, 2000 + index],
                    "batch_payloads": [{"demo": True, "index": index}],
                    "aggregated_attachments": [
                        {"file_name": f"demo_attach_{index:02d}.txt"}
                    ],
                    "extracted_data": {"deal_hint": deal.title},
                    "candidate_deal_ids": [str(deal.id)],
                    "selected_deal": deal if index % 2 == 0 else None,
                    "created_client": clients[index - 1] if index % 3 == 0 else None,
                    "created_deal": deal if index % 3 == 0 else None,
                    "decision_prompt_sent_at": now - timedelta(minutes=5),
                    "status_message_id": 7000 + index,
                },
            )
            items.append(item)
        return items

    def _ensure_inbound_messages(
        self,
        users: list[User],
        deals: list[Deal],
        routing_sessions: list[TelegramDealRoutingSession],
        telegram_profiles: list[TelegramProfile],
        count: int,
        now,
    ) -> list[TelegramInboundMessage]:
        items: list[TelegramInboundMessage] = []
        statuses = list(TelegramInboundMessage.Status.values)
        for index in range(1, count + 1):
            item, _ = TelegramInboundMessage.objects.update_or_create(
                chat_id=telegram_profiles[index - 1].chat_id,
                message_id=10000 + index,
                defaults={
                    "user": users[index - 1],
                    "routing_session": routing_sessions[index - 1],
                    "linked_deal": deals[index - 1] if index % 2 == 0 else None,
                    "update_id": 20000 + index,
                    "text": f"{DEMO_TAG} Telegram inbound {index:02d}",
                    "payload": {"demo": True, "kind": "text"},
                    "status": statuses[(index - 1) % len(statuses)],
                    "processed_at": now - timedelta(minutes=index % 10),
                },
            )
            items.append(item)
        return items

    def _ensure_issuance_executions(
        self, policies: list[Policy], users: list[User], count: int, now
    ) -> list[PolicyIssuanceExecution]:
        items: list[PolicyIssuanceExecution] = []
        statuses = list(PolicyIssuanceExecution.Status.values)
        for index in range(1, count + 1):
            item, _ = PolicyIssuanceExecution.objects.update_or_create(
                resume_token=f"demo-resume-{index:04d}",
                defaults={
                    "policy": policies[index - 1],
                    "requested_by": users[index - 1],
                    "provider": PolicyIssuanceExecution.Provider.SBER,
                    "product": PolicyIssuanceExecution.Product.OSAGO_AUTO,
                    "status": statuses[(index - 1) % len(statuses)],
                    "step": f"demo_step_{index:02d}",
                    "manual_step_reason": f"{DEMO_TAG} manual reason {index:02d}",
                    "manual_step_instructions": f"{DEMO_TAG} instructions {index:02d}",
                    "external_policy_number": f"EXT-{index:04d}",
                    "last_error": "" if index % 4 else f"{DEMO_TAG} simulated error",
                    "log": [{"demo": True, "index": index}],
                    "payload": {"demo": True, "index": index},
                    "runtime_state": {"progress": index},
                    "started_at": now - timedelta(minutes=index),
                    "finished_at": now if index % 3 == 0 else None,
                },
            )
            items.append(item)
        return items

    def _ensure_audit_logs(
        self, users: list[User], deals: list[Deal], count: int
    ) -> list[AuditLog]:
        items: list[AuditLog] = []
        actions = [choice[0] for choice in AuditLog.ACTION_CHOICES]
        for index in range(1, count + 1):
            item = AuditLog.objects.create(
                actor=users[index - 1],
                object_type="deal",
                object_id=str(deals[index - 1].id),
                object_name=deals[index - 1].title,
                action=actions[(index - 1) % len(actions)],
                description=f"{DEMO_TAG} Audit log {index:02d}",
                old_value={"stage": "before"},
                new_value={"stage": "after", "index": index},
            )
            items.append(item)
        return items
