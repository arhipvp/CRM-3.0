import type { AiClassification, AiDocument, AiScopeBranch } from '../../../api/aiAssistant';

export const scopeKey = (value: AiScopeBranch) =>
  value.unclassified
    ? 'unclassified'
    : [value.insurer, value.insurance_kind, value.product].filter(Boolean).join('::');

export const scopeLabel = (value: AiScopeBranch) =>
  value.unclassified
    ? 'Нераспределено'
    : [value.insurer, value.insurance_kind, value.product].filter(Boolean).join(' → ');

export const documentLabel = (value?: AiClassification | null) => {
  const parts = [value?.insurer, value?.insurance_kind, value?.product].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Нераспределено';
};

export const documentInLibraryBranch = (document: AiDocument, branch: AiScopeBranch | null) => {
  if (!branch) return true;
  const classification = document.classification;
  if (branch.unclassified)
    return !classification?.insurer && !classification?.insurance_kind && !classification?.product;
  return (
    (!branch.insurer || classification?.insurer === branch.insurer) &&
    (!branch.insurance_kind || classification?.insurance_kind === branch.insurance_kind) &&
    (!branch.product || classification?.product === branch.product)
  );
};

export const documentStatus = (status: string) => {
  const labels: Record<string, string> = {
    queued: 'В очереди',
    indexing: 'Обрабатывается',
    processing: 'Обрабатывается',
    ready: 'Готово',
    failed: 'Ошибка',
  };
  return labels[status] ?? status;
};

export const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    queued: 'bg-amber-50 text-amber-800',
    indexing: 'bg-blue-50 text-blue-800',
    processing: 'bg-blue-50 text-blue-800',
    ready: 'bg-emerald-50 text-emerald-800',
    failed: 'bg-red-50 text-red-800',
  };
  return classes[status] ?? 'bg-slate-100 text-slate-700';
};
