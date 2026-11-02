from dataclasses import dataclass
from typing import Any

SCOPES = {
    "crm.read": "Read CRM records",
    "crm.write": "Create and update CRM records",
    "crm.destructive": "Apply previewed sensitive changes",
    "crm.files": "Read and manage authorized CRM files",
    "crm.mail": "Read and synchronize deal mail",
    "crm.ai": "Use the existing CRM AI assistant",
}


def default_scopes():
    return list(SCOPES)


@dataclass(frozen=True)
class Principal:
    user: Any
    client_id: str
    scopes: frozenset[str]
    token_id: int | None = None
