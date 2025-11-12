from apps.common.models import SoftDeleteModel
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Role(SoftDeleteModel):
    """
    Роль пользователя в системе.
    Пользователь может иметь несколько ролей одновременно.
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Название роли (e.g., 'Администратор', 'Менеджер', 'Наблюдатель')",
    )
    description = models.TextField(blank=True, help_text="Описание роли и её прав")

    class Meta:
        verbose_name = "Роль"
        verbose_name_plural = "Роли"

    def __str__(self):
        return self.name


class Permission(SoftDeleteModel):
    """
    Право доступа в системе.
    Определяет, какие действия может выполнять пользователь с каждой сущностью.
    """

    RESOURCE_CHOICES = [
        ("deal", "Сделка"),
        ("client", "Клиент"),
        ("task", "Задача"),
        ("document", "Документ"),
        ("payment", "Платёж"),
        ("note", "Заметка"),
        ("policy", "Полис"),
        ("user", "Пользователь"),
        ("notification", "Уведомление"),
    ]

    ACTION_CHOICES = [
        ("view", "Просмотр"),
        ("create", "Создание"),
        ("edit", "Редактирование"),
        ("delete", "Удаление"),
        ("admin", "Администрирование"),
    ]

    resource = models.CharField(
        max_length=50,
        choices=RESOURCE_CHOICES,
        help_text="Сущность (Сделка, Клиент, и т.д.)",
    )
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        help_text="Действие (Просмотр, Редактирование, и т.д.)",
    )

    class Meta:
        verbose_name = "Право доступа"
        verbose_name_plural = "Права доступа"
        unique_together = ("resource", "action", "deleted_at")

    def __str__(self):
        return f"{self.get_resource_display()} - {self.get_action_display()}"


class UserRole(models.Model):
    """
    Промежуточная таблица для связи User и Role (ManyToMany).
    Позволяет пользователю иметь несколько ролей.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="users")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Роль пользователя"
        verbose_name_plural = "Роли пользователей"
        unique_together = ("user", "role")

    def __str__(self):
        return f"{self.user.username} - {self.role.name}"


class RolePermission(models.Model):
    """
    Промежуточная таблица для связи Role и Permission (ManyToMany).
    Определяет, какие права имеет каждая роль.
    """

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="permissions")
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="roles"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Право роли"
        verbose_name_plural = "Права ролей"
        unique_together = ("role", "permission")

    def __str__(self):
        return f"{self.role.name} - {self.permission}"


class AuditLog(models.Model):
    """
    Журнал аудита для логирования изменений ролей и прав.
    Записывает все действия: создание, редактирование, удаление.
    """

    ACTION_CHOICES = [
        ("create", "Создание"),
        ("update", "Редактирование"),
        ("delete", "Удаление"),
        ("assign", "Назначение"),
        ("revoke", "Отзыв"),
    ]

    OBJECT_TYPE_CHOICES = [
        # Управление доступом
        ("role", "Роль"),
        ("permission", "Право"),
        ("user_role", "Роль пользователя"),
        ("role_permission", "Право роли"),
        # Основные сущности CRM
        ("client", "Клиент"),
        ("deal", "Сделка"),
        ("task", "Задача"),
        ("document", "Документ"),
        ("payment", "Платёж"),
        ("policy", "Полис"),
        ("note", "Заметка"),
        ("financial_record", "Финансовая запись"),
        ("notification", "Уведомление"),
        ("user", "Пользователь"),
    ]

    # Кто совершил действие
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs_created",
        help_text="Пользователь, совершивший действие",
    )

    # Тип объекта и его ID
    object_type = models.CharField(
        max_length=50, choices=OBJECT_TYPE_CHOICES, help_text="Тип изменяемого объекта"
    )
    object_id = models.CharField(max_length=255, help_text="ID изменяемого объекта")
    object_name = models.CharField(
        max_length=255, blank=True, help_text="Название объекта для удобства"
    )

    # Действие
    action = models.CharField(
        max_length=50, choices=ACTION_CHOICES, help_text="Тип действия"
    )

    # Описание изменений
    description = models.TextField(
        blank=True, help_text="Подробное описание произошедшего изменения"
    )

    # Старые и новые значения
    old_value = models.JSONField(
        null=True, blank=True, help_text="Старое значение (для update)"
    )
    new_value = models.JSONField(
        null=True, blank=True, help_text="Новое значение (для update)"
    )

    # Временная метка
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Запись аудита"
        verbose_name_plural = "Записи аудита"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["object_type", "object_id"]),
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_action_display()} {self.get_object_type_display()} ({self.object_name}) by {self.actor.username if self.actor else 'System'}"
