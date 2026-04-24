import type { Task } from '../../types';
import { ColoredLabel } from '../common/ColoredLabel';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_ACTIONS_CLASS_ROW_SM,
  TABLE_CELL_CLASS_SM,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatDate, formatDateTime } from '../views/dealsView/helpers';
import { PRIORITY_LABELS, STATUS_LABELS } from './constants';
import { DataTableShell } from '../common/table/DataTableShell';
import { EmptyTableState } from '../common/table/EmptyTableState';
import { useConfirm } from '../../hooks/useConfirm';
import { confirmTexts } from '../../constants/confirmTexts';
import { PromptDialog } from '../common/modal/PromptDialog';
import { useState } from 'react';

interface TaskTableProps {
  tasks: Task[];
  emptyMessage?: string;
  showDealColumn?: boolean;
  showActions?: boolean;
  showClientColumn?: boolean;
  showReminderColumn?: boolean;
  taskColumnClassName?: string;
  onMarkTaskDone?: (taskId: string, completionComment?: string) => void;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  completingTaskIds?: string[];
  onDealClick?: (dealId?: string) => void;
}

const DEFAULT_EMPTY_MESSAGE = 'Задач не найдено';

export function TaskTable({
  tasks,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  showDealColumn = true,
  showActions = false,
  showClientColumn = true,
  showReminderColumn = false,
  taskColumnClassName = '',
  onMarkTaskDone,
  onEditTask,
  onDeleteTask,
  completingTaskIds = [],
  onDealClick,
}: TaskTableProps) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(null);
  const [completionComment, setCompletionComment] = useState('');
  const hasActions =
    showActions && (Boolean(onMarkTaskDone) || Boolean(onEditTask) || Boolean(onDeleteTask));

  const baseColumnCount =
    1 +
    (showClientColumn ? 1 : 0) +
    (showDealColumn ? 1 : 0) +
    1 +
    1 +
    1 +
    1 +
    (showReminderColumn ? 1 : 0) +
    1 +
    1;

  const columnCount = baseColumnCount + (hasActions ? 1 : 0);

  const taskCellClassName = ['border border-slate-200 px-4 py-2 align-top', taskColumnClassName]
    .filter(Boolean)
    .join(' ');

  const handleDelete = async (taskId: string) => {
    if (!onDeleteTask) {
      return;
    }
    const confirmed = await confirm(confirmTexts.deleteTask());
    if (!confirmed) {
      return;
    }
    onDeleteTask(taskId).catch(() => undefined);
  };

  const openCompletionPrompt = (taskId: string) => {
    if (!onMarkTaskDone) {
      return;
    }
    setCompletionTaskId(taskId);
    setCompletionComment('');
  };

  const closeCompletionPrompt = () => {
    setCompletionTaskId(null);
    setCompletionComment('');
  };

  const handleCompleteTask = () => {
    if (!onMarkTaskDone || !completionTaskId) {
      return;
    }
    onMarkTaskDone(completionTaskId, completionComment.trim());
    closeCompletionPrompt();
  };

  const handleDealClick = (task: Task) => {
    if (!onDealClick || !task.dealId) {
      return;
    }
    onDealClick(task.dealId);
  };

  return (
    <>
      <DataTableShell>
        <table className="deals-table min-w-full table-fixed border-collapse text-left text-sm">
          <thead className={TABLE_THEAD_CLASS}>
            <tr>
              <TableHeadCell padding="sm" className={taskColumnClassName}>
                Задача
              </TableHeadCell>
              {showClientColumn && (
                <TableHeadCell padding="sm" className="w-[160px]">
                  Клиент
                </TableHeadCell>
              )}
              {showDealColumn && (
                <TableHeadCell padding="sm" className="w-[200px]">
                  Сделка
                </TableHeadCell>
              )}
              <TableHeadCell padding="sm" className="w-[120px]">
                Статус
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[120px]">
                Приоритет
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[130px]">
                Ответственный
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[120px]">
                Срок
              </TableHeadCell>
              {showReminderColumn && (
                <TableHeadCell padding="sm" className="w-[140px]">
                  Напоминание
                </TableHeadCell>
              )}
              <TableHeadCell padding="sm" className="w-[140px]">
                Создано
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[160px]">
                Выполнено
              </TableHeadCell>
              {hasActions && (
                <TableHeadCell padding="sm" align="right" className="w-[120px]">
                  Действия
                </TableHeadCell>
              )}
            </tr>
          </thead>

          <tbody className="bg-white">
            {tasks.map((task) => {
              const isDone = task.status === 'done';
              const isUrgent = task.priority === 'urgent';
              const checklistCount = task.checklist?.length ?? 0;

              return (
                <tr
                  key={task.id}
                  className={[
                    TABLE_ROW_CLASS,
                    task.deletedAt ? 'bg-rose-50/30 border-rose-300' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className={taskCellClassName}>
                    <p
                      className={`font-semibold leading-snug ${
                        isDone
                          ? isUrgent
                            ? 'text-rose-700 line-through'
                            : 'text-slate-500 line-through'
                          : isUrgent
                            ? 'text-rose-700'
                            : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p
                        className={`mt-1 text-xs leading-snug ${isDone ? 'text-slate-500 line-through' : 'text-slate-500'}`}
                      >
                        {task.description}
                      </p>
                    )}
                    <div className="mt-1 space-y-0 text-[11px] text-slate-400">
                      {task.createdByName && (
                        <p className="leading-tight">Создал {task.createdByName}</p>
                      )}
                      <p className="leading-tight">Чеклист: {checklistCount}</p>
                    </div>
                  </td>

                  {showClientColumn && (
                    <td className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-900`}>
                      {task.clientName || '-'}
                    </td>
                  )}

                  {showDealColumn && (
                    <td className={`${TABLE_CELL_CLASS_SM} align-top text-xs`}>
                      {task.dealId ? (
                        <button
                          type="button"
                          className="link-action text-left"
                          onClick={() => handleDealClick(task)}
                        >
                          {task.dealTitle || task.dealId}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}

                  <td
                    className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700 whitespace-nowrap`}
                  >
                    {STATUS_LABELS[task.status] || task.status}
                  </td>
                  <td
                    className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700 whitespace-nowrap`}
                  >
                    {PRIORITY_LABELS[task.priority] || task.priority}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700`}>
                    <ColoredLabel
                      value={task.assigneeName || task.assignee || undefined}
                      fallback="-"
                      className="truncate text-xs font-semibold text-slate-600"
                    />
                  </td>
                  <td
                    className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700 whitespace-nowrap`}
                  >
                    {formatDate(task.dueAt)}
                  </td>

                  {showReminderColumn && (
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700 whitespace-nowrap`}
                    >
                      {formatDate(task.remindAt)}
                    </td>
                  )}

                  <td
                    className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700 whitespace-nowrap`}
                  >
                    {formatDateTime(task.createdAt)}
                  </td>

                  <td className={`${TABLE_CELL_CLASS_SM} align-top text-xs text-slate-700`}>
                    {formatDateTime(task.completedAt)}
                    {isDone && (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                        Выполнил{' '}
                        <ColoredLabel
                          value={task.completedByName ?? undefined}
                          fallback="-"
                          className="text-[11px] font-semibold"
                        />
                        {task.completedAt && (
                          <span className="text-[11px] text-slate-400">
                            в {formatDateTime(task.completedAt)}
                          </span>
                        )}
                      </p>
                    )}
                    {isDone && task.completionComment && (
                      <p className="mt-1 text-[11px] font-medium leading-snug text-sky-700">
                        Комментарий: {task.completionComment}
                      </p>
                    )}
                  </td>

                  {hasActions && (
                    <td className={`${TABLE_CELL_CLASS_SM} align-top text-right text-xs`}>
                      <div className={TABLE_ACTIONS_CLASS_ROW_SM}>
                        {onMarkTaskDone && task.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => openCompletionPrompt(task.id)}
                            disabled={completingTaskIds.includes(task.id)}
                            className="icon-btn h-8 w-8 text-emerald-700 hover:bg-emerald-50"
                            aria-label="Отметить выполненной"
                            title="Отметить выполненной"
                          >
                            {completingTaskIds.includes(task.id) ? '…' : '✓'}
                          </button>
                        )}
                        {onEditTask && (
                          <button
                            type="button"
                            onClick={() => onEditTask(task.id)}
                            className="icon-btn h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-sky-700"
                            aria-label="Редактировать"
                            title="Редактировать"
                          >
                            ✎
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="icon-btn h-8 w-8 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                            aria-label="Удалить"
                            title="Удалить"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {!tasks.length && (
              <EmptyTableState colSpan={columnCount}>{emptyMessage}</EmptyTableState>
            )}
          </tbody>
        </table>
      </DataTableShell>
      <ConfirmDialogRenderer />
      <PromptDialog
        isOpen={Boolean(completionTaskId)}
        title="Выполнение задачи"
        label="Комментарий"
        value={completionComment}
        onChange={setCompletionComment}
        onCancel={closeCompletionPrompt}
        onConfirm={handleCompleteTask}
        confirmLabel="Завершить"
        placeholder="Например: посчитано в Сбер, клиенту отправлено"
        required={false}
      />
    </>
  );
}
