import pathlib
text=pathlib.Path('frontend/src/components/views/DealsView.tsx').read_text(encoding='utf-8')
lines=text.splitlines()
for target in ['const dealEvents = useMemo', 'const eventWindow = useMemo', 'const handleDelayModalConfirm']:
    for idx,line in enumerate(lines, start=1):
        if target in line:
            print(target, idx)
            break
