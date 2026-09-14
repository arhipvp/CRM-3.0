"""Read-only production corpus preparation; never calls recognition or saves models.

Run this standalone script inside the backend environment. All output files are
private and must live under the existing diagnostics bind mount, outside the repo.
"""

import argparse
import hashlib
import json
import logging
import math
import os
import re
import tempfile
import time
from pathlib import Path


def private_bytes(path, content):
    """Atomically replace an artifact without exposing a partial/private file."""
    path = Path(path)
    if path.is_symlink():
        raise ValueError("Refusing a symlink artifact")
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def private_json(path, data):
    private_bytes(
        path,
        json.dumps(data, ensure_ascii=False, indent=2, default=str).encode("utf-8"),
    )


def validate_private_root(directory, allowed=None):
    """Only prepare preinitialized, unexpired, unfrozen private corpus runs."""
    raw_root = Path(directory)
    root = raw_root.resolve()
    allowed = Path(allowed or "/var/lib/crm3/ai-diagnostics").resolve()
    if (
        raw_root.is_symlink()
        or root.parent != allowed
        or not root.name.startswith("benchmark-")
        or not root.is_dir()
    ):
        raise SystemExit("Expected a preinitialized benchmark-* directory")
    marker = root / "expiry.json"
    try:
        if marker.is_symlink() or not marker.is_file():
            raise ValueError("Missing regular expiry marker")
        expires_at = json.loads(marker.read_text(encoding="utf-8"))["expires_at"]
        now = time.time()
        if (
            isinstance(expires_at, bool)
            or not isinstance(expires_at, (int, float))
            or not now < expires_at <= now + 7 * 86400
            or not math.isfinite(expires_at)
        ):
            raise ValueError("Expiry must be within the next seven days")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise SystemExit("A valid future seven-day expiry marker is required") from exc
    if any(
        (root / name).exists()
        for name in ("ledger.json", "ledger.json.lock", "frozen.json")
    ):
        raise SystemExit(
            "Corpus is frozen or has paid-call accounting; preparation refused"
        )
    os.chmod(root, 0o700)
    os.chmod(marker, 0o600)
    return root


def save_context(root, context):
    """Preserve the exact prompt snapshot across partial preparation resumes."""
    path = root / "context.json"
    if path.is_symlink():
        raise SystemExit("Context must not be a symlink")
    if path.exists():
        if json.loads(path.read_text(encoding="utf-8")) != context:
            raise SystemExit("Production context changed; use a new benchmark run")
        os.chmod(path, 0o600)
        return
    private_json(path, context)


def save_source(folder, content):
    """An interrupted slot can be resumed only with identical source bytes."""
    if folder.is_symlink():
        raise ValueError("Source folder must not be a symlink")
    folder.mkdir(mode=0o700, exist_ok=True)
    os.chmod(folder, 0o700)
    path = folder / "source.pdf"
    if path.is_symlink():
        raise ValueError("Source must not be a symlink")
    if (
        path.exists()
        and hashlib.sha256(path.read_bytes()).digest()
        != hashlib.sha256(content).digest()
    ):
        raise ValueError("Existing source cannot be replaced with a different document")
    private_bytes(path, content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory")
    parser.add_argument("--per-type", type=int, default=3)
    parser.add_argument("--category-index", type=int)
    args = parser.parse_args()
    os.umask(0o077)
    root = validate_private_root(args.directory)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()
    logging.disable(logging.CRITICAL)
    from apps.common.drive import download_drive_file, list_drive_folder_contents
    from apps.deals.models import InsuranceCompany, InsuranceType
    from apps.policies import ai_service as ai
    from apps.policies.models import Policy
    from django.conf import settings

    settings.AI_DIAGNOSTICS_ENABLED = False
    companies = list(
        InsuranceCompany.objects.order_by("name").values("name", "description")
    )
    types = list(InsuranceType.objects.order_by("name").values("name", "description"))
    save_context(
        root,
        {
            "companies": companies,
            "types": types,
            "extract_prompt": ai._build_prompt(companies, types),
            "verify_prompt": ai._build_prompt(companies, types, mode="verify"),
            "function": ai.POLICY_FUNCTION,
        },
    )
    categories = [
        "КАСКО",
        "ОСАГО",
        "Ипотека. Жизнь",
        "Ипотека. Жизнь + квартира",
        "Ипотека. Квартира",
    ]
    manifest = (
        json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        if (root / "manifest.json").exists()
        else []
    )
    hashes = {item["sha256"] for item in manifest}
    selected_policy_ids = {
        json.loads((root / item["id"] / "source.json").read_text(encoding="utf-8"))[
            "policy_id"
        ]
        for item in manifest
    }
    for category_index, category in enumerate(categories):
        if args.category_index is not None and category_index != args.category_index:
            continue
        selected = sum(item["category"] == category for item in manifest)
        seen_companies = set()
        policies = list(
            Policy.objects.filter(insurance_type__name__iexact=category)
            .exclude(drive_folder_id="")
            .exclude(drive_folder_id__isnull=True)
            .select_related("insurance_company")
            .order_by("-created_at")[:60]
        )
        # Prefer insurer diversity without excluding fallback candidates.
        ordered = []
        for policy in policies:
            if policy.insurance_company_id not in seen_companies:
                ordered.append(policy)
                seen_companies.add(policy.insurance_company_id)
        ordered += [p for p in policies if p not in ordered]
        for policy in ordered:
            if selected >= args.per_type:
                break
            if str(policy.pk) in selected_policy_ids:
                continue
            try:
                files = list_drive_folder_contents(policy.drive_folder_id)
                candidates = [
                    f
                    for f in files
                    if not f["is_folder"]
                    and f["name"].lower().endswith(".pdf")
                    and not re.search(
                        r"квитанц|заявлен|памятк|правила|согласие|чек|уведомлен",
                        f["name"],
                        re.I,
                    )
                ]
                candidates.sort(
                    key=lambda f: (
                        not bool(re.search(r"полис|договор|policy", f["name"], re.I)),
                        f["name"],
                    )
                )
                for file_info in candidates[:2]:
                    content = download_drive_file(file_info["id"])
                    digest = hashlib.sha256(content).hexdigest()
                    if digest in hashes or not content.startswith(b"%PDF"):
                        continue
                    import pymupdf

                    with pymupdf.open(stream=content, filetype="pdf") as doc:
                        if len(doc) > 20:
                            continue
                        pages = [page.get_text() for page in doc]
                        alias = f"c{category_index + 1}-{selected + 1}"
                        folder = root / alias
                        save_source(folder, content)
                        for page_index, page in enumerate(doc):
                            rendered = page.get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3))
                            private_bytes(
                                folder / f"page-{page_index + 1}.png",
                                rendered.tobytes("png"),
                            )
                    extracted = ai.extract_text_from_bytes(content, "source.pdf")
                    poor = ai.is_extracted_policy_text_poor(extracted)
                    private_json(
                        folder / "source.json",
                        {
                            "pages": pages,
                            "extracted": extracted,
                            "poor": poor,
                            "filename": file_info["name"],
                            "file_id": file_info["id"],
                            "policy_id": str(policy.pk),
                        },
                    )
                    manifest.append(
                        {
                            "id": alias,
                            "category": category,
                            "sha256": digest,
                            "pages": len(pages),
                            "text_chars": len(extracted),
                            "poor": poor,
                            "company": str(policy.insurance_company),
                            "stage": 1 if selected == 0 else 2,
                        }
                    )
                    hashes.add(digest)
                    selected_policy_ids.add(str(policy.pk))
                    selected += 1
                    private_json(root / "manifest.json", manifest)
                    print(
                        json.dumps(
                            {
                                "id": alias,
                                "category": category,
                                "pages": len(pages),
                                "text_chars": len(extracted),
                                "poor": poor,
                            },
                            ensure_ascii=True,
                        ),
                        flush=True,
                    )
                    break
            except Exception as exc:
                print(
                    json.dumps(
                        {
                            "category_index": category_index,
                            "preparation_error": type(exc).__name__,
                        }
                    ),
                    flush=True,
                )
        if selected < args.per_type:
            print(
                json.dumps(
                    {"category": category, "shortfall": args.per_type - selected},
                    ensure_ascii=True,
                ),
                flush=True,
            )


if __name__ == "__main__":
    main()
