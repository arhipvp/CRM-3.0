import { useState } from 'react';

import type { AiCatalog, AiScopeBranch } from '../../../api/aiAssistant';

const libraryBranchKey = (branch: AiScopeBranch | null) => {
  if (!branch) return 'all';
  if (branch.unclassified) return 'unclassified';
  return [branch.insurer, branch.insurance_kind, branch.product].filter(Boolean).join('::');
};

export function AiLibraryTree({
  catalog,
  selected,
  onSelect,
}: {
  catalog: AiCatalog;
  selected: AiScopeBranch | null;
  onSelect: (branch: AiScopeBranch | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isSelected = (branch: AiScopeBranch | null) =>
    libraryBranchKey(branch) === libraryBranchKey(selected);
  const toggle = (key: string) =>
    setExpanded((items) => {
      const next = new Set(items);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <aside className="self-start rounded border border-[var(--app-border)] bg-white p-3 xl:sticky xl:top-4">
      <h2 className="font-semibold">Папки</h2>
      <p className="mt-1 text-xs text-slate-500">Общий каталог источников.</p>
      <nav className="mt-3 max-h-[calc(100vh-14rem)] space-y-1 overflow-y-auto pr-1 text-sm">
        <FolderButton
          label={`Вся библиотека (${catalog.total})`}
          selected={isSelected(null)}
          onClick={() => onSelect(null)}
        />
        <FolderButton
          label={`Нераспределено (${catalog.unclassified})`}
          selected={isSelected({ unclassified: true })}
          onClick={() => onSelect({ unclassified: true })}
        />
        {catalog.insurers.map((insurer) => {
          const insurerBranch = { insurer: insurer.name };
          const insurerKey = `insurer:${insurer.name}`;
          const insurerExpanded = expanded.has(insurerKey);
          return (
            <div key={insurer.name} className="pt-1">
              <FolderRow
                label={`${insurer.name} (${insurer.count})`}
                selected={isSelected(insurerBranch)}
                expanded={insurerExpanded}
                onToggle={() => toggle(insurerKey)}
                onSelect={() => onSelect(insurerBranch)}
              />
              {insurerExpanded && (
                <div className="ml-3 border-l border-slate-200 pl-2">
                  {insurer.kinds.map((kind) => {
                    const kindBranch = { insurer: insurer.name, insurance_kind: kind.name };
                    const kindKey = `${insurerKey}:kind:${kind.name}`;
                    const kindExpanded = expanded.has(kindKey);
                    return (
                      <div key={kind.name} className="pt-1">
                        <FolderRow
                          label={`${kind.name} (${kind.count})`}
                          selected={isSelected(kindBranch)}
                          expanded={kindExpanded}
                          onToggle={() => toggle(kindKey)}
                          onSelect={() => onSelect(kindBranch)}
                        />
                        {kindExpanded && (
                          <div className="ml-3 border-l border-slate-200 pl-2">
                            {kind.products.map((product) => {
                              const productBranch = {
                                insurer: insurer.name,
                                insurance_kind: kind.name,
                                product: product.name,
                              };
                              return (
                                <FolderButton
                                  key={product.name}
                                  label={`${product.name} (${product.count})`}
                                  selected={isSelected(productBranch)}
                                  onClick={() => onSelect(productBranch)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function FolderRow({
  label,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  label: string;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className={`flex items-center rounded ${selected ? 'bg-[var(--app-brand-50)]' : ''}`}>
      <button
        type="button"
        aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} ${label}`}
        onClick={onToggle}
        className="w-6 shrink-0 text-slate-500 hover:text-slate-900"
      >
        {expanded ? '▾' : '▸'}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate px-1 py-1.5 text-left"
      >
        {label}
      </button>
    </div>
  );
}

function FolderButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded px-2 py-1.5 text-left ${selected ? 'bg-[var(--app-brand-50)] text-[var(--app-brand-800)]' : 'hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );
}
