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

echo "Creating superuser (if doesn't exist)..."
python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin / admin123')
else:
    print('Superuser already exists')
END

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:8000 --workers 4 --timeout 120 config.wsgi:application
