import argparse
import sys
from pathlib import Path
from typing import Iterable, Sequence, Set

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / 'vendor'))
import ftfy  # type: ignore[attr-defined]

DEFAULT_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx'}


def fix_file(path: Path) -> bool:
    """Apply ftfy repeatedly until the text stops changing, then rewrite file."""

    with path.open('r', encoding='latin1', newline='') as handle:
        original = handle.read()
    fixed = original
    for _ in range(3):
        next_fixed = ftfy.fix_text(fixed)
        if next_fixed == fixed:
            break
        fixed = next_fixed
    if fixed == original:
        return False
    with path.open('w', encoding='utf-8', newline='') as handle:
        handle.write(fixed)
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fix mojibake in frontend source files using the packaged ftfy."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("frontend/src"),
        help="Project subdirectory to scan (default: frontend/src)",
    )
    parser.add_argument(
        "--extensions",
        nargs="+",
        default=sorted(DEFAULT_EXTENSIONS),
        help="List of extensions to process (default: .ts .tsx .js .jsx)",
    )
    return parser.parse_args()


def normalize_extensions(raw: Sequence[str]) -> Set[str]:
    normalized: Set[str] = set()
    for ext in raw:
        if not ext:
            continue
        candidate = ext if ext.startswith(".") else f".{ext}"
        normalized.add(candidate.lower())
    return normalized or DEFAULT_EXTENSIONS


def enumerate_sources(root: Path, extensions: Set[str]) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.is_dir():
            continue
        if "node_modules" in path.parts:
            continue
        if path.suffix.lower() not in extensions:
            continue
        yield path


def main() -> None:
    args = parse_args()
    extensions = normalize_extensions(args.extensions)
    root = args.root.resolve()
    changed_files: list[str] = []
    for path in enumerate_sources(root, extensions):
        if fix_file(path):
            changed_files.append(str(path))
    if changed_files:
        print("Fixed encoding in:")
        for path in changed_files:
            print(" -", path)
    else:
        print("No changes applied.")


if __name__ == "__main__":
    main()
