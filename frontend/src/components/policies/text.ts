export const POLICY_PLACEHOLDER = '—';

export const POLICY_TEXT = {
  fields: {
    number: 'Номер',
    client: 'Клиент',
    company: 'Компания',
    channel: 'Канал',
    sum: 'Сумма',
    type: 'Тип',
    brand: 'Марка',
    model: 'Модель',
    vin: 'VIN',
    payments: 'Платежи',
  },
  actions: {
    edit: 'Редактировать',
    files: 'Файлы',
    delete: 'Удалить',
    openDeal: 'Открыть сделку',
    openClient: 'Открыть клиента',
    addPayment: '+ Добавить платёж',
    show: 'Показать',
    hide: 'Скрыть',
    details: 'Подробнее',
  },
  messages: {
    noPayments: 'Платежей пока нет.',
    noRecords: 'Записей нет',
  },
  badges: {
    unpaidPayments: 'Неоплаченные платежи',
    unpaidRecords: 'Неоплаченные записи',
  },
  filters: {
    unpaidPaymentsOnly: 'Только с неоплаченными платежами',
    unpaidRecordsOnly: 'Только с неоплаченными записями',
  },
  paymentTable: {
    amount: 'Сумма',
    description: 'Описание',
    scheduledAt: 'План',
    actualAt: 'Факт',
    incomes: 'Доходы',
    expenses: 'Расходы',
    actions: 'Действия',
    recordsCount: 'зап.',
    emptyDescription: 'Без описания',
    noDate: 'не оплачено',
  },
} as const;

// Возможные статусы полиса на будущее: действует / продлён / непродлён.
