from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response


class DealRestoreMixin:
    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        queryset = self._base_queryset(include_deleted=True)
        deal = get_object_or_404(queryset, pk=pk)
        if not self._can_modify(request.user, deal):
            return Response(
                {
                    "detail": "�?��?�?�?�'���'�?�ؐ?�? ���?���? �?�>�? �?�?�?�?�'���?�?�?�>��?��? �?�?��>���."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        deal.restore()
        serializer = self.get_serializer(deal)
        return Response(serializer.data)
