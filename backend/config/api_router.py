from apps.chat.views import ChatMessageViewSet
from apps.clients.views import ClientViewSet
from apps.deals.views import (
    DealViewSet,
    InsuranceCompanyViewSet,
    InsuranceTypeViewSet,
    QuoteViewSet,
    SalesChannelViewSet,
)
from apps.documents.views import DocumentViewSet
from apps.finances.views import (
    FinancialRecordViewSet,
    PaymentViewSet,
    StatementViewSet,
)
from apps.notes.views import NoteViewSet
from apps.notifications.views import NotificationViewSet
from apps.policies.views import PolicyViewSet
from apps.tasks.views import TaskViewSet
from apps.users.views import (
    AuditLogViewSet,
    PermissionViewSet,
    RoleViewSet,
    UserViewSet,
)
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("deals", DealViewSet, basename="deal")
router.register("quotes", QuoteViewSet, basename="quote")
router.register(
    "insurance_companies",
    InsuranceCompanyViewSet,
    basename="insurance_company",
)
router.register("insurance_types", InsuranceTypeViewSet, basename="insurance_type")
router.register("sales_channels", SalesChannelViewSet, basename="sales_channel")
router.register("audit_logs", AuditLogViewSet, basename="audit_log")
router.register("chat_messages", ChatMessageViewSet, basename="chat_message")
router.register("tasks", TaskViewSet, basename="task")
router.register("documents", DocumentViewSet, basename="document")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("payments", PaymentViewSet, basename="payment")
router.register(
    "financial_records", FinancialRecordViewSet, basename="financial_record"
)
router.register("finance_statements", StatementViewSet, basename="finance_statement")
router.register("notes", NoteViewSet, basename="note")
router.register("policies", PolicyViewSet, basename="policy")
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("permissions", PermissionViewSet, basename="permission")

api_urlpatterns = router.urls
