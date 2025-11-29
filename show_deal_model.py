from __future__ import annotations

import argparse
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Print a slice of the deals models file.")
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("backend/apps/deals/models.py"),
        help="Path to the models file",
    )
    parser.add_argument("--start", type=int, default=60, help="1-based start line")
    parser.add_argument("--count", type=int, default=100, help="Number of lines to display")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.file.exists():
        raise SystemExit(f"{args.file} not found")
    lines = args.file.read_text(encoding="utf-8").splitlines()
    start_idx = max(0, args.start - 1)
    end_idx = min(len(lines), start_idx + max(0, args.count))
    for line in lines[start_idx:end_idx]:
        print(line)


if __name__ == "__main__":
    main()
