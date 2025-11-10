from rest_framework import permissions, viewsets

from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
