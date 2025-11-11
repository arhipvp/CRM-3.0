"""
Pytest configuration and fixtures for testing.
"""

import pytest
from django.contrib.auth.models import User
from django.test import Client
from apps.users.models import Role, Permission, UserRole
import factory


# ============ FACTORIES ============

class UserFactory(factory.django.DjangoModelFactory):
    """Factory for creating test users."""
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda o: f'{o.username}@example.com')
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')

    @classmethod
    def create_superuser(cls, **kwargs):
        """Create a superuser."""
        kwargs.setdefault('username', 'admin')
        kwargs.setdefault('email', 'admin@example.com')
        kwargs.setdefault('password', 'admin123')
        return User.objects.create_superuser(**kwargs)


class RoleFactory(factory.django.DjangoModelFactory):
    """Factory for creating test roles."""
    class Meta:
        model = Role

    name = factory.Sequence(lambda n: f'Role {n}')
    description = factory.Faker('text', max_nb_chars=100)


class PermissionFactory(factory.django.DjangoModelFactory):
    """Factory for creating test permissions."""
    class Meta:
        model = Permission

    resource = factory.Faker('random_element', elements=['deal', 'client', 'task', 'document'])
    action = factory.Faker('random_element', elements=['view', 'create', 'edit', 'delete'])


# ============ FIXTURES ============

@pytest.fixture
def admin_user(db):
    """Create and return a superuser for testing."""
    user = UserFactory.create_superuser(username='admin', password='admin123')
    return user


@pytest.fixture
def regular_user(db):
    """Create and return a regular user for testing."""
    user = UserFactory.create(username='testuser', password='testpass123')
    user.set_password('testpass123')
    user.save()
    return user


@pytest.fixture
def client():
    """Return Django test client."""
    return Client()


@pytest.fixture
def admin_client(client, admin_user):
    """Return authenticated admin client."""
    client.force_login(admin_user)
    return client


@pytest.fixture
def user_client(client, regular_user):
    """Return authenticated regular user client."""
    client.force_login(regular_user)
    return client


@pytest.fixture
def role(db):
    """Create and return a test role."""
    return RoleFactory.create(name='Test Role')


@pytest.fixture
def permission(db):
    """Create and return a test permission."""
    return PermissionFactory.create(resource='deal', action='view')


@pytest.fixture
def user_with_role(db):
    """Create a user with a role."""
    user = UserFactory.create(username='user_with_role')
    user.set_password('password123')
    user.save()

    role = RoleFactory.create(name='Manager')
    UserRole.objects.create(user=user, role=role)

    return user
