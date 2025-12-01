from pathlib import Path
text=Path('ToDo.md').read_text(encoding='utf-8')
print(repr(text))
