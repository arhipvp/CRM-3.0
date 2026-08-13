import { useState } from 'react';

import { Modal } from '../Modal';
import { AppIcon, type AppIconName } from '../common/AppIcon';
import { Button, IconButton, type ButtonVariant } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { InlineAlert, type InlineAlertTone } from '../common/InlineAlert';
import { KpiCard } from '../common/KpiCard';
import { LoadingState, Spinner } from '../common/LoadingState';
import {
  PageHeader,
  PageShell,
  Panel,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
  type SemanticTone,
} from '../common/layoutPrimitives';
import { Tabs } from '../common/Tabs';
import { DataTableShell } from '../common/table/DataTableShell';
import { TableHeadCell } from '../common/TableHeadCell';
import { CheckboxField } from '../common/forms/CheckboxField';
import { FormActions } from '../common/forms/FormActions';
import { FormField } from '../common/forms/FormField';

const buttonVariants: ButtonVariant[] = [
  'primary',
  'secondary',
  'quiet',
  'outline',
  'success',
  'warning',
  'danger',
  'link',
  'linkDanger',
];
const alertTones: InlineAlertTone[] = ['neutral', 'brand', 'info', 'success', 'warning', 'danger'];
const semanticTones: SemanticTone[] = [
  'neutral',
  'brand',
  'info',
  'success',
  'warning',
  'danger',
  'income',
  'expense',
  'balance',
  'due',
  'overdue',
  'selected',
];
const iconNames = [
  'dashboard',
  'deals',
  'clients',
  'policies',
  'finance',
  'tasks',
  'settings',
  'plus',
  'logout',
  'collapse',
  'expand',
  'close',
  'edit',
  'delete',
  'refresh',
  'search',
  'file',
  'folder',
  'upload',
  'download',
  'copy',
  'check',
  'pin',
  'pinOff',
  'duplicate',
  'normalize',
  'chevronLeft',
  'chevronRight',
  'arrowRight',
  'sortAsc',
  'sortDesc',
  'whatsapp',
  'telegram',
] as const satisfies readonly AppIconName[];

export function UiCatalogPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [segment, setSegment] = useState<'month' | 'year'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <PageShell data-testid="ui-catalog">
      <PageHeader
        eyebrow="DEV ONLY"
        title="Каталог дизайн-системы"
        description="Интерактивная проверка всех общих состояний без API-запросов."
        actions={<Button onClick={() => setIsModalOpen(true)}>Открыть модальное окно</Button>}
      />

      <Panel className="space-y-4">
        <SectionHeader title="Кнопки" description="Варианты, размеры и состояния." />
        <div className="flex flex-wrap items-center gap-3">
          {buttonVariants.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Маленькая</Button>
          <Button isLoading>Загрузка</Button>
          <Button disabled>Недоступна</Button>
          <IconButton icon="edit" label="Редактировать" />
          <IconButton icon="delete" label="Удалить" tone="danger" />
        </div>
      </Panel>

      <Panel className="space-y-4">
        <SectionHeader
          title="Иконки"
          description="Полный монохромный набор и примеры семантических действий."
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {iconNames.map((name) => (
            <div
              key={name}
              className="flex min-h-16 items-center gap-3 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2"
            >
              <AppIcon name={name} size={20} title={name} className="shrink-0 text-slate-700" />
              <code className="truncate text-xs text-slate-600">{name}</code>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton icon="pin" label="Закрепить" />
          <IconButton icon="delete" label="Удалить" tone="danger" />
          <IconButton icon="edit" label="Редактировать недоступно" disabled />
          <Button icon="plus" variant="primary">
            Создать
          </Button>
          <Button icon="arrowRight" iconPosition="end">
            Перейти
          </Button>
          <Button icon="delete" variant="danger">
            Удалить
          </Button>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <SectionHeader title="Семантические состояния" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {semanticTones.map((tone, index) => (
            <KpiCard
              key={tone}
              tone={tone}
              label={tone}
              value={index + 12}
              hint="Пример показателя"
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {semanticTones.map((tone) => (
            <StatusBadge key={tone} tone={tone} dot>
              {tone}
            </StatusBadge>
          ))}
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {alertTones.map((tone) => (
            <InlineAlert key={tone} tone={tone}>
              Сообщение состояния: {tone}
            </InlineAlert>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-4">
        <SectionHeader title="Формы" />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Название клиента"
            htmlFor="catalog-client"
            required
            hint="Краткая подсказка"
          >
            <input id="catalog-client" className="field field-input" defaultValue="ООО Пример" />
          </FormField>
          <FormField label="Поле с ошибкой" htmlFor="catalog-error" error="Проверьте значение">
            <input id="catalog-error" className="field field-input" aria-invalid="true" />
          </FormField>
          <FormField label="Тип полиса" htmlFor="catalog-select">
            <select id="catalog-select" className="field field-select" defaultValue="osago">
              <option value="osago">ОСАГО</option>
              <option value="kasko">КАСКО</option>
            </select>
          </FormField>
          <CheckboxField
            id="catalog-check"
            label="Получать уведомления"
            description="Локальный пример"
            defaultChecked
          />
        </div>
        <FormActions submitLabel="Сохранить" onCancel={() => undefined} />
      </Panel>

      <Panel className="space-y-4">
        <SectionHeader title="Навигация и загрузка" />
        <Tabs
          idPrefix="catalog-tab"
          ariaLabel="Пример вкладок"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'overview', label: 'Обзор', count: 3 },
            { value: 'details', label: 'Детали' },
          ]}
        />
        <SegmentedControl
          ariaLabel="Период"
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'month', label: 'Месяц' },
            { value: 'year', label: 'Год' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Spinner size="sm" />
          <Spinner />
          <LoadingState compact />
        </div>
        <EmptyState title="Данных пока нет" actions={<Button size="sm">Создать запись</Button>}>
          Добавьте первую запись, чтобы она появилась в таблице.
        </EmptyState>
      </Panel>

      <Panel className="space-y-4">
        <SectionHeader title="Таблица" />
        <DataTableShell>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <TableHeadCell>Клиент</TableHeadCell>
                <TableHeadCell>Статус</TableHeadCell>
                <TableHeadCell align="right">Сумма</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[var(--app-border)] px-4 py-3">ООО Пример</td>
                <td className="border border-[var(--app-border)] px-4 py-3">
                  <StatusBadge tone="success">Оплачен</StatusBadge>
                </td>
                <td className="border border-[var(--app-border)] px-4 py-3 text-right">42 000 ₽</td>
              </tr>
            </tbody>
          </table>
        </DataTableShell>
      </Panel>

      {isModalOpen && (
        <Modal title="Пример модального окна" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <InlineAlert tone="info">Модальное окно использует локальное состояние.</InlineAlert>
            <Button icon="check" onClick={() => setIsModalOpen(false)}>
              Готово
            </Button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
