import React from 'react';
import type { Policy } from '../../../types';
import { FORM_INPUT_DISABLED } from '../../common/forms/formClassNames';

interface PolicyFieldProps {
  policyId: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;
  policyOptions: Policy[];
  loading: boolean;
  fixedPolicyId?: string;
  fixedPolicyDisplay?: string;
  fixedPolicy?: Policy;
}

export const PolicyField: React.FC<PolicyFieldProps> = ({
  policyId,
  onChange,
  policyOptions,
  loading,
  fixedPolicyId,
  fixedPolicyDisplay,
  fixedPolicy,
}) => {
  const hasPolicyOptions = policyOptions.length > 0;

  if (fixedPolicyId) {
    return (
      <div className="space-y-2">
        <label htmlFor="policyId" className="app-label">
          Полис *
        </label>
        <input
          type="text"
          id="policyId"
          name="policyId"
          value={fixedPolicyDisplay}
          disabled
          required
          className={FORM_INPUT_DISABLED}
        />
        {fixedPolicy?.insuranceType && (
          <p className="text-sm text-slate-600">{fixedPolicy.insuranceType}</p>
        )}
      </div>
    );
  }

  if (hasPolicyOptions) {
    return (
      <div className="space-y-2">
        <label htmlFor="policyId" className="app-label">
          Полис *
        </label>
        <select
          id="policyId"
          name="policyId"
          value={policyId || ''}
          onChange={onChange}
          disabled={loading}
          required
          className={FORM_INPUT_DISABLED}
        >
          <option value="">Выберите полис</option>
          {policyOptions.map((policy) => (
            <option key={policy.id} value={policy.id}>
              {policy.number || policy.id}
              {policy.insuranceType ? ` — ${policy.insuranceType}` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="policyId" className="app-label">
        Полис *
      </label>
      <input
        type="text"
        id="policyId"
        name="policyId"
        value={policyId || ''}
        onChange={onChange}
        placeholder="ID полиса"
        disabled={loading}
        required
        className={FORM_INPUT_DISABLED}
      />
    </div>
  );
};
