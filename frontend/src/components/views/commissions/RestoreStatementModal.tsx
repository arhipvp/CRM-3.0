import { useState } from 'react';
import type { RestoreFinanceStatementResult } from '../../../api';
import { Modal } from '../../Modal';
import { Button } from '../../common/Button';

const MISSING_STATEMENT_SNAPSHOT = 'Прежний состав ведомости не сохранён. Добавьте записи вручную';

function buildRestoreReport(result: RestoreFinanceStatementResult): string {
  return [
    `Ведомость «${result.statement.name}» восстановлена.`,
    `Восстановлено записей: ${result.restored_count}. Пропущено: ${result.skipped_records.length}.`,
    ...(result.snapshot_missing ? [MISSING_STATEMENT_SNAPSHOT] : []),
    ...result.skipped_records.map((record) =>
      [
        `ID: ${record.id} — ${record.message}`,
        record.client && `Клиент: ${record.client}`,
        record.deal && `Сделка: ${record.deal}`,
        record.policy && `Полис: ${record.policy}`,
        record.description && `Описание: ${record.description}`,
        record.amount && `Сумма: ${record.amount}`,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n\n');
}

export function RestoreStatementModal({
  name,
  onNameChange,
  error,
  busy,
  onClose,
  onSubmit,
}: {
  name: string;
  onNameChange: (name: string) => void;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Modal
      title="Восстановить ведомость"
      onClose={onClose}
      closeOnEscape={!busy}
      hideCloseButton={busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <label htmlFor="restore-statement-name" className="block text-sm font-semibold">
          Название
        </label>
        <input
          id="restore-statement-name"
          className="field field-input mt-2"
          required
          value={name}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'restore-statement-error' : undefined}
          onChange={(event) => onNameChange(event.target.value)}
        />
        {error && (
          <p id="restore-statement-error" role="alert" className="app-alert app-alert-danger mt-2">
            {error}
          </p>
        )}
        <p className="my-4 text-sm text-slate-600">
          Свободные записи будут возвращены в ведомость. Для остальных записей появится отчёт с
          причинами пропуска.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? 'Восстанавливаем…' : 'Восстановить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function RestoreStatementReport({
  result,
  onClose,
}: {
  result: RestoreFinanceStatementResult;
  onClose: () => void;
}) {
  const [copyMessage, setCopyMessage] = useState('');
  const report = buildRestoreReport(result);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyMessage('Отчёт скопирован.');
    } catch {
      setCopyMessage('Не удалось скопировать. Выделите текст отчёта и скопируйте вручную.');
    }
  };
  return (
    <Modal
      title="Результат восстановления ведомости"
      onClose={onClose}
      closeOnEscape={false}
      closeOnOverlayClick={false}
      hideCloseButton
      size="lg"
    >
      <pre className="whitespace-pre-wrap break-words select-text text-sm">{report}</pre>
      {copyMessage && (
        <p role="status" className="mt-3 text-sm">
          {copyMessage}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" onClick={() => void copy()}>
          Скопировать
        </Button>
        <Button type="button" variant="primary" onClick={onClose}>
          ОК
        </Button>
      </div>
    </Modal>
  );
}
