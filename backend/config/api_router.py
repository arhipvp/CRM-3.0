from rest_framework.routers import DefaultRouter

from apps.clients.views import ClientViewSet
from apps.deals.views import DealViewSet, QuoteViewSet
from apps.documents.views import DocumentViewSet
from apps.finances.views import ExpenseViewSet, IncomeViewSet, PaymentViewSet
from apps.notes.views import NoteViewSet
from apps.notifications.views import NotificationViewSet
from apps.tasks.views import TaskViewSet
from apps.policies.views import PolicyViewSet

router = DefaultRouter()
router.register('clients', ClientViewSet, basename='client')
router.register('deals', DealViewSet, basename='deal')
router.register('quotes', QuoteViewSet, basename='quote')
router.register('tasks', TaskViewSet, basename='task')
router.register('documents', DocumentViewSet, basename='document')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('payments', PaymentViewSet, basename='payment')
router.register('incomes', IncomeViewSet, basename='income')
router.register('expenses', ExpenseViewSet, basename='expense')
router.register('notes', NoteViewSet, basename='note')
router.register('policies', PolicyViewSet, basename='policy')

api_urlpatterns = router.urls
