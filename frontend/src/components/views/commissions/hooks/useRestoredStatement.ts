import { useEffect, useMemo, useState } from 'react';

import type { Statement } from '../../../../types';
import { mergeRestoredStatement } from '../statementRestoreUtils';

export const useRestoredStatement = (loadedStatements: Statement[]) => {
  const [restoredStatement, setRestoredStatement] = useState<Statement | null>(null);
  const statements = useMemo(
    () => mergeRestoredStatement(loadedStatements, restoredStatement),
    [loadedStatements, restoredStatement],
  );

  useEffect(() => {
    if (
      restoredStatement &&
      loadedStatements.some((item) => item.id === restoredStatement.id && !item.deletedAt)
    ) {
      setRestoredStatement(null);
    }
  }, [loadedStatements, restoredStatement]);

  return { statements, setRestoredStatement };
};
