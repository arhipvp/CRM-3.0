"""Check database safety settings in normalized Docker Compose JSON."""

from __future__ import annotations

import ipaddress
import json
import sys
from typing import Any


def validate_production_compose(config: Any) -> list[str]:
    if not isinstance(config, dict):
        return ["Production Compose must be a JSON object."]
    services = config.get("services")
    if not isinstance(services, dict) or not isinstance(services.get("db"), dict):
        return ["Production Compose must define the db service."]

    database = services["db"]
    errors = []
    if database.get("restart") != "unless-stopped":
        errors.append("The db service must use restart: unless-stopped.")
    if database.get("network_mode") == "host":
        errors.append("The db service must not use host networking.")

    ports = database.get("ports", [])
    if not isinstance(ports, list):
        return [*errors, "Database ports must be normalized Compose port objects."]
    for binding in ports:
        host_ip = binding.get("host_ip") if isinstance(binding, dict) else None
        try:
            is_loopback = (
                isinstance(host_ip, str) and ipaddress.ip_address(host_ip).is_loopback
            )
        except ValueError:
            is_loopback = False
        if not is_loopback:
            errors.append("Every published database port must bind to a loopback IP.")
    return errors


def main() -> int:
    try:
        config = json.load(sys.stdin)
    except (ValueError, OSError):
        print("Could not read normalized Compose JSON.", file=sys.stderr)
        return 1
    errors = validate_production_compose(config)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print("Production database restart and network settings are safe.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
