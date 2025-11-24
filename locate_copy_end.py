from pathlib import Path

text = Path("backup_2025-11-24_15-20.sql").read_text(encoding="utf-8")
start = text.index("COPY public.deal")
for idx, line in enumerate(text[start:].splitlines(), 1):
    if line.strip() == "\\.":
        print("line", idx, "found")
        break
else:
    print("terminator not found")
