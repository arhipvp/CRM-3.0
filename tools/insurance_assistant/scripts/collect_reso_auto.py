"""Download current public RESO auto-insurance PDFs and add them to local RAG.

Only reso.ru and storage.reso.ru are accepted.  The manifest is local data and
records origin URL, title, content hash, and indexing result for repeatability.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

TOOL_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("INSURANCE_ASSISTANT_DATA_DIR", TOOL_ROOT / "data")) / "sources" / "reso_auto"
MANIFEST_PATH = DATA_DIR / "manifest.json"
RAG_API = os.getenv("INSURANCE_ASSISTANT_SEED_API", "http://127.0.0.1:8765/api/documents")
ALLOWED_HOSTS = {"reso.ru", "www.reso.ru", "storage.reso.ru"}
SEED_PAGES = (
    "https://reso.ru/individual/auto/osago/official/",
    "https://reso.ru/individual/auto/bluecard/",
    "https://reso.ru/individual/auto/dgo/",
    "https://reso.ru/individual/auto/hishenie/",
    "https://reso.ru/individual/auto/kasko/",
    "https://reso.ru/individual/auto/kasko/gap/",
    "https://reso.ru/individual/auto/kasko/kasko-prophy/",
    "https://reso.ru/individual/auto/kasko/kasko-vip/",
    "https://reso.ru/individual/auto/kasko/resoavto-pomosh/",
    "https://reso.ru/individual/auto/kasko/sputnik/",
    "https://reso.ru/individual/auto/osago/",
    "https://reso.ru/individual/auto/osago/prolong/",
)
# Current documents from the general rules catalogue which are relevant to a car
# owner, but are not necessarily linked from a product landing page.
EXTRA_PDF_SOURCES = (
    (
        "Индивидуальные условия страхования от несчастных случаев водителя и пассажиров транспортного средства (действуют с 30.05.2025 г.)",
        "https://reso.ru/about/rules/individual/auto/ind-cond-ns-drive-passanger-20250530-bt.pdf",
    ),
    (
        "Правила страхования в рамках системы обязательного страхования гражданской ответственности владельцев транспортных средств Союзного государства (действуют с 01.01.2025 г.)",
        "https://reso.ru/about/rules/individual/auto/transportnyh-sredstv-SSG.pdf",
    ),
    (
        "Правила страхования непредвиденных расходов владельцев транспортных средств (действуют с 01.04.2023 г.)",
        "https://reso.ru/about/rules/corporate/auto/rashodov_vladeltsev_ts_01-04-2023.pdf",
    ),
    (
        "Правила страхования гражданской ответственности автовладельцев (действуют с 01.04.2023 г.)",
        "https://reso.ru/about/rules/corporate/auto/go-avtovladeltsev-01-04-2023.pdf",
    ),
    (
        "Правила страхования финансовых рисков владельцев транспортных средств (действуют с 04.08.2019 г.)",
        "https://reso.ru/about/rules/tariffs_rules/financial_risks_for_car_owners_with-tariffs_30072019.pdf",
    ),
)
INSTRUCTION_SOURCES = (
    (
        "РЕСО-Гарантия: заявление о страховом случае по ОСАГО",
        "https://reso.ru/incase/osago/",
    ),
    (
        "РЕСО-Гарантия: ОСАГО — оформление и урегулирование",
        "https://reso.ru/individual/auto/osago/",
    ),
    (
        "РЕСО-Гарантия: КАСКО — оформление и урегулирование",
        "https://reso.ru/individual/auto/kasko/",
    ),
)
CURRENT_AUTO = re.compile(
    r"(авто|автотранспорт|транспортн.*средств|осаго|каско|дго|синяя карта|"
    r"водител|пассажир|убыт|дтп|гражд.*ответственност.*владельц)",
    re.IGNORECASE,
)
ARCHIVE = re.compile(r"действовал|архив", re.IGNORECASE)


@dataclass(frozen=True)
class Source:
    title: str
    page_url: str
    pdf_url: str
    kind: str = "pdf"


@dataclass
class ManifestEntry:
    title: str
    page_url: str
    pdf_url: str
    sha256: str
    filename: str
    document_id: str | None = None
    status: str | None = None


def _normalise_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed._replace(fragment="").geturl()


def _safe_name(title: str, digest: str, extension: str) -> str:
    stem = re.sub(r"[^a-zа-яё0-9]+", "-", title.lower()).strip("-")
    return f"reso-{digest[:12]}-{stem[:80] or 'document'}.{extension}"


def discover(client: httpx.Client) -> list[Source]:
    pages = list(SEED_PAGES)
    discovered: dict[str, Source] = {}
    visited: set[str] = set()
    while pages:
        page_url = _normalise_url(pages.pop(0))
        if page_url in visited:
            continue
        visited.add(page_url)
        try:
            response = client.get(page_url)
            response.raise_for_status()
        except httpx.HTTPError as error:
            print(f"Пропущена страница РЕСО {page_url}: {error}")
            continue
        soup = BeautifulSoup(response.text, "html.parser")
        for link in soup.select("a[href]"):
            target = _normalise_url(urljoin(page_url, link["href"]))
            parsed = urlparse(target)
            if parsed.hostname not in ALLOWED_HOSTS:
                continue
            if parsed.path.endswith(".pdf"):
                context = link.parent.parent.get_text(" ", strip=True)
                title = (
                    context or link.get_text(" ", strip=True) or Path(parsed.path).stem
                )
                if CURRENT_AUTO.search(title) and not ARCHIVE.search(title):
                    discovered[target] = Source(title, page_url, target)
        time.sleep(0.3)
    for title, pdf_url in EXTRA_PDF_SOURCES:
        discovered.setdefault(
            pdf_url, Source(title, "https://reso.ru/about/rules/", pdf_url)
        )
    return list(discovered.values())


def discover_instructions() -> list[Source]:
    return [Source(title, url, url, kind="html") for title, url in INSTRUCTION_SOURCES]


def _instruction_html(source: Source, response: httpx.Response) -> bytes:
    """Persist only readable page text; navigation and scripts are not RAG sources."""
    soup = BeautifulSoup(response.text, "html.parser")
    content = soup.select_one("main") or soup.select_one("article") or soup.body
    if content is None:
        raise ValueError(f"РЕСО вернул пустую страницу: {source.pdf_url}")
    for node in content.select("script, style, nav, header, footer, form, button, svg"):
        node.decompose()
    text = "\n".join(line.strip() for line in content.stripped_strings if line.strip())
    if len(text) < 200:
        raise ValueError(f"Недостаточно текста в инструкции РЕСО: {source.pdf_url}")
    safe_title = BeautifulSoup(source.title, "html.parser").get_text()
    return (
        f"<html><body><h1>{safe_title}</h1><p>Официальный источник: "
        f"{source.pdf_url}</p><pre>{text}</pre></body></html>"
    ).encode("utf-8")


def load_manifest() -> dict[str, ManifestEntry]:
    if not MANIFEST_PATH.exists():
        return {}
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {item["pdf_url"]: ManifestEntry(**item) for item in data}


def save_manifest(entries: dict[str, ManifestEntry]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(
            [asdict(item) for item in entries.values()], ensure_ascii=False, indent=2
        ),
        encoding="utf-8",
    )


def upload(client: httpx.Client, path: Path) -> str:
    content_type = "application/pdf" if path.suffix.lower() == ".pdf" else "text/html"
    with path.open("rb") as file:
        response = client.post(
            RAG_API,
            files={"files": (path.name, file, content_type)},
            headers=_rag_headers(),
        )
    response.raise_for_status()
    return response.json()[0]["id"]


def wait_for_index(client: httpx.Client, document_id: str) -> str:
    for _ in range(180):
        documents = client.get(RAG_API, headers=_rag_headers()).json()
        document = next(item for item in documents if item["id"] == document_id)
        if document["status"] in {"ready", "failed"}:
            if document["status"] == "failed":
                raise RuntimeError(
                    document.get("error") or "Индексация завершилась ошибкой"
                )
            return document["status"]
        time.sleep(1)
    raise TimeoutError("Индексация РЕСО не завершилась за 3 минуты")


def _rag_headers() -> dict[str, str]:
    token = os.getenv("INSURANCE_ASSISTANT_INTERNAL_TOKEN", "")  # pragma: allowlist secret
    if not token:
        return {}
    return {
        "X-Insurance-Assistant-Token": token,
        "X-CRM-User-Id": os.getenv("INSURANCE_ASSISTANT_SEED_OWNER_ID", "seed"),
    }


def collect(*, upload_to_rag: bool) -> tuple[int, int]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    added = skipped = 0
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        for source in [*discover(client), *discover_instructions()]:
            if source.pdf_url in manifest:
                skipped += 1
                continue
            response = client.get(source.pdf_url)
            response.raise_for_status()
            if source.kind == "pdf":
                content = response.content
                if not content.startswith(b"%PDF"):
                    raise ValueError(f"РЕСО вернул не PDF: {source.pdf_url}")
                extension = "pdf"
            else:
                content = _instruction_html(source, response)
                extension = "html"
            digest = hashlib.sha256(content).hexdigest()
            path = DATA_DIR / _safe_name(source.title, digest, extension)
            path.write_bytes(content)
            entry = ManifestEntry(
                title=source.title,
                page_url=source.page_url,
                pdf_url=source.pdf_url,
                sha256=digest,
                filename=path.name,
            )
            if upload_to_rag:
                entry.document_id = upload(client, path)
                entry.status = wait_for_index(client, entry.document_id)
            manifest[source.pdf_url] = entry
            save_manifest(manifest)
            added += 1
            time.sleep(0.3)
    return added, skipped


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--discover-only", action="store_true")
    args = parser.parse_args()
    if args.discover_only:
        with httpx.Client(
            timeout=httpx.Timeout(20, connect=10), follow_redirects=True
        ) as client:
            sources = discover(client)
        print(f"РЕСО авто: найдено актуальных PDF: {len(sources)}")
        for source in sources:
            print(f"- {source.title}: {source.pdf_url}")
        return
    added, skipped = collect(upload_to_rag=True)
    print(f"РЕСО авто: добавлено {added}, без изменений {skipped}")


if __name__ == "__main__":
    main()
