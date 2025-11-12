from django.db.models import Sum, Q
from django.core.exceptions import ValidationError
from rest_framework import permissions, viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from .models import Payment, FinancialRecord
from .serializers import PaymentSerializer, FinancialRecordSerializer
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission, EditProtectedMixin
from apps.users.models import UserRole


class FinancialRecordViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    """ViewSet для финансовых записей (доход/расход)"""
    serializer_class = FinancialRecordSerializer
    permission_classes = [IsAuthenticatedPermission]

    def get_queryset(self):
        user = self.request.user
        queryset = FinancialRecord.objects.select_related('payment').all().order_by('-date', '-created_at')

        # Администраторы видят все финансовые записи
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        if not is_admin:
            # Остальные видят только записи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(
                Q(payment__deal__seller=user) | Q(payment__deal__executor=user)
            )

        return queryset


class PaymentViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    """ViewSet для платежей с поддержкой проверки удаления"""
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticatedPermission]

    def get_queryset(self):
        user = self.request.user
        queryset = Payment.objects.select_related('policy', 'deal').prefetch_related('financial_records').all().order_by('-scheduled_date')

        # Администраторы видят все платежи
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        if not is_admin:
            # Остальные видят только платежи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(
                Q(deal__seller=user) | Q(deal__executor=user)
            )

        return queryset

    def destroy(self, request, *args, **kwargs):
        """Удаление платежа с проверкой наличия финансовых записей"""
        instance = self.get_object()

        if not instance.can_delete():
            return Response(
                {'detail': 'Невозможно удалить платёж, так как у него есть финансовые записи.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().destroy(request, *args, **kwargs)


class FinanceSummaryView(APIView):
    """Endpoint для сводки по финансам"""
    permission_classes = [IsAuthenticatedPermission]

    def get(self, request):
        user = request.user

        # Администраторы видят все финансы
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        # Базовый queryset для финансовых записей
        records_queryset = FinancialRecord.objects.filter(deleted_at__isnull=True)
        if not is_admin:
            # Остальные видят только записи для своих сделок (где user = seller или executor)
            records_queryset = records_queryset.filter(
                Q(payment__deal__seller=user) | Q(payment__deal__executor=user)
            )

        # Считаем доходы (положительные суммы) и расходы (отрицательные суммы)
        incomes_total = records_queryset.filter(amount__gt=0).aggregate(total=Sum('amount'))['total'] or 0
        expenses_total = abs(records_queryset.filter(amount__lt=0).aggregate(total=Sum('amount'))['total'] or 0)
        net_total = incomes_total - expenses_total

        # Плановые платежи
        payments_queryset = Payment.objects.filter(
            status=Payment.PaymentStatus.PLANNED,
            deleted_at__isnull=True
        )
        if not is_admin:
            payments_queryset = payments_queryset.filter(
                Q(deal__seller=user) | Q(deal__executor=user)
            )

        planned_payments = payments_queryset.select_related('policy').order_by('scheduled_date')[:5]
        serializer = PaymentSerializer(planned_payments, many=True)

        return Response({
            'incomes_total': float(incomes_total),
            'expenses_total': float(expenses_total),
            'net_total': float(net_total),
            'planned_payments': serializer.data,
        })
