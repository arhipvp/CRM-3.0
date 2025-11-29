from __future__ import annotations

import argparse
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Print a section of a SQL dump while escaping newlines for inspection."
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("backup_2025-11-24_15-20.sql"),
        help="SQL dump to inspect",
    )
    parser.add_argument(
        "--pattern",
        default="COPY public.deal",
        help="Text to find before printing context",
    )
    parser.add_argument(
        "--length",
        type=int,
        default=200,
        help="Number of characters to display after the match",
    )
    return parser.parse_args()


def escape_segment(text: str) -> str:
    output = []
    for ch in text:
        if ch == "\n":
            output.append("\\\\n")
        elif ch == "\r":
            output.append("\\\\r")
        else:
            output.append(ch)
    return "".join(output)


def main() -> None:
    args = parse_args()
    if not args.file.exists():
        raise SystemExit(f"{args.file} does not exist")
    content = args.file.read_text(encoding="utf-8")
    start = content.find(args.pattern)
    if start == -1:
        raise SystemExit(f'Pattern {args.pattern!r} not found')
    end = start + args.length
    segment = content[start:end]
    print(escape_segment(segment))


if __name__ == "__main__":
    main()
