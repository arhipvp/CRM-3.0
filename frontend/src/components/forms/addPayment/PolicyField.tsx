import React from 'react';
import type { Policy } from '../../../types';

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
      <div className="form-group">
        <label htmlFor="policyId">Полис *</label>
        <input type="text" id="policyId" name="policyId" value={fixedPolicyDisplay} disabled required />
        {fixedPolicy?.insuranceType && (
          <p className="text-xs text-slate-500 mt-1">{fixedPolicy.insuranceType}</p>
        )}
      </div>
    );
  }

  if (hasPolicyOptions) {
    return (
      <div className="form-group">
        <label htmlFor="policyId">Полис *</label>
        <select
          id="policyId"
          name="policyId"
          value={policyId || ''}
          onChange={onChange}
          disabled={loading}
          required
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
    <div className="form-group">
      <label htmlFor="policyId">Полис *</label>
      <input
        type="text"
        id="policyId"
        name="policyId"
        value={policyId || ''}
        onChange={onChange}
        placeholder="ID полиса"
        disabled={loading}
        required
      />
    </div>
  );
};
