import pathlib
path=pathlib.Path('frontend/src/components/views/DealsView.tsx')
text=path.read_text(encoding='utf-8')
start=text.index('            <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-6">')
print(text[start:start+1200])
