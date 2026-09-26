import { useEffect, useState } from 'react';
import { Button } from '../../../common/Button';
import { FormField } from '../../../common/forms/FormField';
import { FormError } from '../../../common/forms/FormError';
import { DateInput } from '../../../common/forms/DateInput';
import {
  listInsuranceData,
  isSelectableRecord,
  parseDeductibles,
  recordLabel,
  saveInsuranceData,
  type DataRecord,
} from '../../../../api/insuranceData';
import type { InsuranceCompany, InsuranceType } from '../../../../types';

export interface RequestLookups {
  people: DataRecord[];
  vehicles: DataRecord[];
  mortgages: DataRecord[];
  companies: InsuranceCompany[];
  types: InsuranceType[];
  platforms: DataRecord[];
}
type Target = { insurance_company: string; platform: string };

export function InsuranceRequestForm({
  dealId,
  initial,
  lookups,
  onSaved,
  onCancel,
}: {
  dealId: string;
  initial?: DataRecord;
  lookups: RequestLookups;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<Record<string, unknown>>(() => ({
    title: '',
    insurance_type: '',
    vehicle: '',
    mortgage: '',
    start_date: '',
    end_date: '',
    notes: '',
    policyholder: '',
    owner: '',
    borrower: '',
    insured_person: '',
    drivers: [],
    unlimited_drivers: false,
    official_dealer: false,
    vehicle_value_mode: 'maximum',
    vehicle_value: '',
    mortgage_balance: '',
    ...initial,
  }));
  const [objectType, setObjectType] = useState(initial?.mortgage ? 'mortgage' : 'vehicle');
  const [targets, setTargets] = useState<Target[]>(
    () => (initial?.targets as Target[]) || [{ insurance_company: '', platform: '' }],
  );
  const [franchises, setFranchises] = useState(() =>
    ((initial?.deductibles as string[]) || ['0']).join('; '),
  );
  const [platforms, setPlatforms] = useState(lookups.platforms);
  const [platformName, setPlatformName] = useState('');
  const [balances, setBalances] = useState<DataRecord[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedType = lookups.types.find((item) => item.id === value.insurance_type);
  const casco = (selectedType?.name || '').toLocaleLowerCase().includes('каско');
  const drivers = (value.drivers || []) as string[];
  const change = (key: string, next: unknown) => setValue((old) => ({ ...old, [key]: next }));
  const str = (key: string) => String(value[key] ?? '');
  const personOptions = lookups.people.filter(
    (person) =>
      isSelectableRecord(person) ||
      Object.values(value).includes(person.client) ||
      drivers.includes(String(person.client)),
  );
  useEffect(() => {
    if (!value.mortgage) return;
    const controller = new AbortController();
    void listInsuranceData('mortgage-balances', { mortgage: value.mortgage }, controller.signal)
      .then(setBalances)
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [value.mortgage]);
  const selectPerson = (key: string, label: string) => (
    <FormField label={label} htmlFor={`request-${key}`}>
      <select
        id={`request-${key}`}
        className="field field-input"
        value={str(key)}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">Пока не выбран</option>
        {personOptions.map((person) => (
          <option key={person.id} value={String(person.client)}>
            {recordLabel(person)}
          </option>
        ))}
      </select>
    </FormField>
  );
  return (
    <form
      className="app-panel p-4 space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        setSaving(true);
        try {
          const payload: Record<string, unknown> = {
            deal: dealId,
            title: str('title').trim(),
            insurance_type: value.insurance_type,
            vehicle: objectType === 'vehicle' ? value.vehicle || null : null,
            mortgage: objectType === 'mortgage' ? value.mortgage || null : null,
            start_date: value.start_date || null,
            end_date: value.end_date || null,
            notes: value.notes,
            policyholder: value.policyholder || null,
            owner: value.owner || null,
            borrower: objectType === 'mortgage' ? value.borrower || null : null,
            insured_person: objectType === 'mortgage' ? value.insured_person || null : null,
            drivers: objectType === 'vehicle' && !value.unlimited_drivers ? drivers : [],
            unlimited_drivers: objectType === 'vehicle' && Boolean(value.unlimited_drivers),
            targets,
            deductibles: casco ? parseDeductibles(franchises) : [],
            official_dealer: casco ? Boolean(value.official_dealer) : null,
            vehicle_value_mode: casco ? value.vehicle_value_mode : '',
            vehicle_value:
              casco && value.vehicle_value_mode === 'fixed' ? value.vehicle_value : null,
            mortgage_balance: objectType === 'mortgage' ? value.mortgage_balance || null : null,
          };
          await saveInsuranceData('requests', payload, initial?.id);
          await onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Не удалось сохранить заявку.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3 className="font-semibold">{initial ? 'Изменить заявку' : 'Новая заявка'}</h3>
      <FormError message={error || null} />
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Название заявки" htmlFor="request-title" required>
          <input
            id="request-title"
            className="field field-input"
            required
            value={str('title')}
            onChange={(e) => change('title', e.target.value)}
          />
        </FormField>
        <FormField label="Вид страхования" htmlFor="request-type" required>
          <select
            id="request-type"
            required
            className="field field-input"
            value={str('insurance_type')}
            onChange={(e) => change('insurance_type', e.target.value)}
          >
            <option value="">Выберите вид</option>
            {lookups.types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Тип объекта" htmlFor="request-object-type">
          <select
            id="request-object-type"
            className="field field-input"
            value={objectType}
            onChange={(e) => {
              setObjectType(e.target.value);
              setBalances([]);
              change('mortgage_balance', '');
            }}
          >
            <option value="vehicle">Машина</option>
            <option value="mortgage">Ипотека</option>
          </select>
        </FormField>
        <FormField label="Объект" htmlFor="request-object" required>
          <select
            id="request-object"
            className="field field-input"
            required
            value={str(objectType)}
            onChange={(e) => {
              change(objectType, e.target.value);
              setBalances([]);
              change('mortgage_balance', '');
            }}
          >
            <option value="">Выберите объект из данных сделки</option>
            {(objectType === 'vehicle' ? lookups.vehicles : lookups.mortgages)
              .filter((item) => isSelectableRecord(item) || item.id === value[objectType])
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {recordLabel(item)}
                </option>
              ))}
          </select>
        </FormField>
        <FormField label="Начало периода" htmlFor="request-start">
          <DateInput
            id="request-start"
            className="field field-input"
            value={str('start_date')}
            onChange={(e) => change('start_date', e.target.value)}
          />
        </FormField>
        <FormField label="Конец периода" htmlFor="request-end">
          <DateInput
            id="request-end"
            className="field field-input"
            value={str('end_date')}
            onChange={(e) => change('end_date', e.target.value)}
          />
        </FormField>
        {selectPerson('policyholder', 'Страхователь')}
        {selectPerson('owner', 'Собственник')}
        {objectType === 'mortgage' ? (
          <>
            {selectPerson('borrower', 'Заёмщик')}
            {selectPerson('insured_person', 'Застрахованное лицо')}
            <div className="text-sm">
              Банк:{' '}
              {String(
                lookups.mortgages.find((item) => item.id === value.mortgage)?.bank_name ||
                  'Укажите банк в карточке ипотеки',
              )}
            </div>
            <FormField label="Остаток задолженности" htmlFor="request-balance">
              <select
                id="request-balance"
                className="field field-input"
                value={str('mortgage_balance')}
                onChange={(e) => change('mortgage_balance', e.target.value)}
              >
                <option value="">Пока не выбран</option>
                {balances
                  .filter((item) => isSelectableRecord(item) || item.id === value.mortgage_balance)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {String(item.amount)} ₽ на {String(item.as_of_date)}
                    </option>
                  ))}
              </select>
            </FormField>
          </>
        ) : (
          <div className="col-span-full space-y-2">
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={Boolean(value.unlimited_drivers)}
                onChange={(e) => change('unlimited_drivers', e.target.checked)}
              />
              Без ограничений по водителям
            </label>
            {!value.unlimited_drivers && (
              <fieldset className="space-y-2">
                <legend className="font-medium mb-2">Допущенные водители</legend>
                {personOptions.map((person) => (
                  <label key={person.id} className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={drivers.includes(String(person.client))}
                      onChange={(e) =>
                        change(
                          'drivers',
                          e.target.checked
                            ? [...drivers, String(person.client)]
                            : drivers.filter((id) => id !== person.client),
                        )
                      }
                    />
                    {recordLabel(person)}
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        )}
        {casco && (
          <>
            <FormField label="Франшизы, ₽ (через ;)" htmlFor="request-deductibles" required>
              <input
                id="request-deductibles"
                className="field field-input"
                required
                value={franchises}
                onChange={(e) => setFranchises(e.target.value)}
                placeholder="0; 30000"
              />
            </FormField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(value.official_dealer)}
                onChange={(e) => change('official_dealer', e.target.checked)}
              />
              Ремонт у официального дилера
            </label>
            <FormField label="Стоимость машины" htmlFor="request-value-mode">
              <select
                id="request-value-mode"
                className="field field-input"
                value={str('vehicle_value_mode')}
                onChange={(e) => change('vehicle_value_mode', e.target.value)}
              >
                <option value="maximum">Максимально допустимая для каждой страховой</option>
                <option value="fixed">Фиксированная</option>
              </select>
            </FormField>
            {value.vehicle_value_mode === 'fixed' && (
              <FormField label="Стоимость, ₽" htmlFor="request-value" required>
                <input
                  id="request-value"
                  className="field field-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={str('vehicle_value')}
                  onChange={(e) => change('vehicle_value', e.target.value)}
                />
              </FormField>
            )}
          </>
        )}
        <div className="col-span-full space-y-3">
          <h4 className="font-medium">Где считать</h4>
          {targets.map((target, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <select
                className="field field-input flex-1 min-w-40"
                aria-label={`Страховщик ${index + 1}`}
                required
                value={target.insurance_company}
                onChange={(e) =>
                  setTargets(
                    targets.map((item, i) =>
                      i === index ? { ...item, insurance_company: e.target.value } : item,
                    ),
                  )
                }
              >
                <option value="">Страховщик</option>
                {lookups.companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="field field-input flex-1 min-w-40"
                aria-label={`Платформа ${index + 1}`}
                required
                value={target.platform}
                onChange={(e) =>
                  setTargets(
                    targets.map((item, i) =>
                      i === index ? { ...item, platform: e.target.value } : item,
                    ),
                  )
                }
              >
                <option value="">Платформа</option>
                {platforms
                  .filter((item) => isSelectableRecord(item) || item.id === target.platform)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {recordLabel(item)}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                disabled={targets.length === 1}
                onClick={() => setTargets(targets.filter((_, i) => i !== index))}
              >
                Убрать
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() => setTargets([...targets, { insurance_company: '', platform: '' }])}
          >
            Добавить страховщика и платформу
          </Button>
          <div className="flex flex-wrap gap-2">
            <input
              className="field field-input"
              aria-label="Название новой платформы"
              placeholder="Новая платформа"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!platformName.trim() || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const platform = await saveInsuranceData('platforms', {
                    name: platformName.trim(),
                    is_current: true,
                  });
                  setPlatforms([...platforms, platform]);
                  setPlatformName('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось создать платформу.');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Создать платформу
            </Button>
          </div>
        </div>
        <FormField label="Примечание" htmlFor="request-notes">
          <textarea
            id="request-notes"
            className="field field-input"
            value={str('notes')}
            onChange={(e) => change('notes', e.target.value)}
          />
        </FormField>
      </fieldset>
      <p className="text-sm text-slate-500">
        При изменении условий создаётся новая версия. Ранее полученные предложения сохраняются с
        прежними условиями.
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isLoading={saving}>
          Сохранить заявку
        </Button>
        <Button disabled={saving} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
