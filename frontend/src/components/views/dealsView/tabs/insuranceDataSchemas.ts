import type { DataResource } from '../../../../api/insuranceData';

export interface DataField {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'checkbox' | 'textarea' | 'select' | 'links' | 'experience';
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
}
const current: DataField = {
  key: 'is_current',
  label: 'Актуальный',
  type: 'checkbox',
  defaultValue: true,
};
const links: DataField = {
  key: 'source_links',
  label: 'Документы и источники',
  type: 'links',
  defaultValue: [],
};
const notes: DataField = { key: 'notes', label: 'Примечание', type: 'textarea' };
const title: DataField = { key: 'title', label: 'Название', required: true };
const documentFields: DataField[] = [
  { key: 'series', label: 'Серия' },
  { key: 'number', label: 'Номер' },
  { key: 'issue_date', label: 'Дата выдачи', type: 'date' },
];
export const dataSchemas: Partial<Record<DataResource, DataField[]>> = {
  passports: [
    ...documentFields,
    { key: 'issued_by', label: 'Кем выдан' },
    { key: 'department_code', label: 'Код подразделения' },
    links,
    current,
  ],
  'driver-licenses': [
    { key: 'country', label: 'Страна', defaultValue: 'РФ' },
    ...documentFields,
    { key: 'expiry_date', label: 'Дата окончания', type: 'date' },
    { key: 'experience_start', label: 'Начало стажа (дата или год)', type: 'experience' },
    links,
    current,
  ],
  vehicles: [
    title,
    { key: 'vin', label: 'VIN' },
    { key: 'brand', label: 'Марка' },
    { key: 'model', label: 'Модель' },
    { key: 'year', label: 'Год выпуска', type: 'number' },
    { key: 'plate', label: 'Госномер' },
    { key: 'has_no_plate', label: 'Без госномера', type: 'checkbox' },
    { key: 'power_hp', label: 'Мощность, л.с.', type: 'number' },
    { key: 'mileage', label: 'Пробег, км', type: 'number' },
    { key: 'mileage_date', label: 'Дата фиксации пробега', type: 'date' },
    { key: 'key_count', label: 'Количество ключей', type: 'number', defaultValue: 2 },
    links,
    notes,
    current,
  ],
  'vehicle-registrations': [...documentFields, links, current],
  'vehicle-titles': [
    {
      key: 'document_type',
      label: 'Тип документа',
      type: 'select',
      defaultValue: 'pts',
      options: [
        { value: 'pts', label: 'ПТС' },
        { value: 'epts', label: 'ЭПТС' },
      ],
    },
    ...documentFields,
    links,
    current,
  ],
  mortgages: [
    title,
    { key: 'bank', label: 'Банк', type: 'select' },
    { key: 'agreement_number', label: 'Номер кредитного договора' },
    { key: 'agreement_date', label: 'Дата кредитного договора', type: 'date' },
    { key: 'end_date', label: 'Дата окончания кредита', type: 'date' },
    { key: 'interest_rate', label: 'Процентная ставка', type: 'number' },
    { key: 'property_type', label: 'Тип недвижимости' },
    { key: 'address', label: 'Адрес недвижимости' },
    { key: 'cadastral_number', label: 'Кадастровый номер' },
    { key: 'area', label: 'Площадь, м²', type: 'number' },
    { key: 'construction_year', label: 'Год постройки', type: 'number' },
    links,
    notes,
    current,
  ],
  'mortgage-balances': [
    { key: 'amount', label: 'Остаток задолженности, ₽', type: 'number', required: true },
    { key: 'as_of_date', label: 'На дату', type: 'date', required: true },
    links,
    current,
  ],
};
