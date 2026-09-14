"""Install/check narrowly scoped seven-day expiry for private benchmark data."""

import argparse
import json
import math
import os
import shutil
import time
from pathlib import Path

BASE = Path("/var/lib/crm3/ai-diagnostics")
CRON = Path("/etc/cron.d/crm3-ai-benchmark-expiry")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--initialize")
    args = parser.parse_args()
    os.umask(0o077)
    if args.initialize:
        target = BASE / args.initialize
        if not target.name.startswith("benchmark-") or target.resolve().parent != BASE:
            raise SystemExit("Unsafe benchmark path")
        target.mkdir(mode=0o700, exist_ok=False)
        (target / "expiry.json").write_text(
            json.dumps({"expires_at": time.time() + 7 * 86400}), encoding="utf-8"
        )
        if not CRON.exists():
            CRON.write_text(
                "* * * * * root /usr/bin/python3 "
                "/var/lib/crm3/ai-diagnostics/benchmark_expiry.py\n",
                encoding="utf-8",
            )
        print("Private directory and minute-resolution seven-day expiry initialized")
        return
    for target in BASE.glob("benchmark-*"):
        if (
            target.is_symlink()
            or not target.is_dir()
            or target.resolve().parent != BASE
        ):
            continue
        marker = target / "expiry.json"
        if not marker.is_file() or marker.is_symlink():
            continue
        try:
            expires_at = json.loads(marker.read_text(encoding="utf-8"))["expires_at"]
            if (
                isinstance(expires_at, bool)
                or not isinstance(expires_at, (int, float))
                or not 0 < expires_at <= time.time() + 7 * 86400
                or not math.isfinite(expires_at)
            ):
                raise ValueError("Invalid expiry timestamp")
        except (OSError, ValueError, KeyError, TypeError):
            print(
                "Skipped invalid benchmark expiry marker; administrator review required"
            )
            continue
        if time.time() >= expires_at:
            try:
                shutil.rmtree(target)
            except OSError:
                print("Benchmark expiry removal failed; administrator review required")


if __name__ == "__main__":
    main()
