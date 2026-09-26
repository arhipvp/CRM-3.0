import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../common/Button';
import { InlineAlert } from '../../../common/InlineAlert';
import { ClientForm } from '../../../forms/ClientForm';
import {
  createClient,
  fetchClientById,
  fetchClientLookup,
  updateClient,
} from '../../../../api/clients';
import { fetchBanks } from '../../../../api/catalogs';
import {
  insuranceDataAction,
  isSelectableRecord,
  listInsuranceData,
  recordLabel,
  saveInsuranceData,
  type DataRecord,
  type DataResource,
} from '../../../../api/insuranceData';
import type { Bank, Client } from '../../../../types';
import { InsuranceRecordForm } from './InsuranceRecordForm';
import { dataSchemas, type DataField } from './insuranceDataSchemas';
import { request } from '../../../../api/request';

function RecordHistory({
  resource,
  row,
  fields,
}: {
  resource: DataResource;
  row: DataRecord;
  fields: DataField[];
}) {
  const [history, setHistory] = useState<DataRecord[] | null>(null);
  const [error, setError] = useState('');
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open && !history)
          void request<DataRecord[]>(
            `/insurance-data/${resource}/${row.id}/history/?include_deleted=true`,
          )
            .then(setHistory)
            .catch((err: Error) => setError(err.message));
      }}
    >
      <summary className="text-sm cursor-pointer text-sky-700">История изменений</summary>
      {error && <InlineAlert>{error}</InlineAlert>}
      {history?.map((item) => (
        <div key={item.id} className="border-l-2 pl-3 mt-3">
          <p className="text-sm text-slate-500">
            {String(item.created_at)} ·{' '}
            {(
              {
                create: 'Создание',
                update: 'Изменение',
                delete: 'Удаление',
                restore: 'Восстановление',
              } as Record<string, string>
            )[String(item.action)] || 'Изменение'}
          </p>
          <RecordDetails row={item.snapshot as DataRecord} fields={fields} />
        </div>
      ))}
    </details>
  );
}

function RecordDetails({ row, fields }: { row: DataRecord; fields: DataField[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 text-sm my-3">
      {fields
        .filter((field) => !['title', 'is_current'].includes(field.key))
        .map((field) => {
          const value = row[field.key];
          if (value === undefined || value === null || value === '') return null;
          return (
            <div key={field.key} className="min-w-0">
              <dt className="text-slate-500">{field.label}</dt>
              <dd className="break-words">
                {field.type === 'links'
                  ? (value as { label: string; url: string }[]).map((link, i) =>
                      /^https?:\/\//i.test(link.url) ? (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sky-700 underline"
                        >
                          {link.label || `Документ ${i + 1}`}
                        </a>
                      ) : null,
                    )
                  : field.type === 'checkbox'
                    ? value
                      ? 'Да'
                      : 'Нет'
                    : field.options?.find((option) => option.value === value)?.label ||
                      String(value)}
              </dd>
            </div>
          );
        })}
    </dl>
  );
}

export function InsuranceResourceSection({
  resource,
  title,
  parentKey,
  parentId,
  fields: suppliedFields,
  children,
}: {
  resource: DataResource;
  title: string;
  parentKey: string;
  parentId: string;
  fields?: DataField[];
  children?: (row: DataRecord) => React.ReactNode;
}) {
  const fields = suppliedFields || dataSchemas[resource] || [];
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [filter, setFilter] = useState('current');
  const [editing, setEditing] = useState<DataRecord | 'new' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listInsuranceData(resource, { [parentKey]: parentId, include_deleted: true }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные.');
    } finally {
      setLoading(false);
    }
  }, [resource, parentKey, parentId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const act = async (row: DataRecord, action: 'delete' | 'restore') => {
    setBusy(true);
    try {
      await insuranceDataAction(resource, row.id, action);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить действие.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <select
            className="field field-input"
            aria-label={`Фильтр: ${title}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="current">Актуальные</option>
            <option value="all">Все неудалённые</option>
            <option value="deleted">Удалённые</option>
          </select>
          <Button size="sm" onClick={() => setEditing('new')}>
            Добавить
          </Button>
        </div>
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
      {editing && (
        <InsuranceRecordForm
          key={editing === 'new' ? 'new' : editing.id}
          fields={fields}
          initial={editing === 'new' ? {} : editing}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            await saveInsuranceData(
              resource,
              { ...value, [parentKey]: parentId },
              editing === 'new' ? undefined : editing.id,
            );
            setEditing(null);
            await reload();
          }}
        />
      )}
      {loading ? (
        <p role="status">Загрузка…</p>
      ) : (
        <>
          {rows
            .filter((row) =>
              filter === 'deleted'
                ? Boolean(row.deleted_at)
                : filter === 'current'
                  ? isSelectableRecord(row)
                  : !row.deleted_at,
            )
            .map((row) => (
              <article key={row.id} className="app-panel p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <h4 className="font-medium">
                    {recordLabel(row)}{' '}
                    {row.is_current === false && (
                      <span className="text-slate-500">· неактуальный</span>
                    )}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {row.deleted_at ? (
                      <Button size="sm" disabled={busy} onClick={() => void act(row, 'restore')}>
                        Восстановить
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => setEditing(row)}>
                          Изменить
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => void act(row, 'delete')}>
                          Удалить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <RecordDetails row={row} fields={fields} />
                <RecordHistory resource={resource} row={row} fields={fields} />
                {!row.deleted_at && children?.(row)}
              </article>
            ))}
          {!rows.some((row) =>
            filter === 'deleted'
              ? row.deleted_at
              : filter === 'current'
                ? isSelectableRecord(row)
                : !row.deleted_at,
          ) && <p className="text-sm text-slate-500">Записей пока нет.</p>}
        </>
      )}
    </section>
  );
}

function PersonCard({
  participant,
  onChange,
}: {
  participant: DataRecord;
  onChange: () => Promise<void>;
}) {
  const [client, setClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchClientById(String(participant.client))
      .then((value) => {
        if (alive) setClient(value);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [participant.client]);
  const act = async (action: 'restore' | 'delete') => {
    setBusy(true);
    try {
      await insuranceDataAction('participants', participant.id, action);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="app-panel p-4 space-y-4">
      {error && <InlineAlert>{error}</InlineAlert>}
      <div className="flex flex-wrap gap-2 justify-between">
        <h3 className="font-semibold">
          {client?.name || (participant.client_name as string) || 'Участник'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {participant.deleted_at ? (
            <Button size="sm" disabled={busy} onClick={() => void act('restore')}>
              Восстановить участие
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => setEditing(!editing)}>
                Изменить человека
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void act('delete')}>
                Убрать из сделки
              </Button>
            </>
          )}
        </div>
      </div>
      {client && (
        <p className="text-sm text-slate-600">
          {[client.birthDate, client.phone, client.email, client.registrationAddress]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {editing && client && (
        <>
          <p className="text-sm text-amber-700">
            Изменения общей карточки человека будут видны во всех его сделках.
          </p>
          <ClientForm
            initial={client}
            onSubmit={async (data) => {
              setClient(await updateClient(client.id, data));
              setEditing(false);
            }}
          />
        </>
      )}
      {!participant.deleted_at && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={participant.is_current !== false}
            disabled={busy}
            onChange={async (event) => {
              const checked = event.target.checked;
              setBusy(true);
              try {
                await saveInsuranceData('participants', { is_current: checked }, participant.id);
                await onChange();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Не удалось изменить участие.');
              } finally {
                setBusy(false);
              }
            }}
          />
          Актуальный участник сделки
        </label>
      )}
      {!participant.deleted_at && (
        <details>
          <summary className="cursor-pointer text-sky-700">
            Паспорта и водительские удостоверения
          </summary>
          <div className="space-y-6 mt-4">
            <InsuranceResourceSection
              resource="passports"
              title="Паспорта РФ"
              parentKey="client"
              parentId={String(participant.client)}
            />
            <InsuranceResourceSection
              resource="driver-licenses"
              title="Водительские удостоверения"
              parentKey="client"
              parentId={String(participant.client)}
            />
          </div>
        </details>
      )}
    </article>
  );
}

function PeopleData({ dealId }: { dealId: string }) {
  const [participants, setParticipants] = useState<DataRecord[]>([]);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Client[]>([]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('current');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      setParticipants(
        await listInsuranceData('participants', { deal: dealId, include_deleted: true }),
      );
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить участников.');
    }
  }, [dealId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      void fetchClientLookup(query, { signal: controller.signal })
        .then((response) => setCandidates(response.results.filter((client) => !client.deletedAt)))
        .catch((err: Error) => {
          if (!controller.signal.aborted) setError(err.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const attach = async (clientId: string) => {
    setBusy(true);
    try {
      await saveInsuranceData('participants', { deal: dealId, client: clientId, is_current: true });
      setQuery('');
      setCandidates([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить участника.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          className="field field-input flex-1 min-w-48"
          aria-label="Найти человека"
          placeholder="Найти существующего клиента по ФИО"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCandidates([]);
          }}
        />
        <Button onClick={() => setCreating(!creating)}>Создать человека</Button>
        <select
          className="field field-input"
          aria-label="Фильтр участников"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="current">Актуальные</option>
          <option value="all">Все неудалённые</option>
          <option value="deleted">Удалённые</option>
        </select>
      </div>
      {query && (
        <ul className="space-y-2">
          {candidates.map((client) => (
            <li key={client.id} className="flex gap-3 items-center">
              <span>
                {client.name} {client.birthDate}
              </span>
              <Button
                size="sm"
                disabled={busy || participants.some((p) => p.client === client.id && !p.deleted_at)}
                onClick={() => void attach(client.id)}
              >
                Добавить в сделку
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <InlineAlert>{error}</InlineAlert>}
      {creating && (
        <div>
          <Button size="sm" onClick={() => setCreating(false)}>
            Отмена
          </Button>
          <ClientForm
            onSubmit={async (data) => {
              const client = await createClient(data);
              setCreating(false);
              await attach(client.id);
            }}
          />
        </div>
      )}
      {participants
        .filter((p) =>
          filter === 'deleted'
            ? Boolean(p.deleted_at)
            : filter === 'current'
              ? isSelectableRecord(p)
              : !p.deleted_at,
        )
        .map((p) => (
          <PersonCard key={p.id} participant={p} onChange={reload} />
        ))}
      {!participants.length && (
        <p className="text-sm text-slate-500">
          Добавьте людей, чтобы затем назначить их роли в заявках.
        </p>
      )}
    </section>
  );
}

export function InsuranceDataTab({
  dealId,
  section,
}: {
  dealId: string;
  section: 'people' | 'vehicles' | 'mortgages';
}) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (section === 'mortgages')
      void fetchBanks()
        .then(setBanks)
        .catch((err: Error) => setError(err.message));
  }, [section]);
  if (section === 'people') return <PeopleData dealId={dealId} />;
  if (section === 'vehicles')
    return (
      <InsuranceResourceSection
        key={dealId}
        resource="vehicles"
        title="Машины"
        parentKey="deal"
        parentId={dealId}
      >
        {(car) => (
          <details>
            <summary className="cursor-pointer text-sky-700">СТС и ПТС/ЭПТС</summary>
            <div className="space-y-6 mt-4">
              <InsuranceResourceSection
                resource="vehicle-registrations"
                title="СТС"
                parentKey="vehicle"
                parentId={car.id}
              />
              <InsuranceResourceSection
                resource="vehicle-titles"
                title="ПТС / ЭПТС"
                parentKey="vehicle"
                parentId={car.id}
              />
            </div>
          </details>
        )}
      </InsuranceResourceSection>
    );
  return (
    <>
      {error && <InlineAlert>{error}</InlineAlert>}
      <InsuranceResourceSection
        key={dealId}
        resource="mortgages"
        title="Ипотека"
        parentKey="deal"
        parentId={dealId}
        fields={dataSchemas.mortgages?.map((field) =>
          field.key === 'bank'
            ? { ...field, options: banks.map((bank) => ({ value: bank.id, label: bank.name })) }
            : field,
        )}
      >
        {(mortgage) => (
          <details>
            <summary className="cursor-pointer text-sky-700">История остатка задолженности</summary>
            <div className="mt-4">
              <InsuranceResourceSection
                resource="mortgage-balances"
                title="Остатки задолженности"
                parentKey="mortgage"
                parentId={mortgage.id}
              />
            </div>
          </details>
        )}
      </InsuranceResourceSection>
    </>
  );
}
