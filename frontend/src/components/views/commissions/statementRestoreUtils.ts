import type { Statement } from '../../../types';

export const MISSING_STATEMENT_SNAPSHOT =
  'Прежний состав ведомости не сохранён. Добавьте записи вручную';

export function mergeRestoredStatement(
  loadedStatements: Statement[],
  restoredStatement: Statement | null,
): Statement[] {
  if (!restoredStatement) return loadedStatements;
  const loaded = loadedStatements.find((item) => item.id === restoredStatement.id);
  if (loaded && !loaded.deletedAt) return loadedStatements;
  return [
    ...loadedStatements.filter((item) => item.id !== restoredStatement.id),
    restoredStatement,
  ];
}
