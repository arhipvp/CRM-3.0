import React from 'react';

interface VehicleDetailsProps {
  brand?: string | null;
  model?: string | null;
  vin?: string | null;
  placeholder?: string;
}

const nonEmpty = (value?: string | null): value is string =>
  Boolean(value && value.trim());

export const VehicleDetails: React.FC<VehicleDetailsProps> = ({
  brand,
  model,
  vin,
  placeholder,
}) => {
  if (!nonEmpty(brand) && !nonEmpty(model) && !nonEmpty(vin)) {
    return <span className="text-xs text-slate-400">{placeholder ?? '—'}</span>;
  }

  return (
    <div className="space-y-1 text-xs text-slate-600">
      {nonEmpty(brand) && (
        <div>
          <span className="font-semibold text-slate-900">Марка:</span> {brand}
        </div>
      )}
      {nonEmpty(model) && (
        <div>
          <span className="font-semibold text-slate-900">Модель:</span> {model}
        </div>
      )}
      {nonEmpty(vin) && (
        <div>
          <span className="font-semibold text-slate-900">VIN:</span> {vin}
        </div>
      )}
    </div>
  );
};
