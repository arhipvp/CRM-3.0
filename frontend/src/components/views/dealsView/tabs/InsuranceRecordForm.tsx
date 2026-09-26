import { useId, useState } from 'react';
import { Button } from '../../../common/Button';
import { FormField } from '../../../common/forms/FormField';
import { FormError } from '../../../common/forms/FormError';
import { DateInput } from '../../../common/forms/DateInput';
import type { DataField } from './insuranceDataSchemas';
import { normalizeExperienceDate } from '../../../../api/insuranceData';

type Link = { label: string; url: string };
export function SourceLinksInput({
  value,
  onChange,
}: {
  value: Link[];
  onChange: (links: Link[]) => void;
}) {
  return (
    <div className="space-y-2 col-span-full">
      <p className="text-sm font-medium">Документы и источники</p>
      {value.map((link, index) => (
        <div key={index} className="flex flex-wrap gap-2">
          <input
            className="field field-input flex-1 min-w-40"
            aria-label={`Подпись ссылки ${index + 1}`}
            value={link.label}
            onChange={(e) =>
              onChange(
                value.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)),
              )
            }
            placeholder="Например: оборот ВУ"
          />
          <input
            className="field field-input flex-1 min-w-40"
            type="url"
            pattern="https?://.*"
            required
            aria-label={`URL документа ${index + 1}`}
            value={link.url}
            onChange={(e) =>
              onChange(
                value.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)),
              )
            }
            placeholder="https://…"
          />
          <Button size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>
            Убрать ссылку
          </Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange([...value, { label: '', url: '' }])}>
        Добавить ссылку
      </Button>
    </div>
  );
}

export function InsuranceRecordForm({
  fields,
  initial = {},
  onSave,
  onCancel,
}: {
  fields: DataField[];
  initial?: Record<string, unknown>;
  onSave: (value: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const formId = useId();
  const [value, setValue] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.key,
        initial[field.key] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : ''),
      ]),
    ),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (key: string, next: unknown) => setValue((old) => ({ ...old, [key]: next }));
  return (
    <form
      className="app-panel p-4 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        setSaving(true);
        try {
          const payload = { ...value };
          for (const field of fields) {
            if (field.type === 'experience' && payload[field.key])
              payload[field.key] = normalizeExperienceDate(String(payload[field.key]));
            if (
              ['number', 'date', 'experience', 'select'].includes(field.type || '') &&
              payload[field.key] === ''
            )
              payload[field.key] = null;
          }
          await onSave(payload);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Не удалось сохранить данные.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <FormError message={error || null} />
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) =>
          field.type === 'links' ? (
            <SourceLinksInput
              key={field.key}
              value={(value[field.key] || []) as Link[]}
              onChange={(next) => change(field.key, next)}
            />
          ) : (
            <FormField
              key={field.key}
              label={field.label}
              htmlFor={`${formId}-${field.key}`}
              required={field.required}
            >
              {field.type === 'checkbox' ? (
                <input
                  id={`${formId}-${field.key}`}
                  type="checkbox"
                  checked={Boolean(value[field.key])}
                  onChange={(e) => change(field.key, e.target.checked)}
                />
              ) : field.type === 'select' ? (
                <select
                  id={`${formId}-${field.key}`}
                  className="field field-input"
                  value={String(value[field.key] ?? '')}
                  required={field.required}
                  onChange={(e) => change(field.key, e.target.value)}
                >
                  <option value="">Не указано</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={`${formId}-${field.key}`}
                  className="field field-input"
                  value={String(value[field.key] ?? '')}
                  onChange={(e) => change(field.key, e.target.value)}
                />
              ) : field.type === 'date' ? (
                <DateInput
                  id={`${formId}-${field.key}`}
                  className="field field-input"
                  required={field.required}
                  value={String(value[field.key] ?? '')}
                  onChange={(e) => change(field.key, e.target.value)}
                />
              ) : (
                <input
                  id={`${formId}-${field.key}`}
                  className="field field-input"
                  type={field.type === 'number' ? 'number' : 'text'}
                  min={field.type === 'number' ? 0 : undefined}
                  step={field.type === 'number' ? 'any' : undefined}
                  required={field.required}
                  value={String(value[field.key] ?? '')}
                  onChange={(e) => change(field.key, e.target.value)}
                  placeholder={field.type === 'experience' ? '1986-02-20 или 1986' : undefined}
                />
              )}
            </FormField>
          ),
        )}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isLoading={saving}>
          Сохранить
        </Button>
        <Button disabled={saving} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
