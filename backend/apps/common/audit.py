"""Request-local and explicitly scoped audit identities."""

from contextlib import contextmanager
from contextvars import ContextVar

_request = ContextVar("audit_request", default=None)
_actor = ContextVar("audit_actor", default=None)


def get_scoped_actor():
    return _actor.get()


def get_audit_actor():
    actor = get_scoped_actor()
    if actor is None:
        request = _request.get()
        actor = getattr(request, "user", None)
    return actor if actor is not None and actor.is_authenticated else None


@contextmanager
def audit_context(user):
    token = _actor.set(user)
    try:
        yield
    finally:
        _actor.reset(token)


@contextmanager
def audit_request_context(request):
    # Keep the request: DRF authenticates after middleware has been entered.
    token = _request.set(request)
    try:
        yield
    finally:
        _request.reset(token)


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        with audit_request_context(request):
            return self.get_response(request)
