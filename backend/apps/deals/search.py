import re

from django.db.models import Q


def build_phone_search_query(term: str) -> Q | None:
    digits_only = re.sub(r"\D", "", term)
    if len(digits_only) < 2:
        return None
    pattern = r"\D*".join(re.escape(ch) for ch in digits_only)
    return Q(client__phone__iregex=pattern)


def build_search_query(search_term: str, search_fields: list[str]) -> Q | None:
    terms = []
    for raw_term in search_term.strip().split():
        normalized = raw_term.lstrip("#").strip()
        if normalized:
            terms.append(normalized)
    if not terms or not search_fields:
        return None

    combined_query: Q | None = None
    for term in terms:
        term_query = Q()
        for field in search_fields:
            term_query |= Q(**{f"{field}__icontains": term})
        phone_query = build_phone_search_query(term)
        if phone_query is not None:
            term_query |= phone_query
        combined_query = (
            term_query if combined_query is None else combined_query & term_query
        )

    return combined_query
