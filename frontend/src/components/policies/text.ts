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
    addPayment: '+ Добавить платёж',
    show: 'Показать',
    hide: 'Скрыть',
  },
  messages: {
    noPayments: 'Платежей пока нет.',
  },
  filters: {
    unpaidOnly: 'Показывать только неоплаченные',
  },
} as const;

