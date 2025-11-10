import uuid
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet для работы с мягким удалением"""

    def delete(self):
        """Мягкое удаление вместо жёсткого"""
        return self.update(deleted_at=timezone.now())

    def alive(self):
        """Только активные записи"""
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        """Только удалённые записи"""
        return self.filter(deleted_at__isnull=False)

    def with_deleted(self):
        """Включить удалённые записи"""
        return self.all()


class SoftDeleteManager(models.Manager):
    """Manager для мягкого удаления"""

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def alive(self):
        return self.get_queryset()

    def dead(self):
        return self.get_queryset().dead()

    def with_deleted(self):
        return self.get_queryset().with_deleted()


class SoftDeleteModel(models.Model):
    """Базовая модель с поддержкой мягкого удаления"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deleted_at = models.DateTimeField(null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SoftDeleteManager()

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        """Мягкое удаление"""
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Жёсткое удаление"""
        super().delete()

    def restore(self):
        """Восстановление удалённой записи"""
        self.deleted_at = None
        self.save()

    def is_deleted(self):
        """Проверка, удалена ли запись"""
        return self.deleted_at is not None
