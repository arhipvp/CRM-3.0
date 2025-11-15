import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / 'vendor'))
import ftfy  # type: ignore[attr-defined]


EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx'}


def fix_file(path: Path) -> bool:
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


def main() -> None:
    base_dir = Path('frontend/src')
    changed_files = []
    for path in base_dir.rglob('*'):
        if path.is_dir():
            continue
        if 'node_modules' in path.parts:
            continue
        if path.suffix not in EXTENSIONS:
            continue
        if fix_file(path):
            changed_files.append(str(path))
    if changed_files:
        print('Fixed encoding in:')
        for path in changed_files:
            print(' -', path)
    else:
        print('No changes applied.')


if __name__ == '__main__':
    main()
