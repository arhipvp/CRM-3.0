export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'primary';
}

const DANGER_DELETE_DEFAULTS = {
  confirmText: 'Удалить',
  tone: 'danger' as const,
};

export const confirmTexts = {
  deleteTask: (): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удаление задачи',
    message: 'Вы уверены, что хотите удалить задачу?',
  }),
  completeTask: (): ConfirmDialogOptions => ({
    title: 'Выполнение задачи',
    message: 'Отметить задачу выполненной?',
    confirmText: 'Подтвердить',
    tone: 'primary',
  }),
  deleteDeal: (): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить сделку',
    message: 'Вы уверены, что хотите удалить эту сделку?',
  }),
  deletePayment: (): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить платёж',
    message: 'Удалить платёж и все связанные записи?',
  }),
  deleteDriveFiles: (message: string): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить файлы',
    message,
  }),
  deleteNotebook: (name?: string): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить блокнот',
    message: `Удалить блокнот "${name ?? ''}"? Все файлы и заметки будут удалены.`,
  }),
  deleteNotebookSource: (): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить файл',
    message: 'Удалить файл из блокнота?',
  }),
  deleteChatSession: (): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить сессию',
    message: 'Удалить сессию чата?',
  }),
  deleteStatementDriveFiles: (count: number): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить файлы',
    message: `Удалить выбранные файлы (${count})?`,
  }),
  deleteStatementDriveFile: (name: string): ConfirmDialogOptions => ({
    ...DANGER_DELETE_DEFAULTS,
    title: 'Удалить файл',
    message: `Удалить файл "${name}"?`,
  }),
  markStatementAsPaid: (): ConfirmDialogOptions => ({
    title: 'Подтвердите выплату',
    message:
      'Если указать дату выплаты, ведомость будет считаться выплаченной. После сохранения редактирование и удаление ведомости будут недоступны, а всем записям будет проставлена дата выплаты.\n\nПродолжить?',
    confirmText: 'Продолжить',
    tone: 'primary',
  }),
};
