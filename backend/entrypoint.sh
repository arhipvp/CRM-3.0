#!/bin/bash

set -e

echo "Waiting for postgres..."
while ! nc -z $DJANGO_DB_HOST $DJANGO_DB_PORT; do
  sleep 0.1
done
echo "PostgreSQL started"

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running migrations..."
  python manage.py migrate --noinput
else
  echo "Skipping migrations (set RUN_MIGRATIONS=true to enable automatic migrations)"
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Ensuring superuser exists..."
python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

User = get_user_model()

username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "admin123")

user, created = User.objects.get_or_create(username=username, defaults={
    "email": email,
})
if created:
    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    user.save()
    print(f"Superuser created: {username} / <hidden>")
else:
    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    if email and not user.email:
        user.email = email
    user.save()
    print(f"Superuser {username} password reset")

try:
    from apps.users.models import Permission, Role, RolePermission, UserRole

    admin_role = Role.objects.with_deleted().filter(name="Admin").first()
    if admin_role is None:
        Role.objects.bulk_create(
            [
                Role(
                    name="Admin",
                    description="Полный доступ ко всем разделам CRM.",
                )
            ],
            ignore_conflicts=True,
        )
        admin_role = Role.objects.with_deleted().get(name="Admin")
    elif admin_role.deleted_at is not None:
        Role.objects.with_deleted().filter(pk=admin_role.pk).update(deleted_at=None)
        admin_role.deleted_at = None
    required_permissions = [
        (resource, action)
        for resource, _resource_label in Permission.RESOURCE_CHOICES
        for action, _action_label in Permission.ACTION_CHOICES
    ]
    existing_permissions = {
        (permission.resource, permission.action): permission
        for permission in Permission.objects.with_deleted().filter(
            resource__in=[resource for resource, _action in required_permissions],
            action__in=[action for _resource, action in required_permissions],
        )
    }
    Permission.objects.bulk_create(
        [
            Permission(resource=resource, action=action)
            for resource, action in required_permissions
            if (resource, action) not in existing_permissions
        ],
        ignore_conflicts=True,
    )
    Permission.objects.with_deleted().filter(
        resource__in=[resource for resource, _action in required_permissions],
        action__in=[action for _resource, action in required_permissions],
    ).update(deleted_at=None)
    existing_permission_ids = set(
        RolePermission.objects.filter(role=admin_role).values_list("permission_id", flat=True)
    )
    RolePermission.objects.bulk_create(
        [
            RolePermission(role=admin_role, permission=permission)
            for permission in Permission.objects.all()
            if permission.id not in existing_permission_ids
        ],
        ignore_conflicts=True,
    )
    if not UserRole.objects.filter(user=user, role=admin_role).exists():
        UserRole.objects.bulk_create([UserRole(user=user, role=admin_role)])
    print(f"Admin role ensured for {username}")
except Exception as exc:
    print(f"Could not ensure Admin role for {username}: {exc}")
PY

if [ "$#" -gt 0 ]; then
  echo "Running custom command: $*"
  exec "$@"
fi

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 config.wsgi:application
