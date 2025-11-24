from pathlib import Path

lines = Path("backup_2025-11-24_15-20.sql").read_text(encoding="utf-8").splitlines()
start_idx = next(i for i, line in enumerate(lines) if line.startswith("COPY public.deal"))
end_idx = next(i for i in range(start_idx, len(lines)) if lines[i].strip() == "\\.")
for line in lines[start_idx : start_idx + 20]:
    print(line)
