import { useEffect, useMemo, useState } from 'react';

import type { Statement } from '../../../../types';
import { formatDateRu } from '../../../../utils/formatting';

interface UseCommissionsViewModelArgs {
  statements: Statement[];
  statementsById: Map<string, Statement>;
  viewMode: 'all' | 'statements';
  targetStatementId: string;
}

export const useCommissionsViewModel = ({
  statements,
  statementsById,
  viewMode,
  targetStatementId,
}: UseCommissionsViewModelArgs) => {
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

  useEffect(() => {
    if (viewMode === 'all') {
      setSelectedStatementId(null);
      return;
    }
    if (!statements.length) {
      setSelectedStatementId(null);
      return;
    }
    if (!selectedStatementId || !statementsById.has(selectedStatementId)) {
      setSelectedStatementId(statements[0].id);
    }
  }, [selectedStatementId, statements, statementsById, viewMode]);

  const selectedStatement = useMemo(
    () => (selectedStatementId ? statementsById.get(selectedStatementId) : undefined),
    [selectedStatementId, statementsById],
  );

  const isSelectedStatementPaid = Boolean(selectedStatement?.paidAt);
  const selectedStatementTypeLabel = selectedStatement
    ? selectedStatement.statementType === 'income'
      ? 'Доходы'
      : 'Расходы'
    : '';
  const selectedStatementStatusLabel = selectedStatement
    ? selectedStatement.paidAt
      ? 'Выплачена'
      : 'Черновик'
    : '';
  const selectedStatementPaidAt = selectedStatement?.paidAt
    ? formatDateRu(selectedStatement.paidAt)
    : null;

  const attachStatement =
    viewMode === 'all'
      ? targetStatementId
        ? statementsById.get(targetStatementId)
        : undefined
      : selectedStatement;
  const isAttachStatementPaid = Boolean(attachStatement?.paidAt);

  return {
    selectedStatementId,
    setSelectedStatementId,
    selectedStatement,
    isSelectedStatementPaid,
    selectedStatementTypeLabel,
    selectedStatementStatusLabel,
    selectedStatementPaidAt,
    attachStatement,
    isAttachStatementPaid,
  };
};
