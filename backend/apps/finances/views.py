from django.db.models import Sum, Q
from django.core.exceptions import ValidationError
from rest_framework import permissions, viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from .models import Payment, FinancialRecord
from .serializers import PaymentSerializer, FinancialRecordSerializer


class FinancialRecordViewSet(viewsets.ModelViewSet):
    """ViewSet для финансовых записей (доход/расход)"""
    queryset = FinancialRecord.objects.select_related('payment').all().order_by('-date', '-created_at')
    serializer_class = FinancialRecordSerializer
    permission_classes = [permissions.AllowAny]


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet для платежей с поддержкой проверки удаления"""
    queryset = Payment.objects.select_related('policy', 'deal').prefetch_related('financial_records').all().order_by('-scheduled_date')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.AllowAny]

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
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Считаем доходы (положительные суммы) и расходы (отрицательные суммы)
        incomes_total = FinancialRecord.objects.filter(
            amount__gt=0,
            deleted_at__isnull=True
        ).aggregate(total=Sum('amount'))['total'] or 0

        expenses_total = abs(FinancialRecord.objects.filter(
            amount__lt=0,
            deleted_at__isnull=True
        ).aggregate(total=Sum('amount'))['total'] or 0)

        net_total = incomes_total - expenses_total

        # Плановые платежи
        planned_payments = Payment.objects.filter(
            status=Payment.PaymentStatus.PLANNED,
            deleted_at__isnull=True
        ).select_related('policy').order_by('scheduled_date')[:5]

        serializer = PaymentSerializer(planned_payments, many=True)

        return Response({
            'incomes_total': float(incomes_total),
            'expenses_total': float(expenses_total),
            'net_total': float(net_total),
            'planned_payments': serializer.data,
        })
