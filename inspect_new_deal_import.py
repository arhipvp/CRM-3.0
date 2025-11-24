from pathlib import Path

lines = Path("deal_import.sql").read_text(encoding="utf-8").splitlines()
for idx in range(830, 850):
    print(idx + 1, lines[idx])
