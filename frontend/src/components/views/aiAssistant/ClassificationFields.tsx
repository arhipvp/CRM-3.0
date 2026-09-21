import type { AiCatalog, AiClassification } from '../../../api/aiAssistant';

export function ClassificationFields({
  value,
  catalog,
  onChange,
  error,
}: {
  value: AiClassification;
  catalog: AiCatalog;
  onChange: (field: keyof AiClassification, value: string) => void;
  error?: string | null;
}) {
  const fields: Array<[keyof AiClassification, string, string[], 'text' | 'date']> = [
    ['insurer', 'Страховщик', catalog.suggestions.insurers, 'text'],
    ['insurance_kind', 'Вид страхования', catalog.suggestions.insurance_kinds, 'text'],
    ['product', 'Продукт', catalog.suggestions.products, 'text'],
    [
      'document_type',
      'Тип документа',
      ['Правила', 'Тарифы', 'Инструкция', 'Бланк', 'Образец полиса', 'Прочее'],
      'text',
    ],
    ['effective_from', 'Действует с', [], 'date'],
    ['effective_to', 'Действует до', [], 'date'],
  ];
  const requiredFields: Array<keyof AiClassification> = ['insurer', 'insurance_kind', 'product'];

  return (
    <div className="mt-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {fields.map(([field, label, options, type]) => (
          <label key={field} className="text-xs text-slate-600">
            {label}
            {requiredFields.includes(field) && <span className="ml-0.5 text-red-600">*</span>}
            <input
              type={type}
              list={`ai-${field}`}
              value={value[field] ?? ''}
              onChange={(event) => onChange(field, event.target.value)}
              className={`mt-1 w-full rounded border px-2 py-1.5 text-sm text-slate-900 ${error && requiredFields.includes(field) ? 'border-red-300 bg-red-50' : 'border-[var(--app-border)]'}`}
            />
            <datalist id={`ai-${field}`}>
              {options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
