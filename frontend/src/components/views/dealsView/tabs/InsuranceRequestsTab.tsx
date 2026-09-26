import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../common/Button';
import { InlineAlert } from '../../../common/InlineAlert';
import { fetchInsuranceCompanies, fetchInsuranceTypes } from '../../../../api/catalogs';
import {
  insuranceDataAction,
  listInsuranceData,
  recordLabel,
  saveInsuranceData,
  type DataRecord,
} from '../../../../api/insuranceData';
import { request } from '../../../../api/request';
import { unwrapList } from '../../../../api/helpers';
import { InsuranceRequestForm, type RequestLookups } from './InsuranceRequestForm';

const statusLabels: Record<string, string> = {
  pending: 'Ожидает расчёта',
  quoted: 'Предложения получены',
  declined: 'Отказ',
  failed: 'Не удалось рассчитать',
};
const fieldLabels: Record<string, string> = {
  policyholder: 'страхователь',
  owner: 'собственник',
  start_date: 'начало периода',
  end_date: 'конец периода',
  borrower: 'заёмщик',
  mortgage_balance: 'остаток задолженности',
  drivers: 'водители',
  insured_person: 'застрахованное лицо',
};

function VariantEditor({
  variant,
  locked,
  onSaved,
  lookups,
}: {
  variant: DataRecord;
  locked: boolean;
  onSaved: () => Promise<void>;
  lookups: RequestLookups;
}) {
  const [status, setStatus] = useState(String(variant.status));
  const [explanation, setExplanation] = useState(String(variant.explanation || ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="rounded-lg border p-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
          await saveInsuranceData('variants', { status, explanation }, variant.id);
          await onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Не удалось сохранить результат.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="font-medium text-sm">
        {lookups.companies.find((item) => item.id === variant.insurance_company)?.name ||
          String(variant.insurance_company)}{' '}
        ·{' '}
        {recordLabel(
          lookups.platforms.find((item) => item.id === variant.platform) || {
            id: String(variant.platform),
          },
        )}
        {variant.deductible != null && ` · франшиза ${String(variant.deductible)} ₽`}
        {variant.is_current === false && ' · предыдущие условия'}
      </p>
      {error && <InlineAlert>{error}</InlineAlert>}
      <fieldset disabled={locked || saving} className="flex flex-wrap gap-2">
        <select
          aria-label="Статус варианта"
          className="field field-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {Object.entries(statusLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="field field-input flex-1 min-w-40"
          aria-label="Пояснение результата"
          placeholder="Пояснение результата"
          required={status === 'declined' || status === 'failed'}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        {!locked && (
          <Button size="sm" type="submit" isLoading={saving}>
            Сохранить статус
          </Button>
        )}
      </fieldset>
    </form>
  );
}

function LinkResults({ row, onSaved }: { row: DataRecord; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState('quotes');
  const [results, setResults] = useState<DataRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [variant, setVariant] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const all: DataRecord[] = [];
      for (let page = 1; ; page++) {
        const response = await request<{ results: DataRecord[]; next?: string }>(
          `/${kind}/?deal=${row.deal}&page=${page}&page_size=100`,
          { signal: controller.signal },
        );
        all.push(...unwrapList<DataRecord>(response));
        if (!response.next) break;
      }
      setResults(all.filter((item) => item.deal === row.deal && !item.deleted_at));
    };
    void load().catch((err: Error) => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [kind, row.deal]);
  const variants = (row.variants || []) as DataRecord[];
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
          const chosenVariant = variants.find((item) => item.id === variant);
          await request(`/${kind}/${selected}/`, {
            method: 'PATCH',
            body: JSON.stringify({
              insurance_request: row.id,
              ...(kind === 'quotes'
                ? { request_variant: variant, request_version: chosenVariant?.request_version }
                : {}),
            }),
          });
          setSelected('');
          await onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Не удалось связать результат.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="text-sm text-slate-500">
        Выберите существующую запись этой сделки. Для расчёта укажите соответствующий вариант;
        сервер проверит страховщика и условия.
      </p>
      {error && <InlineAlert>{error}</InlineAlert>}
      <select
        aria-label="Тип результата"
        className="field field-input"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value);
          setSelected('');
        }}
      >
        <option value="quotes">Расчёт</option>
        <option value="policies">Полис</option>
      </select>
      <select
        aria-label="Результат для связи"
        required
        className="field field-input"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Выберите запись</option>
        {results.map((item) => (
          <option key={item.id} value={item.id}>
            {String(item.insurance_company_name || item.insurance_company || '')} ·{' '}
            {String(item.number || item.premium || '')} · {item.id.slice(0, 8)}
            {item.insurance_request ? ' (уже связан)' : ''}
          </option>
        ))}
      </select>
      {kind === 'quotes' && (
        <select
          aria-label="Вариант для связи"
          required
          className="field field-input"
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
        >
          <option value="">Выберите вариант</option>
          {variants
            .filter((item) => item.is_current !== false)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {String(item.insurance_company_name || item.insurance_company)} ·{' '}
                {String(item.deductible ?? 'Без франшизы')} · {item.id.slice(0, 8)}
              </option>
            ))}
        </select>
      )}
      <Button type="submit" size="sm" isLoading={saving}>
        Связать с заявкой
      </Button>
    </form>
  );
}

function SnapshotDetails({ snapshot }: { snapshot: Record<string, unknown> }) {
  const people = (snapshot.people || []) as DataRecord[];
  const object = (snapshot.object || {}) as DataRecord;
  const docs = [
    ['Паспорта', snapshot.passports],
    ['ВУ', snapshot.driver_licenses],
    ['СТС', snapshot.vehicle_registrations],
    ['ПТС / ЭПТС', snapshot.vehicle_titles],
  ] as [string, unknown][];
  return (
    <div className="space-y-3 border-l-2 pl-4 py-3 text-sm">
      <p>
        Объект: {recordLabel(object)} {String(object.vin || object.address || '')}
      </p>
      <p>
        Период: {String(snapshot.start_date || '—')} — {String(snapshot.end_date || '—')}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {['policyholder', 'owner', 'borrower', 'insured_person']
          .filter((key) => snapshot[key])
          .map((key) => (
            <div key={key}>
              <dt className="text-slate-500">{fieldLabels[key]}</dt>
              <dd>
                {recordLabel(
                  people.find((person) => person.id === snapshot[key]) || {
                    id: String(snapshot[key]),
                  },
                )}
              </dd>
            </div>
          ))}
      </dl>
      <p>
        Водители:{' '}
        {snapshot.unlimited_drivers
          ? 'без ограничений'
          : ((snapshot.drivers || []) as string[])
              .map((id) => recordLabel(people.find((person) => person.id === id) || { id }))
              .join(', ') || '—'}
      </p>
      {snapshot.official_dealer != null && (
        <p>
          Оф. дилер: {snapshot.official_dealer ? 'да' : 'нет'} · Франшизы:{' '}
          {((snapshot.deductibles || []) as string[]).join('; ')} ₽ · Стоимость:{' '}
          {snapshot.vehicle_value_mode === 'maximum'
            ? 'максимум каждой страховой'
            : `${String(snapshot.vehicle_value)} ₽`}
        </p>
      )}
      {snapshot.mortgage_amount != null && (
        <p>
          Остаток долга: {String(snapshot.mortgage_amount)} ₽ на{' '}
          {String(snapshot.mortgage_amount_date)}
        </p>
      )}
      {docs
        .filter(([, values]) => Array.isArray(values) && values.length)
        .map(([label, values]) => (
          <div key={label}>
            <h5 className="font-medium">{label}</h5>
            {(values as DataRecord[]).map((doc) => (
              <p key={doc.id}>
                {recordLabel(people.find((person) => person.id === doc.client) || object)}:{' '}
                {String(doc.series || '')} {String(doc.number || '')} · выдан{' '}
                {String(doc.issue_date || '—')}
                {doc.experience_start ? ` · стаж с ${String(doc.experience_start)}` : ''}
              </p>
            ))}
          </div>
        ))}
    </div>
  );
}

function RequestHistory({ id }: { id: string }) {
  const [versions, setVersions] = useState<DataRecord[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void request(`/insurance-data/requests/${id}/versions/`, { signal: controller.signal })
      .then((payload) => setVersions(unwrapList<DataRecord>(payload)))
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [id]);
  return (
    <div className="space-y-3">
      {error && <InlineAlert>{error}</InlineAlert>}
      {versions.map((version) => (
        <details key={version.id}>
          <summary className="cursor-pointer">
            Версия {String(version.number)} · {String(version.created_at || '')}
          </summary>
          <SnapshotDetails snapshot={(version.snapshot || {}) as Record<string, unknown>} />
        </details>
      ))}
    </div>
  );
}

export function InsuranceRequestsTab({ dealId }: { dealId: string }) {
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [lookups, setLookups] = useState<RequestLookups | null>(null);
  const [filter, setFilter] = useState('current');
  const [editing, setEditing] = useState<DataRecord | 'new' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const [requests, people, vehicles, mortgages, companies, types, platforms] =
        await Promise.all([
          listInsuranceData('requests', { deal: dealId, include_deleted: true }),
          listInsuranceData('participants', { deal: dealId }),
          listInsuranceData('vehicles', { deal: dealId }),
          listInsuranceData('mortgages', { deal: dealId }),
          fetchInsuranceCompanies(),
          fetchInsuranceTypes(),
          listInsuranceData('platforms'),
        ]);
      setRows(requests);
      setLookups({ people, vehicles, mortgages, companies, types, platforms });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заявки.');
    } finally {
      setLoading(false);
    }
  }, [dealId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const action = async (
    row: DataRecord,
    name: 'close' | 'reopen' | 'copy' | 'delete' | 'restore',
  ) => {
    setBusy(true);
    try {
      await insuranceDataAction('requests', row.id, name);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить действие.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3 justify-between">
        <h2 className="font-semibold">Заявки на страхование</h2>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Фильтр заявок"
            className="field field-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="current">Актуальные</option>
            <option value="closed">Закрытые</option>
            <option value="all">Все неудалённые</option>
            <option value="deleted">Удалённые</option>
          </select>
          <Button variant="primary" disabled={!lookups} onClick={() => setEditing('new')}>
            Создать заявку
          </Button>
        </div>
      </div>
      {error && (
        <InlineAlert>
          {error}
          <Button size="sm" onClick={() => void reload()}>
            Повторить загрузку
          </Button>
        </InlineAlert>
      )}
      {loading && <p role="status">Загрузка…</p>}
      {editing && lookups && (
        <InsuranceRequestForm
          key={editing === 'new' ? 'new' : editing.id}
          dealId={dealId}
          initial={editing === 'new' ? undefined : editing}
          lookups={lookups}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
      {lookups &&
        rows
          .filter((row) =>
            filter === 'deleted'
              ? row.deleted_at
              : !row.deleted_at &&
                (filter === 'all' || (filter === 'current' ? row.is_current : !row.is_current)),
          )
          .map((row) => (
            <article key={row.id} className="app-panel p-4 space-y-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  {String(row.title)}{' '}
                  <span className="text-sm text-slate-500">
                    · {row.is_current ? 'Актуальная' : 'Закрытая'} · версия {String(row.version)}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {row.deleted_at ? (
                    <Button size="sm" disabled={busy} onClick={() => void action(row, 'restore')}>
                      Восстановить
                    </Button>
                  ) : (
                    <>
                      {row.is_current && (
                        <Button size="sm" onClick={() => setEditing(row)}>
                          Изменить
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void action(row, row.is_current ? 'close' : 'reopen')}
                      >
                        {row.is_current ? 'Закрыть' : 'Вернуть в работу'}
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => void action(row, 'copy')}>
                        Копировать
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => void action(row, 'delete')}>
                        Удалить
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm">
                {lookups.types.find((item) => item.id === row.insurance_type)?.name} ·{' '}
                {recordLabel(
                  [...lookups.vehicles, ...lookups.mortgages].find(
                    (item) => item.id === (row.vehicle || row.mortgage),
                  ) || { id: String(row.vehicle || row.mortgage) },
                )}{' '}
                · {String(row.start_date || 'Начало не указано')} —{' '}
                {String(row.end_date || 'Конец не указан')}
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {['policyholder', 'owner', 'borrower', 'insured_person']
                  .filter((key) => row[key])
                  .map((key) => (
                    <div key={key}>
                      <dt className="text-slate-500">{fieldLabels[key]}</dt>
                      <dd>
                        {recordLabel(
                          lookups.people.find((item) => item.client === row[key]) || {
                            id: String(row[key]),
                          },
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
              {Boolean(row.vehicle) && (
                <p className="text-sm">
                  Водители:{' '}
                  {row.unlimited_drivers
                    ? 'без ограничений'
                    : ((row.drivers || []) as string[])
                        .map((id) =>
                          recordLabel(lookups.people.find((item) => item.client === id) || { id }),
                        )
                        .join(', ') || 'не выбраны'}
                </p>
              )}
              {row.official_dealer != null && (
                <p className="text-sm">
                  Официальный дилер: {row.official_dealer ? 'да' : 'нет'}. Стоимость машины:{' '}
                  {row.vehicle_value_mode === 'maximum'
                    ? 'максимум каждой страховой'
                    : `${String(row.vehicle_value)} ₽`}
                </p>
              )}
              {Boolean(row.mortgage) && (
                <p className="text-sm">
                  Остаток долга: {String(row.mortgage_amount || 'не указан')} ₽ на{' '}
                  {String(row.mortgage_amount_date || '—')}
                </p>
              )}
              {Boolean(((row.missing_fields as string[]) || []).length) && (
                <p className="text-sm text-amber-700">
                  Не заполнено:{' '}
                  {(row.missing_fields as string[])
                    .map((key) => fieldLabels[key] || key)
                    .join(', ')}
                </p>
              )}
              {Boolean(row.notes) && (
                <p className="text-sm whitespace-pre-wrap">{String(row.notes)}</p>
              )}
              {Boolean(row.sources_changed) && row.is_current && !row.deleted_at && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
                  <p>
                    Данные людей, объекта или документов изменились после подготовки этой версии.
                    Обновите заявку перед новым расчётом.
                  </p>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await saveInsuranceData('requests', {}, row.id);
                        await reload();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Не удалось обновить данные.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Обновить данные и создать версию
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {((row.variants || []) as DataRecord[]).map((variant) => (
                  <VariantEditor
                    key={`${variant.id}-${variant.updated_at}`}
                    variant={variant}
                    locked={
                      !row.is_current || Boolean(row.deleted_at) || variant.is_current === false
                    }
                    onSaved={reload}
                    lookups={lookups}
                  />
                ))}
              </div>
              {Boolean(((row.linked_quotes as DataRecord[]) || []).length) && (
                <section className="space-y-2">
                  <h4 className="font-medium">Сохранённые расчёты</h4>
                  {(row.linked_quotes as DataRecord[]).map((quote) => (
                    <div key={quote.id} className="border rounded-lg p-3 text-sm">
                      <p>
                        {String(quote.insurance_company_name)} · Премия: {String(quote.premium)} ₽ ·
                        Страховая сумма:{' '}
                        {quote.sum_insured == null
                          ? 'не указана'
                          : `${String(quote.sum_insured)} ₽`}
                      </p>
                      <p>
                        Франшиза:{' '}
                        {quote.deductible == null ? 'не указана' : `${String(quote.deductible)} ₽`}{' '}
                        · Оф. дилер: {quote.official_dealer ? 'да' : 'нет'}
                      </p>
                      <p className="whitespace-pre-wrap break-words">
                        {String(quote.comments || '')}
                      </p>
                    </div>
                  ))}
                </section>
              )}
              {Boolean(((row.linked_policies as DataRecord[]) || []).length) && (
                <section>
                  <h4 className="font-medium">Связанные полисы</h4>
                  {(row.linked_policies as DataRecord[]).map((policy) => (
                    <p key={policy.id} className="text-sm">
                      {String(policy.insurance_company_name)} · {String(policy.number)}
                    </p>
                  ))}
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setHistory(history === row.id ? null : row.id)}>
                  История версий
                </Button>
                {row.is_current && !row.deleted_at && (
                  <Button size="sm" onClick={() => setLinking(linking === row.id ? null : row.id)}>
                    Связать расчёт или полис
                  </Button>
                )}
              </div>
              {history === row.id && <RequestHistory id={row.id} />}
              {linking === row.id && <LinkResults row={row} onSaved={reload} />}
            </article>
          ))}
      {!loading && !rows.length && (
        <p className="text-sm text-slate-500">
          Создайте заявку, выберите объект, участников и направления расчёта.
        </p>
      )}
    </section>
  );
}
