from django.db.models import Sum
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Expense, Income, Payment
from .serializers import ExpenseSerializer, IncomeSerializer, PaymentSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('deal').all().order_by('-scheduled_date')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.AllowAny]


class IncomeViewSet(viewsets.ModelViewSet):
    queryset = Income.objects.select_related('payment').all().order_by('-received_at', '-created_at')
    serializer_class = IncomeSerializer
    permission_classes = [permissions.AllowAny]


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related('payment').all().order_by('-expense_date', '-created_at')
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.AllowAny]


class FinanceSummaryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        incomes_total = Income.objects.aggregate(total=Sum('amount'))['total'] or 0
        expenses_total = Expense.objects.aggregate(total=Sum('amount'))['total'] or 0
        net_total = incomes_total - expenses_total
        planned_payments = Payment.objects.filter(status=Payment.PaymentStatus.PLANNED).order_by('scheduled_date')[:5]
        serializer = PaymentSerializer(planned_payments, many=True)
        return Response({
            'incomes_total': float(incomes_total),
            'expenses_total': float(expenses_total),
            'net_total': float(net_total),
            'planned_payments': serializer.data,
        })
