"""Private, sequential Polza benchmark. No ORM reads or CRM business writes.

Run as a module, or copy alongside benchmark_core.py to the private run directory
and execute with the production backend's Python. Credentials are stdin-only.
"""

import argparse
import base64
import copy
import hashlib
import json
import logging
import math
import os
import re
import sys
import tempfile
import time
from decimal import Decimal
from io import BytesIO
from pathlib import Path

import requests
from openai import APIConnectionError, APIStatusError, OpenAI
from PIL import Image


class _HttpxCompat:
    """Compatibility namespace for existing dry-run tests on minimal images."""

    Client = requests.Session


httpx = _HttpxCompat()

try:
    from .benchmark_core import (
        BudgetError,
        BudgetLedger,
        sanitize,
        score_prediction,
        should_retry,
    )
except ImportError:
    from benchmark_core import (
        BudgetError,
        BudgetLedger,
        sanitize,
        score_prediction,
        should_retry,
    )

BASE_URL = "https://polza.ai/api/v1"
MODELS = (
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "google/gemini-3.1-flash-lite",
    "google/gemini-3-flash-preview",
    "openai/gpt-4o-mini",
    "openai/gpt-4.1-mini",
    "openai/gpt-5-mini",
    "anthropic/claude-haiku-4.5",
    "qwen/qwen3-vl-30b-a3b-instruct",
    "qwen/qwen3-vl-235b-a22b-instruct",
)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def private_json(path, value, secrets=()):
    """Atomic writes prevent a half-written response from causing a duplicate call."""
    path = Path(path)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=".benchmark-")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(sanitize(value, secrets), handle, ensure_ascii=False, default=str)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def digest(value):
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def choose_routes(catalog):
    """Never silently substitute a model, currency, or unsupported tool route."""
    indexed = {item["id"]: item for item in catalog.get("data", [])}
    routes = {}
    for model in MODELS:
        item = indexed.get(model, {})
        if "image" not in item.get("architecture", {}).get("input_modalities", []):
            routes[model] = {"unavailable": "model_or_image_support_missing"}
            continue
        eligible = []
        for provider in item.get("providers", []):
            params = provider.get("supported_parameters", [])
            pricing = provider.get("pricing", {})
            if not {"tools", "tool_choice"}.issubset(params):
                continue
            try:
                rates = [
                    Decimal(pricing[key])
                    for key in (
                        "prompt_per_million",
                        "completion_per_million",
                    )
                ]
            except (KeyError, TypeError, ArithmeticError):
                continue
            if pricing.get("currency") != "RUB" or any(
                not rate.is_finite() or rate < 0 for rate in rates
            ):
                continue
            if not provider.get("name") or not provider.get("context_length"):
                continue
            eligible.append((sum(rates), provider["name"], provider))
        routes[model] = (
            min(eligible, key=lambda row: row[:2])[2]
            if eligible
            else {"unavailable": "compatible_priced_route_missing"}
        )
    return routes


def output_cap(model):
    # The benchmark corpus uses one known first installment per case. Keep the
    # cap large enough for structured JSON while making ten-model stage 1 fit
    # the explicit 300 RUB ceiling.
    return 512 if model == "openai/gpt-5-mini" else 384


def upper_cost(model, route, messages, function, extra_text_bytes=0):
    """Conservative byte tokenization + deliberately generous image ceilings.

    Bounds apply only to the fixed ten models. Base64 is excluded from text
    tokens. 4o-mini's expensive image tokenization is handled separately.
    """
    if model not in MODELS or "unavailable" in route:
        raise BudgetError("Unknown model or route")
    plain = copy.deepcopy(messages)
    image_tokens = 0
    for message in plain:
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if part.get("type") != "image_url":
                continue
            url = part["image_url"]["url"]
            if not url.startswith("data:image/"):
                raise BudgetError("Only frozen inline images are allowed")
            with Image.open(BytesIO(base64.b64decode(url.split(",", 1)[1]))) as image:
                width, height = image.size
            if max(width, height) > 2048:
                raise BudgetError("Image exceeds the production preprocessing limit")
            tiles = math.ceil(width / 512) * math.ceil(height / 512)
            image_tokens += (
                2833 + 5667 * max(tiles, 16)
                if model == "openai/gpt-4o-mini"
                else max(16384, width * height // (14 * 14) + 4096)
            )
            part["image_url"]["url"] = "[image]"
    text_tokens = (
        len(json.dumps([plain, function], ensure_ascii=False).encode("utf-8"))
        + extra_text_bytes
        + 4096
    )
    cap = output_cap(model)
    context_input_limit = int(route["context_length"]) - cap
    if context_input_limit <= 0:
        raise BudgetError("Route has no input capacity")
    # Bytes bound cost, not actual token count. A large UTF-8 source may fit
    # perfectly well; an admitted request cannot exceed the provider context.
    # Reserve the full admitted input ceiling rather than reject based on bytes.
    text_tokens = min(text_tokens, context_input_limit)
    image_tokens = min(image_tokens, context_input_limit)
    if cap > int(route.get("max_completion_tokens") or 0):
        raise BudgetError("Route output limit is too small")
    rates = route["pricing"]
    if image_tokens and rates.get("image_input_per_million") is None:
        raise BudgetError("This image request has no verified image price")
    image_rate = Decimal(rates.get("image_input_per_million") or "0")
    if not image_rate.is_finite() or image_rate < 0:
        raise BudgetError("Invalid image price")
    completion = max(
        Decimal(rates["completion_per_million"]),
        Decimal(rates.get("internal_reasoning_per_million") or "0"),
    )
    cost = (
        text_tokens * Decimal(rates["prompt_per_million"])
        + image_tokens * image_rate
        + cap * completion
    ) / Decimal(1000000)
    return (cost * Decimal("1.10")).quantize(Decimal("0.000001"))


def request_parameters(model, route, messages, function):
    params = {
        "model": model,
        "messages": messages,
        "tools": [{"type": "function", "function": function}],
        "tool_choice": {"type": "function", "function": {"name": function["name"]}},
        "stream": False,
        "extra_body": {
            "provider": {
                "only": [route["name"]],
                "allow_fallbacks": False,
                "require_parameters": True,
            }
        },
    }
    if "temperature" in route["supported_parameters"]:
        params["temperature"] = 0
    if model == "openai/gpt-5-mini":
        params["max_completion_tokens"] = output_cap(model)
        params["reasoning_effort"] = "minimal"
        params.pop("temperature", None)
    else:
        params["max_tokens"] = output_cap(model)
    return params


def response_cost(payload):
    """Do not interpret generic cost fields (often USD) as RUB."""
    value = payload.get("usage", {}).get("cost_rub")
    if value is None:
        return None
    try:
        value = Decimal(str(value))
    except ArithmeticError:
        return None
    return value if value.is_finite() and value >= 0 else None


def answer_text(payload):
    message = payload["choices"][0]["message"]
    calls = message.get("tool_calls") or []
    if calls:
        return calls[0]["function"]["arguments"]
    return message.get("content") or ""


class PaidCaller:
    def __init__(self, client, ledger):
        self.client = client
        self.ledger = ledger

    def call(self, request_id, upper_bound, parameters):
        record = self.ledger.get(request_id)
        if record:
            if record["state"] == "settled" and record.get("outcome") == "success":
                return record["result"]
            error = record.get("result") or {}
            if (
                record["state"] == "settled"
                and record.get("outcome") == "provider_error"
                and not request_id.endswith(":retry1")
                and should_retry(
                    0,
                    status_code=error.get("http_status"),
                    network_error=error.get("exception_type")
                    in {"APIConnectionError", "APITimeoutError"},
                )
            ):
                # Only after explicit reconciliation of the first charge.
                return self.call(request_id + ":retry1", upper_bound, parameters)
            raise BudgetError("Existing unsuccessful call needs billing reconciliation")
        self.ledger.reserve(request_id, upper_bound)
        started = time.monotonic()
        try:
            response = self.client.chat.completions.create(**parameters)
            payload = response.model_dump(mode="json")
        except (APIConnectionError, APIStatusError) as exc:
            # Network/HTTP errors may still be billed. No retry until the exact
            # charge is reconciled externally; an empty history is not proof of 0.
            self.ledger.settle(
                request_id,
                None,
                outcome="provider_error",
                result={
                    "exception_type": type(exc).__name__,
                    "http_status": getattr(exc, "status_code", None),
                    "provider_request_id": getattr(exc, "request_id", None),
                    "provider_error_body": getattr(exc, "body", None),
                },
            )
            raise BudgetError(
                "Provider error with unknown billing; run halted"
            ) from None
        result = {"response": payload, "seconds": time.monotonic() - started}
        cost = response_cost(payload)
        self.ledger.settle(request_id, cost, result=result)
        if cost is None:
            raise BudgetError("Response missing exact RUB cost; run halted")
        return result


def prepare_case(run_dir, case, context, ai):
    alias = case["id"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", alias):
        raise ValueError("Case IDs must be anonymous safe aliases")
    source = read_json(run_dir / alias / "source.json")
    text = str(source.get("extracted") or "")
    if source.get("poor"):
        messages, source_text = ai._build_vision_messages(
            [
                {
                    "name": "source.pdf",
                    "content": (run_dir / alias / "source.pdf").read_bytes(),
                    "text": "",
                }
            ]
        )
    else:
        source_text = text
        messages = [
            {"role": "system", "content": ""},
            {"role": "user", "content": text},
        ]
    messages[0]["content"] = context["extract_prompt"]
    return {
        "messages": messages,
        "source_text": source_text,
        "mode": "vision" if source.get("poor") else "text",
    }


def evaluate_answer(ai, answer, source_text, gold, reconcile=False):
    parsed = None
    raw_valid = False
    try:
        parsed = ai._parse_policy_answer(answer, validate_payload=False)
        try:
            ai._validate_policy_payload(parsed)
            raw_valid = True
        except Exception:
            pass
        normalized = copy.deepcopy(parsed)
        if reconcile:
            normalized = ai._reconcile_policy_vin(normalized, source_text)
        ai._validate_policy_payload(normalized)
        valid = True
        error = None
    except Exception as exc:
        normalized = parsed
        valid = False
        error = type(exc).__name__
    return {
        "parsed": parsed,
        "normalized": normalized,
        "valid": valid,
        "raw_valid": raw_valid,
        "validation_error": error,
        "score": score_prediction(parsed, gold, valid=raw_valid),
        "normalized_score": score_prediction(normalized, gold, valid=valid),
    }


def recognize(case, prepared, context, model, route, ai, caller, gold):
    function = context["function"]
    messages = prepared["messages"]
    initial_bound = upper_cost(model, route, messages, function)
    # The draft cannot exceed the completion cap; reserve generous UTF-8 space
    # for it plus verification instructions before starting the two-call unit.
    verify_template = copy.deepcopy(messages)
    verify_template[0]["content"] = context["verify_prompt"]
    verify_bound = upper_cost(
        model, route, verify_template, function, output_cap(model) * 16 + 8192
    )
    prefix = f"{case['id']}:{model}"
    if not caller.ledger.get(prefix + ":extract"):
        summary = caller.ledger.summary()
        if (
            summary["unresolved"]
            or summary["overrun"]
            or initial_bound + verify_bound > summary["remaining"]
        ):
            raise BudgetError("Two-call recognition does not fit remaining budget")
    initial = caller.call(
        prefix + ":extract",
        initial_bound,
        request_parameters(model, route, messages, function),
    )
    initial_evaluation = evaluate_answer(
        ai, answer_text(initial["response"]), prepared["source_text"], gold
    )
    draft = initial_evaluation["parsed"]
    if not isinstance(draft, dict):
        return {
            "initial": initial_evaluation,
            "final": initial_evaluation,
            "seconds": initial["seconds"],
            "status": "invalid_initial_json",
        }
    verify_text = ai._build_verification_message(
        prepared["source_text"], draft, ai._collect_formal_issues(draft)
    )
    visuals = ai._verification_visual_content(messages)
    verification = [
        {"role": "system", "content": context["verify_prompt"]},
        {
            "role": "user",
            "content": (
                [{"type": "text", "text": verify_text}, *visuals]
                if visuals
                else verify_text
            ),
        },
    ]
    actual_bound = upper_cost(model, route, verification, function)
    final = caller.call(
        prefix + ":verify",
        actual_bound,
        request_parameters(model, route, verification, function),
    )
    final_evaluation = evaluate_answer(
        ai,
        answer_text(final["response"]),
        prepared["source_text"],
        gold,
        reconcile=True,
    )
    return {
        "initial": initial_evaluation,
        "final": final_evaluation,
        "seconds": initial["seconds"] + final["seconds"],
        "status": "complete",
    }


def public_result(case, model, result, ledger):
    prefix = f"{case['id']}:{model}:"
    records = ledger._load()["requests"]
    cost = sum(
        (
            Decimal(row["actual_cost"])
            for key, row in records.items()
            if key.startswith(prefix) and row["state"] == "settled"
        ),
        Decimal(0),
    )
    return {
        "id": case["id"],
        "category": case["category"],
        "stage": case["stage"],
        "model": model,
        "cost_rub": str(cost),
        "seconds": result["seconds"],
        "status": result["status"],
        "initial": result["initial"]["score"],
        "final": result["final"]["score"],
        "normalized_final": result["final"]["normalized_score"],
    }


def selected_models(stage, summaries, manifest):
    if stage == 1:
        return list(MODELS)
    required = {case["id"] for case in manifest if case["stage"] == 1}
    ranking = []
    for model in MODELS[1:]:
        rows = [row for row in summaries if row["stage"] == 1 and row["model"] == model]
        if {row["id"] for row in rows} != required:
            continue
        category_scores = {}
        for row in rows:
            category_scores.setdefault(row["category"], []).append(
                row["final"]["score"]
            )
        quality = sum(
            sum(scores) / len(scores) for scores in category_scores.values()
        ) / len(category_scores)
        cost = sum(Decimal(row["cost_rub"]) for row in rows)
        ranking.append((-quality, cost, model))
    if len(ranking) < 2:
        raise BudgetError("Stage 2 needs two candidates with complete stage 1 results")
    return [MODELS[0], *[item[2] for item in sorted(ranking)[:2]]]


def read_billing(http, key):
    headers = {"Authorization": "Bearer " + key}
    response = http.get(BASE_URL + "/balance", headers=headers, timeout=30)
    response.raise_for_status()
    balance = response.json()
    available = Decimal(str(balance["available"]))
    if not available.is_finite() or available < 0:
        raise BudgetError("Unknown available RUB balance")
    history = http.get(
        BASE_URL + "/history/generations",
        headers=headers,
        params={"limit": 100, "page": 1},
        timeout=30,
    )
    history.raise_for_status()
    items = history.json()["items"]
    if not isinstance(items, list):
        raise BudgetError("Unknown billing history format")
    return {
        "available": str(available),
        "generations": [
            {key: row.get(key) for key in ("id", "model", "provider", "status", "cost")}
            for row in items
        ],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True, type=Path)
    parser.add_argument("--stage", type=int, choices=(1, 2), required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--key-stdin", action="store_true")
    args = parser.parse_args(argv)
    if not args.dry_run and not args.key_stdin:
        parser.error("Paid requests require --key-stdin")
    run_dir = args.run_dir.resolve()
    if not run_dir.is_dir():
        parser.error("Prepare the private corpus directory first")
    if os.name != "nt" and run_dir.stat().st_mode & 0o077:
        parser.error("Run directory must have mode 0700")
    # Suppress all application diagnostic logs in this separate process. Exact
    # inputs/outputs belong only in the run directory, never Docker stdout.
    logging.disable(logging.CRITICAL)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()
    from apps.policies import ai_service as ai

    key = sys.stdin.readline().strip() if args.key_stdin and not args.dry_run else ""
    if args.key_stdin and not args.dry_run and not key:
        parser.error("Empty benchmark credential")
    secrets = (key,) if key else ()
    context = read_json(run_dir / "context.json")
    manifest = read_json(run_dir / "manifest.json")
    gold = read_json(run_dir / "gold.json")
    if len({case["id"] for case in manifest}) != len(manifest):
        raise ValueError("Duplicate case IDs")
    if any(case["id"] not in gold for case in manifest):
        raise ValueError("Every document must have a frozen manual gold annotation")
    prepared = {}
    source_hashes = {}
    for case in manifest:
        alias = case["id"]
        prepared[alias] = prepare_case(run_dir, case, context, ai)
        source_hashes[alias] = hashlib.sha256(
            (run_dir / alias / "source.pdf").read_bytes()
        ).hexdigest()
    if len(set(source_hashes.values())) != len(source_hashes):
        raise ValueError("Duplicate source PDFs")
    frozen = {
        "context": digest(context),
        "manifest": digest(manifest),
        "gold": digest(gold),
        "sources": source_hashes,
        "prepared": digest(prepared),
    }
    frozen_path = run_dir / "frozen.json"
    with requests.Session() as http:
        catalog_response = http.get(
            BASE_URL + "/models",
            params={"type": "chat", "include_providers": "true"},
            timeout=30,
        )
        catalog_response.raise_for_status()
        catalog = catalog_response.json()
        routes_path = run_dir / "routes.json"
        if routes_path.exists():
            routes = read_json(routes_path)
            # Existing routes remain pinned; verify current prices and support.
            indexed = {row["id"]: row for row in catalog.get("data", [])}
            for model, route in routes.items():
                if "unavailable" in route:
                    continue
                live = next(
                    (
                        provider
                        for provider in indexed.get(model, {}).get("providers", [])
                        if provider.get("name") == route["name"]
                    ),
                    None,
                )
                if (
                    live is None
                    or live.get("pricing") != route.get("pricing")
                    or live.get("supported_parameters")
                    != route.get("supported_parameters")
                ):
                    raise BudgetError(
                        "Pinned route pricing or capabilities changed; review before resuming"
                    )
        else:
            routes = choose_routes(catalog)
            private_json(routes_path, routes)
            private_json(run_dir / "catalog.json", catalog)
        frozen.update(
            version=2,
            routes=digest(routes),
            runner_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            request_parameters=digest(
                {
                    model: request_parameters(model, route, [], context["function"])
                    for model, route in routes.items()
                    if "unavailable" not in route
                }
            ),
        )
        if frozen_path.exists() and read_json(frozen_path) != frozen:
            raise BudgetError(
                "Frozen corpus, gold, route or runner configuration changed"
            )
        private_json(frozen_path, frozen)
        private_json(run_dir / "prepared.json", prepared, secrets)
        ledger = BudgetLedger(run_dir / "ledger.json", secrets=secrets)
        summaries = (
            read_json(run_dir / "summary.json")
            if (run_dir / "summary.json").exists()
            else []
        )
        if args.stage == 2:
            required = {case["id"] for case in manifest if case["stage"] == 1}
            for model in MODELS:
                if (
                    "unavailable" not in routes[model]
                    and {
                        row["id"]
                        for row in summaries
                        if row["stage"] == 1 and row["model"] == model
                    }
                    != required
                ):
                    raise BudgetError("Complete stage 1 on every available model first")
        models = selected_models(args.stage, summaries, manifest)
        cases = [case for case in manifest if case["stage"] == args.stage]
        estimates = []
        for model in models:
            if "unavailable" in routes[model]:
                estimates.append({"model": model, **routes[model]})
                continue
            for case in cases:
                bound = upper_cost(
                    model,
                    routes[model],
                    prepared[case["id"]]["messages"],
                    context["function"],
                )
                verify = copy.deepcopy(prepared[case["id"]]["messages"])
                verify[0]["content"] = context["verify_prompt"]
                second = upper_cost(
                    model,
                    routes[model],
                    verify,
                    context["function"],
                    output_cap(model) * 16 + 8192,
                )
                estimates.append(
                    {
                        "model": model,
                        "id": case["id"],
                        "two_call_upper_rub": str(bound + second),
                        "token_count_method": "utf8_byte_upper_capped_to_route_context",
                        "exact_input_tokens_known": False,
                    }
                )
        private_json(run_dir / f"stage-{args.stage}-estimates.json", estimates)
        if args.dry_run:
            print(
                json.dumps(
                    {
                        "dry_run": True,
                        "cases": len(cases),
                        "models": len(models),
                        "available_models": sum(
                            "unavailable" not in routes[model] for model in models
                        ),
                        "paid_calls": 0,
                    }
                )
            )
            return 0
        billing = read_billing(http, key)
        private_json(run_dir / "billing-latest.json", billing, secrets)
        client = OpenAI(api_key=key, base_url=BASE_URL, max_retries=0, timeout=120)
        try:
            caller = PaidCaller(client, ledger)
            for case in cases:
                for model in models:
                    if "unavailable" in routes[model]:
                        continue
                    existing = next(
                        (
                            row
                            for row in summaries
                            if row["id"] == case["id"] and row["model"] == model
                        ),
                        None,
                    )
                    if existing:
                        continue
                    billing = read_billing(http, key)
                    private_json(run_dir / "billing-latest.json", billing, secrets)
                    estimate = next(
                        row
                        for row in estimates
                        if row.get("id") == case["id"] and row["model"] == model
                    )
                    if Decimal(billing["available"]) < Decimal(
                        estimate["two_call_upper_rub"]
                    ):
                        raise BudgetError(
                            "Two-call block exceeds provider available balance"
                        )
                    result = recognize(
                        case,
                        prepared[case["id"]],
                        context,
                        model,
                        routes[model],
                        ai,
                        caller,
                        gold[case["id"]],
                    )
                    name = case["id"] + "-" + model.replace("/", "__") + ".json"
                    private_json(run_dir / "results" / name, result, secrets)
                    public = public_result(case, model, result, ledger)
                    summaries.append(public)
                    private_json(run_dir / "summary.json", summaries)
                    print(
                        json.dumps(
                            {
                                "id": case["id"],
                                "model": model,
                                "status": result["status"],
                                "score": public["final"]["score"],
                                "spent_rub": str(ledger.summary()["spent"]),
                            }
                        ),
                        flush=True,
                    )
        finally:
            client.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        # No exception text: it may contain a provider payload or credentials.
        print(
            json.dumps({"halted": True, "reason_type": type(error).__name__}),
            flush=True,
        )
        sys.exit(2)
