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
    user.save()
    print(f"Superuser {username} password reset")
PY

if [ "$#" -gt 0 ]; then
  echo "Running custom command: $*"
  exec "$@"
fi

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 config.wsgi:application
