import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ClientsView } from '../views/ClientsView';
import { DealsView } from '../views/DealsView';
import { RouteSkeleton } from './RouteSkeleton';
import type { AppRoutesProps } from './appRoutes.types';

const SellerDashboardView = lazy(async () => {
  const module = await import('../views/SellerDashboardView');
  return { default: module.SellerDashboardView };
});

const PoliciesView = lazy(async () => {
  const module = await import('../views/PoliciesView');
  return { default: module.PoliciesView };
});

const CommissionsView = lazy(async () => {
  const module = await import('../views/CommissionsView');
  return { default: module.CommissionsView };
});

const TasksView = lazy(async () => {
  const module = await import('../views/TasksView');
  return { default: module.TasksView };
});

const SettingsView = lazy(async () => {
  const module = await import('../views/SettingsView');
  return { default: module.SettingsView };
});

export const AppRoutes: React.FC<AppRoutesProps> = ({
  data,
  dealsActions,
  financeActions,
  filters,
  loading,
}) => (
  <Routes>
    <Route
      path="/seller-dashboard"
      element={
        <Suspense fallback={<RouteSkeleton />}>
          <SellerDashboardView />
        </Suspense>
      }
    />
    <Route
      path="/deals"
      element={
        <DealsView
          deals={data.deals}
          clients={data.clients}
          onClientEdit={dealsActions.onClientEdit}
          policies={data.policies}
          payments={data.payments}
          financialRecords={data.financialRecords}
          tasks={data.tasks}
          users={data.users}
          currentUser={data.currentUser}
          selectedDealId={dealsActions.selectedDealId}
          isDealFocusCleared={dealsActions.isDealFocusCleared}
          dealRowFocusRequest={dealsActions.dealRowFocusRequest}
          onSelectDeal={dealsActions.onSelectDeal}
          onClearDealFocus={dealsActions.onClearDealFocus}
          onCloseDeal={dealsActions.onCloseDeal}
          onReopenDeal={dealsActions.onReopenDeal}
          onUpdateDeal={dealsActions.onUpdateDeal}
          onRefreshDeal={dealsActions.onRefreshDeal}
          onPinDeal={dealsActions.onPinDeal}
          onUnpinDeal={dealsActions.onUnpinDeal}
          onPostponeDeal={dealsActions.onPostponeDeal}
          onRequestAddQuote={dealsActions.onRequestAddQuote}
          onRequestEditQuote={dealsActions.onRequestEditQuote}
          onRequestAddPolicy={dealsActions.onRequestAddPolicy}
          onRequestEditPolicy={dealsActions.onRequestEditPolicy}
          pendingDealClientId={dealsActions.pendingDealClientId}
          onPendingDealClientConsumed={dealsActions.onPendingDealClientConsumed}
          onDeleteQuote={dealsActions.onDeleteQuote}
          onDeletePolicy={dealsActions.onDeletePolicy}
          onAddPayment={financeActions.onAddPayment}
          onUpdatePayment={financeActions.onUpdatePayment}
          onAddFinancialRecord={financeActions.onAddFinancialRecord}
          onUpdateFinancialRecord={financeActions.onUpdateFinancialRecord}
          onDeleteFinancialRecord={financeActions.onDeleteFinancialRecord}
          onDeletePayment={financeActions.onDeletePayment}
          onDriveFolderCreated={dealsActions.onDriveFolderCreated}
          onCreateDealMailbox={dealsActions.onCreateDealMailbox}
          onCheckDealMailbox={dealsActions.onCheckDealMailbox}
          onFetchChatMessages={dealsActions.onFetchChatMessages}
          onSendChatMessage={dealsActions.onSendChatMessage}
          onDeleteChatMessage={dealsActions.onDeleteChatMessage}
          onFetchDealHistory={dealsActions.onFetchDealHistory}
          onCreateTask={dealsActions.onCreateTask}
          onUpdateTask={dealsActions.onUpdateTask}
          onDeleteTask={dealsActions.onDeleteTask}
          onDeleteDeal={dealsActions.onDeleteDeal}
          onRestoreDeal={dealsActions.onRestoreDeal}
          onMergeDeals={dealsActions.onMergeDeals}
          dealSearch={filters.dealSearch}
          onDealSearchChange={filters.onDealSearchChange}
          dealExecutorFilter={filters.dealExecutorFilter}
          onDealExecutorFilterChange={filters.onDealExecutorFilterChange}
          dealShowDeleted={filters.dealShowDeleted}
          onDealShowDeletedChange={filters.onDealShowDeletedChange}
          dealShowClosed={filters.dealShowClosed}
          onDealShowClosedChange={filters.onDealShowClosedChange}
          dealOrdering={filters.dealOrdering}
          onDealOrderingChange={filters.onDealOrderingChange}
          onDealSelectionBlockedChange={dealsActions.onDealSelectionBlockedChange}
          onRequestAddClient={dealsActions.onRequestAddClient}
          onPolicyDraftReady={dealsActions.onPolicyDraftReady}
          onRefreshPolicies={dealsActions.onRefreshPolicies}
          onLoadMoreDeals={loading.onLoadMoreDeals}
          dealsHasMore={loading.dealsHasMore}
          dealsTotalCount={loading.dealsTotalCount}
          isLoadingMoreDeals={loading.isLoadingMoreDeals}
          isBackgroundRefreshingDeals={loading.isBackgroundRefreshingDeals}
          isSelectedDealTasksLoading={loading.isSelectedDealTasksLoading}
          isSelectedDealQuotesLoading={loading.isSelectedDealQuotesLoading}
        />
      }
    />
    <Route
      path="/clients"
      element={
        <ClientsView
          clients={data.clients}
          deals={data.deals}
          onClientEdit={dealsActions.onClientEdit}
          onClientDelete={dealsActions.onClientDelete}
          onClientMerge={dealsActions.onClientMerge}
          onClientFindSimilar={dealsActions.onClientFindSimilar}
        />
      }
    />
    <Route
      path="/policies"
      element={
        <Suspense fallback={<RouteSkeleton />}>
          <div className="space-y-3">
            {loading.isBackgroundRefreshingPoliciesList && (
              <div className="app-panel-muted px-4 py-2 text-xs font-semibold text-sky-800">
                Обновляем список полисов...
              </div>
            )}
            <PoliciesView
              policies={data.policiesList}
              clients={data.clients}
              payments={data.payments}
              onDealSelect={dealsActions.onSelectDeal}
              onDealPreview={dealsActions.onDealPreview}
              onClientEdit={dealsActions.onClientEdit}
              onRequestEditPolicy={dealsActions.onRequestEditPolicy}
              onAddFinancialRecord={financeActions.onAddFinancialRecord}
              onUpdateFinancialRecord={financeActions.onUpdateFinancialRecord}
              onDeleteFinancialRecord={financeActions.onDeleteFinancialRecord}
              onDeletePayment={financeActions.onDeletePayment}
              onRefreshPoliciesList={dealsActions.onRefreshPoliciesList}
              onLoadMorePolicies={loading.onLoadMorePolicies}
              policiesHasMore={loading.policiesHasMore}
              isLoadingMorePolicies={loading.isLoadingMorePolicies}
              isPoliciesLoading={loading.isPoliciesListLoading}
            />
          </div>
        </Suspense>
      }
    />
    <Route
      path="/commissions"
      element={
        <Suspense fallback={<RouteSkeleton />}>
          <div className="space-y-3">
            {loading.isBackgroundRefreshingFinance && (
              <div className="app-panel-muted px-4 py-2 text-xs font-semibold text-sky-800">
                Обновляем финансовые данные...
              </div>
            )}
            <CommissionsView
              payments={data.payments}
              financialRecords={data.financialRecords}
              policies={data.policies}
              statements={data.statements}
              isLoading={loading.isFinanceDataLoading}
              onDealSelect={dealsActions.onSelectDeal}
              onDealPreview={dealsActions.onDealPreview}
              onRequestEditPolicy={dealsActions.onRequestEditPolicy}
              onUpdateFinancialRecord={financeActions.onUpdateFinancialRecord}
              onCreateStatement={financeActions.onCreateFinanceStatement}
              onDeleteStatement={financeActions.onDeleteFinanceStatement}
              onUpdateStatement={financeActions.onUpdateFinanceStatement}
              onRemoveStatementRecords={financeActions.onRemoveFinanceStatementRecords}
            />
          </div>
        </Suspense>
      }
    />
    <Route path="/payments" element={<Navigate to="/commissions" replace />} />
    <Route
      path="/tasks"
      element={
        <Suspense fallback={<RouteSkeleton />}>
          <TasksView
            tasks={data.tasks}
            currentUser={data.currentUser}
            isLoading={loading.isTasksLoading}
            isBackgroundRefreshing={loading.isBackgroundRefreshingTasks}
            onDealSelect={dealsActions.onSelectDeal}
            onDealPreview={dealsActions.onDealPreview}
          />
        </Suspense>
      }
    />
    <Route
      path="/settings"
      element={
        <Suspense fallback={<RouteSkeleton />}>
          <SettingsView />
        </Suspense>
      }
    />
    <Route path="*" element={<Navigate to="/deals" replace />} />
  </Routes>
);
