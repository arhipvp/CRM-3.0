import React from 'react';
import { Button } from '../../../common/Button';

import type { Client, InsuranceCompany, InsuranceType, SalesChannel } from '../../../../types';
import { Combobox } from '../../../common/forms/Combobox';

interface PolicyBasicsStepProps {
  number: string;
  onNumberChange: (value: string) => void;
  insuranceCompanyId: string;
  onInsuranceCompanyChange: (value: string) => void;
  loadingOptions: boolean;
  companies: InsuranceCompany[];
  insuranceTypeId: string;
  onInsuranceTypeChange: (value: string) => void;
  types: InsuranceType[];
  salesChannelId: string;
  onSalesChannelChange: (value: string) => void;
  salesChannels: SalesChannel[];
  clientQuery: string;
  onClientQueryChange: (value: string) => void;
  onClientQueryFocus: () => void;
  onClientQueryBlur: () => void;
  showClientSuggestions: boolean;
  filteredClients: Client[];
  onClientSelect: (client: Client) => void;
  onRequestAddClient: () => void;
  isVehicle: boolean;
  onIsVehicleChange: (next: boolean) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  vin: string;
  onVinChange: (value: string) => void;
  vehicleBrands: string[];
  vehicleModels: string[];
  showCascoFields: boolean;
  deductible: string;
  onDeductibleChange: (value: string) => void;
  officialDealer: boolean | null;
  onOfficialDealerChange: (value: boolean | null) => void;
  gap: boolean | null;
  onGapChange: (value: boolean | null) => void;
}

export const PolicyBasicsStep: React.FC<PolicyBasicsStepProps> = ({
  number,
  onNumberChange,
  insuranceCompanyId,
  onInsuranceCompanyChange,
  loadingOptions,
  companies,
  insuranceTypeId,
  onInsuranceTypeChange,
  types,
  salesChannelId,
  onSalesChannelChange,
  salesChannels,
  clientQuery,
  onClientQueryChange,
  onClientQueryFocus,
  onClientQueryBlur,
  showClientSuggestions,
  filteredClients,
  onClientSelect,
  onRequestAddClient,
  isVehicle,
  onIsVehicleChange,
  brand,
  onBrandChange,
  model,
  onModelChange,
  vin,
  onVinChange,
  vehicleBrands,
  vehicleModels,
  showCascoFields,
  deductible,
  onDeductibleChange,
  officialDealer,
  onOfficialDealerChange,
  gap,
  onGapChange,
}) => {
  const booleanToSelectValue = (value: boolean | null) =>
    value === null ? '' : value ? 'true' : 'false';
  const selectValueToBoolean = (value: string) => (value === '' ? null : value === 'true');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="app-label" htmlFor="policy-number-input">
            Номер полиса *
          </label>
          <input
            id="policy-number-input"
            type="text"
            value={number}
            onChange={(event) => onNumberChange(event.target.value)}
            className="field field-input mt-2"
            placeholder="001234567890"
          />
        </div>
        <div>
          <label className="app-label" htmlFor="policy-company-select">
            Страховая компания *
          </label>
          <select
            id="policy-company-select"
            value={insuranceCompanyId}
            onChange={(event) => onInsuranceCompanyChange(event.target.value)}
            disabled={loadingOptions}
            className="field field-input mt-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Выберите страховую компанию</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="app-label" htmlFor="policy-type-select">
            Тип страхования *
          </label>
          <select
            id="policy-type-select"
            value={insuranceTypeId}
            onChange={(event) => onInsuranceTypeChange(event.target.value)}
            disabled={loadingOptions}
            className="field field-input mt-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Выберите тип страхования</option>
            {types.map((insuranceType) => (
              <option key={insuranceType.id} value={insuranceType.id}>
                {insuranceType.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="app-label" htmlFor="policy-sales-channel-select">
            Канал продаж
          </label>
          <select
            id="policy-sales-channel-select"
            value={salesChannelId}
            onChange={(event) => onSalesChannelChange(event.target.value)}
            disabled={loadingOptions}
            className="field field-input mt-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Выберите канал продаж</option>
            {salesChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="app-label" htmlFor="policy-client-combobox">
          Страхователь
        </label>
        <div className="mt-2 relative flex flex-col gap-2">
          <div className="relative flex items-center gap-2">
            <Combobox
              id="policy-client-combobox"
              value={clientQuery}
              options={filteredClients}
              isOpen={showClientSuggestions}
              onOpen={onClientQueryFocus}
              onClose={onClientQueryBlur}
              onChange={onClientQueryChange}
              onSelect={onClientSelect}
              getOptionKey={(client) => client.id}
              getOptionLabel={(client) => client.name}
              placeholder="Начните вводить клиента"
              emptyMessage="Клиенты не найдены"
            />
            <Button
              type="button"
              onClick={onRequestAddClient}
              icon="plus"
              className="btn btn-sm btn-secondary whitespace-nowrap"
            >
              Добавить клиента
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="app-label">Привязать к транспорту</span>
          <label className="flex items-center gap-3 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={isVehicle}
              onChange={(event) => onIsVehicleChange(event.target.checked)}
              className="check"
            />
            <span className="text-sm font-semibold text-slate-700">Да</span>
          </label>
        </div>
      </div>

      {isVehicle && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="app-label" htmlFor="policy-vehicle-brand">
              Марка
            </label>
            <input
              id="policy-vehicle-brand"
              list="vehicle-brand-options"
              type="text"
              value={brand}
              onChange={(event) => onBrandChange(event.target.value)}
              className="field field-input mt-2"
              placeholder="Toyota"
            />
            <datalist id="vehicle-brand-options">
              {vehicleBrands.map((option, index) => (
                <option key={`brand-${index}-${option}`} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="app-label" htmlFor="policy-vehicle-model">
              Модель
            </label>
            <input
              id="policy-vehicle-model"
              list="vehicle-model-options"
              type="text"
              value={model}
              onChange={(event) => onModelChange(event.target.value)}
              className="field field-input mt-2"
              placeholder="Camry"
            />
            <datalist id="vehicle-model-options">
              {vehicleModels.map((option, index) => (
                <option key={`model-${index}-${option}`} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="app-label" htmlFor="policy-vehicle-vin">
              VIN
            </label>
            <input
              id="policy-vehicle-vin"
              type="text"
              value={vin}
              onChange={(event) => onVinChange(event.target.value)}
              maxLength={17}
              className="field field-input mt-2"
              placeholder="Номер шасси (17 символов)"
            />
          </div>
        </div>
      )}

      {showCascoFields && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="app-label" htmlFor="policy-deductible-input">
              Франшиза, ₽
            </label>
            <input
              id="policy-deductible-input"
              type="number"
              min="0"
              step="0.01"
              value={deductible}
              onChange={(event) => onDeductibleChange(event.target.value)}
              className="field field-input mt-2"
            />
          </div>
          <div>
            <label className="app-label" htmlFor="policy-official-dealer-select">
              Официальный дилер
            </label>
            <select
              id="policy-official-dealer-select"
              value={booleanToSelectValue(officialDealer)}
              onChange={(event) => onOfficialDealerChange(selectValueToBoolean(event.target.value))}
              className="field field-input mt-2"
            >
              <option value="">Не указано</option>
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
          </div>
          <div>
            <label className="app-label" htmlFor="policy-gap-select">
              Риск GAP
            </label>
            <select
              id="policy-gap-select"
              value={booleanToSelectValue(gap)}
              onChange={(event) => onGapChange(selectValueToBoolean(event.target.value))}
              className="field field-input mt-2"
            >
              <option value="">Не указано</option>
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
