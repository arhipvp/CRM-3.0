from pathlib import Path

text = Path("backup_2025-11-24_15-20.sql").read_text(encoding="utf-8")
start = text.index("COPY public.deal")
segment = text[start:start+200]
for i, ch in enumerate(segment):
    if ch == "\n":
        print("\\n", end="")
    elif ch == "\r":
        print("\\r", end="")
    else:
        print(ch, end="")
