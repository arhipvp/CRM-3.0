"""Defer signal-driven Drive work while a workflow checkpoints its database state."""

from contextlib import contextmanager
from contextvars import ContextVar

_deferred = ContextVar("drive_folder_sync_deferred", default=False)


def folder_sync_deferred():
    return _deferred.get()


@contextmanager
def defer_folder_sync():
    token = _deferred.set(True)
    try:
        yield
    finally:
        _deferred.reset(token)
