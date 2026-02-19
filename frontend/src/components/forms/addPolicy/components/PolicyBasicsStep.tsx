import React from 'react';

import type { Client, InsuranceCompany, InsuranceType, SalesChannel } from '../../../../types';

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
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="app-label">Номер полиса *</label>
          <input
            type="text"
            value={number}
            onChange={(event) => onNumberChange(event.target.value)}
            className="field field-input mt-2"
            placeholder="001234567890"
          />
        </div>
        <div>
          <label className="app-label">Страховая компания *</label>
          <select
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="app-label">Тип страхования *</label>
          <select
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
          <label className="app-label">Канал продаж</label>
          <select
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
        <label className="app-label">Страхователь</label>
        <div className="mt-2 relative flex flex-col gap-2">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={clientQuery}
                onFocus={onClientQueryFocus}
                onChange={(event) => onClientQueryChange(event.target.value)}
                onBlur={onClientQueryBlur}
                className="field field-input"
                placeholder="Начните вводить клиента"
              />
              {showClientSuggestions && (
                <div className="absolute inset-x-0 top-full z-10 mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filteredClients.length ? (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onClientSelect(client);
                        }}
                      >
                        {client.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">Клиенты не найдены</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onRequestAddClient}
              className="btn btn-sm btn-secondary whitespace-nowrap"
            >
              + Добавить клиента
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="app-label">Привязать к транспорту</label>
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
            <label className="app-label">Марка</label>
            <input
              list="vehicle-brand-options"
              type="text"
              value={brand}
              onChange={(event) => onBrandChange(event.target.value)}
              className="field field-input mt-2"
              placeholder="Toyota"
            />
            <datalist id="vehicle-brand-options">
              {vehicleBrands.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="app-label">Модель</label>
            <input
              list="vehicle-model-options"
              type="text"
              value={model}
              onChange={(event) => onModelChange(event.target.value)}
              className="field field-input mt-2"
              placeholder="Camry"
            />
            <datalist id="vehicle-model-options">
              {vehicleModels.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="app-label">VIN</label>
            <input
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
    </div>
  );
};
