import type { AiCatalog, AiScopeBranch } from '../../../api/aiAssistant';

const scopeKey = (value: AiScopeBranch) =>
  value.unclassified
    ? 'unclassified'
    : [value.insurer, value.insurance_kind, value.product].filter(Boolean).join('::');

export function AiScopeMenu({
  catalog,
  scope,
  disabled,
  onReset,
  onToggle,
}: {
  catalog: AiCatalog;
  scope: AiScopeBranch[];
  disabled: boolean;
  onReset: () => void;
  onToggle: (branch: AiScopeBranch) => void;
}) {
  const selectedScope = (branch: AiScopeBranch) =>
    scope.some((item) => scopeKey(item) === scopeKey(branch));

  return (
    <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-[var(--app-border)] bg-white p-3 text-slate-700 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Область поиска</span>
        <button
          type="button"
          disabled={disabled || !scope.length}
          onClick={onReset}
          className="text-xs text-[var(--app-brand-700)] underline decoration-dotted underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Вся библиотека
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Настройка применяется только к этому чату.</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
        <ScopeOption
          label={`Вся библиотека (${catalog.total})`}
          checked={!scope.length}
          onChange={onReset}
          disabled={disabled}
        />
        <ScopeOption
          label={`Нераспределено (${catalog.unclassified})`}
          checked={selectedScope({ unclassified: true })}
          onChange={() => onToggle({ unclassified: true })}
          disabled={disabled}
        />
        {catalog.insurers.map((insurer) => (
          <div key={insurer.name} className="border-l border-slate-200 pl-2">
            <ScopeOption
              label={`${insurer.name} (${insurer.count})`}
              checked={selectedScope({ insurer: insurer.name })}
              onChange={() => onToggle({ insurer: insurer.name })}
              disabled={disabled}
              bold
            />
            {insurer.kinds.map((kind) => (
              <div key={kind.name} className="pl-3">
                <ScopeOption
                  label={`${kind.name} (${kind.count})`}
                  checked={selectedScope({ insurer: insurer.name, insurance_kind: kind.name })}
                  onChange={() => onToggle({ insurer: insurer.name, insurance_kind: kind.name })}
                  disabled={disabled}
                />
                {kind.products.map((product) => (
                  <div key={product.name} className="pl-3">
                    <ScopeOption
                      label={`${product.name} (${product.count})`}
                      checked={selectedScope({
                        insurer: insurer.name,
                        insurance_kind: kind.name,
                        product: product.name,
                      })}
                      onChange={() =>
                        onToggle({
                          insurer: insurer.name,
                          insurance_kind: kind.name,
                          product: product.name,
                        })
                      }
                      disabled={disabled}
                      small
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopeOption({
  label,
  checked,
  onChange,
  disabled = false,
  bold = false,
  small = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 ${bold ? 'font-medium' : ''} ${small ? 'text-xs' : ''} ${disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'}`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      {label}
    </label>
  );
}
