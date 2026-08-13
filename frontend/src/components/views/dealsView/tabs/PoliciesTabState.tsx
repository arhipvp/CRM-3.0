import { Button } from '../../../common/Button';
import type { usePoliciesTabController } from './usePoliciesTabController';

type ViewModel = ReturnType<typeof usePoliciesTabController>;
type StateModel = Exclude<ViewModel, { kind: 'ready' }>;

export function PoliciesTabState({ viewModel }: { viewModel: StateModel }) {
  if (viewModel.kind === 'empty') return null;
  if (viewModel.kind === 'loading') {
    return (
      <section className="app-panel p-4 shadow-none space-y-3">
        <div className="flex items-center justify-between">
          <p className="app-label">Полисы</p>
          <span className="text-xs text-slate-500">Загружаем...</span>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-9 rounded-lg bg-slate-200" />
          <div className="h-9 rounded-lg bg-slate-200" />
          <div className="h-9 rounded-lg bg-slate-200" />
        </div>
      </section>
    );
  }
  return (
    <section className="app-panel p-4 shadow-none space-y-3">
      {viewModel.policyFileUpload}
      <div className="ui-panel-muted-text">Для сделки пока нет полисов.</div>
      <Button
        type="button"
        onClick={() => viewModel.onRequestAddPolicy(viewModel.selectedDealId)}
        variant="primary"
        className="rounded-xl self-start"
      >
        Создать полис
      </Button>
    </section>
  );
}
