from pathlib import Path
path = Path('frontend/src/AppContent.tsx').read_text(encoding='utf-8').splitlines()
for i,line in enumerate(path,1):
    if 'handleAddClient' in line:
        print(i, line.strip())
