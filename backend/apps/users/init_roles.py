"""
Скрипт инициализации ролей и прав в системе.
Выполните через: python manage.py shell < init_roles.py
"""
from apps.users.models import Role, Permission, RolePermission


def initialize_roles_and_permissions():
    """Инициализировать стандартные роли и права"""

    print("Инициализация ролей и прав...")

    # 1. Создать права доступа
    permissions_data = [
        # Deal
        ('deal', 'view'),
        ('deal', 'create'),
        ('deal', 'edit'),
        ('deal', 'delete'),
        ('deal', 'admin'),
        # Client
        ('client', 'view'),
        ('client', 'create'),
        ('client', 'edit'),
        ('client', 'delete'),
        ('client', 'admin'),
        # Task
        ('task', 'view'),
        ('task', 'create'),
        ('task', 'edit'),
        ('task', 'delete'),
        ('task', 'admin'),
        # Document
        ('document', 'view'),
        ('document', 'create'),
        ('document', 'delete'),
        ('document', 'admin'),
        # Payment
        ('payment', 'view'),
        ('payment', 'create'),
        ('payment', 'edit'),
        ('payment', 'delete'),
        ('payment', 'admin'),
        # Note
        ('note', 'view'),
        ('note', 'create'),
        ('note', 'edit'),
        ('note', 'delete'),
        # Policy
        ('policy', 'view'),
        ('policy', 'create'),
        ('policy', 'edit'),
        ('policy', 'delete'),
        ('policy', 'admin'),
        # User
        ('user', 'view'),
        ('user', 'create'),
        ('user', 'edit'),
        ('user', 'delete'),
        ('user', 'admin'),
        # Notification
        ('notification', 'view'),
    ]

    permissions = {}
    for resource, action in permissions_data:
        perm, created = Permission.objects.get_or_create(
            resource=resource,
            action=action
        )
        permissions[(resource, action)] = perm
        if created:
            print(f"✓ Создано право: {resource} - {action}")
        else:
            print(f"✓ Право уже существует: {resource} - {action}")

    # 2. Создать роли
    roles = {}

    # Роль: Администратор
    admin_role, created = Role.objects.get_or_create(
        name='Администратор',
        defaults={'description': 'Полный доступ ко всем функциям системы'}
    )
    roles['admin'] = admin_role
    if created:
        print(f"\n✓ Создана роль: Администратор")
    else:
        print(f"\n✓ Роль уже существует: Администратор")

    # Роль: Менеджер
    manager_role, created = Role.objects.get_or_create(
        name='Менеджер',
        defaults={'description': 'Может создавать и редактировать свои сделки'}
    )
    roles['manager'] = manager_role
    if created:
        print(f"✓ Создана роль: Менеджер")
    else:
        print(f"✓ Роль уже существует: Менеджер")

    # Роль: Наблюдатель
    observer_role, created = Role.objects.get_or_create(
        name='Наблюдатель',
        defaults={'description': 'Может только просматривать данные'}
    )
    roles['observer'] = observer_role
    if created:
        print(f"✓ Создана роль: Наблюдатель")
    else:
        print(f"✓ Роль уже существует: Наблюдатель")

    # 3. Назначить права ролям

    # Администратор - ВСЕ права
    admin_perms = [p for r, a, p in [(r, a, permissions.get((r, a))) for r, a in permissions_data]]
    admin_perms = [p for p in admin_perms if p]

    for perm in admin_perms:
        rp, created = RolePermission.objects.get_or_create(
            role=admin_role,
            permission=perm
        )
        if created:
            print(f"  ✓ Админ: добавлено право {perm.get_resource_display()} - {perm.get_action_display()}")

    # Менеджер - основные права (view, create, edit для своих данных)
    manager_perms_list = [
        ('deal', 'view'),
        ('deal', 'create'),
        ('deal', 'edit'),
        ('client', 'view'),
        ('client', 'create'),
        ('client', 'edit'),
        ('task', 'view'),
        ('task', 'create'),
        ('task', 'edit'),
        ('document', 'view'),
        ('document', 'create'),
        ('payment', 'view'),
        ('payment', 'create'),
        ('payment', 'edit'),
        ('note', 'view'),
        ('note', 'create'),
        ('note', 'edit'),
        ('policy', 'view'),
        ('policy', 'create'),
        ('policy', 'edit'),
        ('notification', 'view'),
    ]

    for resource, action in manager_perms_list:
        perm = permissions.get((resource, action))
        if perm:
            rp, created = RolePermission.objects.get_or_create(
                role=manager_role,
                permission=perm
            )
            if created:
                print(f"  ✓ Менеджер: добавлено право {perm.get_resource_display()} - {perm.get_action_display()}")

    # Наблюдатель - только просмотр
    observer_perms_list = [
        ('deal', 'view'),
        ('client', 'view'),
        ('task', 'view'),
        ('document', 'view'),
        ('payment', 'view'),
        ('note', 'view'),
        ('policy', 'view'),
        ('notification', 'view'),
    ]

    for resource, action in observer_perms_list:
        perm = permissions.get((resource, action))
        if perm:
            rp, created = RolePermission.objects.get_or_create(
                role=observer_role,
                permission=perm
            )
            if created:
                print(f"  ✓ Наблюдатель: добавлено право {perm.get_resource_display()} - {perm.get_action_display()}")

    print("\n✅ Инициализация ролей и прав завершена!")


if __name__ == '__main__':
    initialize_roles_and_permissions()
