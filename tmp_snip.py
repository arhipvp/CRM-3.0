from pathlib import Path
text = Path('scripts/import_business_data.py').read_text(encoding='utf-8')
idx = text.index(' tasks')
print(text[idx-60:idx+180])
