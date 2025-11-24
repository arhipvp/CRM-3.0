from pathlib import Path

lines = Path("backend/apps/deals/models.py").read_text(encoding="utf-8").splitlines()
for line in lines[60:160]:
    print(line)
