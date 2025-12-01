from pathlib import Path
path=Path('ToDo.md')
data=path.read_bytes()
try:
    decoded=data.decode('utf-8')
except UnicodeDecodeError:
    decoded=data.decode('cp1251')
path.write_text(decoded, encoding='utf-8')
print(decoded)
