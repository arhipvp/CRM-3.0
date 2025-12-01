from pathlib import Path
text=Path('ToDo.md').read_bytes().decode('cp1251')
print(text)
print('---repr---')
print(repr(text))
