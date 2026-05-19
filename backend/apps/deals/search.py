import re
import uuid
from urllib.parse import unquote

from django.db.models import Q


def build_phone_search_query(term: str) -> Q | None:
    digits_only = re.sub(r"\D", "", term)
    if len(digits_only) < 4:
        return None
    pattern = r"[^0-9]*".join(re.escape(ch) for ch in digits_only)
    return Q(client__phone__iregex=pattern)


def build_uuid_search_query(term: str) -> Q | None:
    try:
        return Q(id=uuid.UUID(term))
    except ValueError:
        return None


def needs_unicode_regex_search(term: str) -> bool:
    return any(ord(ch) > 127 for ch in term)


def build_search_query(search_term: str, search_fields: list[str]) -> Q | None:
    terms = []
    for raw_term in search_term.strip().split():
        normalized = unquote(raw_term).lstrip("#").strip()
        if normalized:
            terms.append(normalized)
    if not terms or not search_fields:
        return None

    combined_query: Q | None = None
    for term in terms:
        term_query = Q()
        use_unicode_regex = needs_unicode_regex_search(term)
        for field in search_fields:
            term_query |= Q(**{f"{field}__icontains": term})
            if use_unicode_regex:
                term_query |= Q(**{f"{field}__iregex": re.escape(term)})
        uuid_query = build_uuid_search_query(term)
        if uuid_query is not None:
            term_query |= uuid_query
        phone_query = build_phone_search_query(term)
        if phone_query is not None:
            term_query |= phone_query
        combined_query = (
            term_query if combined_query is None else combined_query & term_query
        )

    return combined_query
