import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RouteSkeleton } from './RouteSkeleton';
import type { AppRoutesProps } from './appRoutes.types';
import {
  loadClientsView,
  loadCommissionsView,
  loadDealsView,
  loadPoliciesView,
  loadSellerDashboardView,
  loadSettingsView,
  loadTasksView,
} from './routeLoaders';

const ClientsView = lazy(async () => {
  const module = await loadClientsView();
  return { default: module.ClientsView };
});

const DealsView = lazy(async () => {
  const module = await loadDealsView();
  return { default: module.DealsView };
});

const SellerDashboardView = lazy(async () => {
  const module = await loadSellerDashboardView();
  return { default: module.SellerDashboardView };
});

const PoliciesView = lazy(async () => {
  const module = await loadPoliciesView();
  return { default: module.PoliciesView };
});

const CommissionsView = lazy(async () => {
  const module = await loadCommissionsView();
  return { default: module.CommissionsView };
});

const TasksView = lazy(async () => {
  const module = await loadTasksView();
  return { default: module.TasksView };
});

const SettingsView = lazy(async () => {
  const module = await loadSettingsView();
  return { default: module.SettingsView };
});

const UiCatalogPage = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('../dev/UiCatalogPage');
      return { default: module.UiCatalogPage };
    })
  : null;

export const AppRoutes: React.FC<AppRoutesProps> = ({
  data,
  dealsActions,
  financeActions,
  filters,
  loading,
}) => {
  const hasAnyFinanceData = data.statements.length > 0;
  const shouldBlockCommissionsView =
    !loading.hasCommissionsSnapshotLoaded && loading.isCommissionsDataLoading && !hasAnyFinanceData;

  return (
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
          <Suspense fallback={<RouteSkeleton />}>
            <DealsView
              deals={data.deals}
              clients={data.clients}
              clientDuplicateHints={data.clientDuplicateHints}
              onClientFindSimilar={dealsActions.onClientFindSimilar}
              onClientNormalizeName={dealsActions.onClientNormalizeName}
              onClientEdit={dealsActions.onClientEdit}
              onClientOpenById={dealsActions.onClientOpenById}
              policies={data.policies}
              payments={data.payments}
              financialRecords={data.financialRecords}
              tasks={data.tasks}
              users={data.users}
              currentUser={data.currentUser}
              selectedDealId={dealsActions.selectedDealId}
              isDealFocusCleared={dealsActions.isDealFocusCleared}
              dealRowFocusRequest={dealsActions.dealRowFocusRequest}
              dealAccessMessage={dealsActions.dealAccessMessage}
              onClearDealAccessMessage={dealsActions.onClearDealAccessMessage}
              onSelectDeal={dealsActions.onSelectDeal}
              onClearDealFocus={dealsActions.onClearDealFocus}
              onCloseDeal={dealsActions.onCloseDeal}
              onReopenDeal={dealsActions.onReopenDeal}
              onUpdateDeal={dealsActions.onUpdateDeal}
              onRefreshDeal={dealsActions.onRefreshDeal}
              onRefreshDealsList={dealsActions.onRefreshDealsList}
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
              onMovePolicy={dealsActions.onMovePolicy}
              onUpdatePolicyRenewed={dealsActions.onUpdatePolicyRenewed}
              onAddPayment={financeActions.onAddPayment}
              onUpdatePayment={financeActions.onUpdatePayment}
              onAddFinancialRecord={financeActions.onAddFinancialRecord}
              onUpdateFinancialRecord={financeActions.onUpdateFinancialRecord}
              onDeleteFinancialRecord={financeActions.onDeleteFinancialRecord}
              onDeletePayment={financeActions.onDeletePayment}
              onMarkPaymentPaid={financeActions.onMarkPaymentPaid}
              onMarkFinancialRecordPaid={financeActions.onMarkFinancialRecordPaid}
              onDriveFolderCreated={dealsActions.onDriveFolderCreated}
              onCreateDealMailbox={dealsActions.onCreateDealMailbox}
              onCheckDealMailbox={dealsActions.onCheckDealMailbox}
              onFetchChatMessages={dealsActions.onFetchChatMessages}
              onSendChatMessage={dealsActions.onSendChatMessage}
              onDeleteChatMessage={dealsActions.onDeleteChatMessage}
              onFetchDealHistory={dealsActions.onFetchDealHistory}
              onFetchDealEvents={dealsActions.onFetchDealEvents}
              dealEventsRefreshTokens={dealsActions.dealEventsRefreshTokens}
              onCreateDealEvent={dealsActions.onCreateDealEvent}
              onUpdateDealEvent={dealsActions.onUpdateDealEvent}
              onDeleteDealEvent={dealsActions.onDeleteDealEvent}
              onCreateTask={dealsActions.onCreateTask}
              onUpdateTask={dealsActions.onUpdateTask}
              onDeleteTask={dealsActions.onDeleteTask}
              onDeleteDeal={dealsActions.onDeleteDeal}
              onRestoreDeal={dealsActions.onRestoreDeal}
              onMergeDeals={dealsActions.onMergeDeals}
              dealSearch={filters.dealSearch}
              onDealSearchChange={filters.onDealSearchChange}
              onDealSearchSubmit={filters.onDealSearchSubmit}
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
              isRefreshingDealsList={loading.isRefreshingDealsList}
              isSelectedDealTasksLoading={loading.isSelectedDealTasksLoading}
              isSelectedDealQuotesLoading={loading.isSelectedDealQuotesLoading}
            />
          </Suspense>
        }
      />
      <Route
        path="/clients"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <ClientsView
              clients={data.clients}
              clientDuplicateHints={data.clientDuplicateHints}
              deals={data.deals}
              dealsTotalCount={loading.dealsTotalCount}
              onClientEdit={dealsActions.onClientEdit}
              onClientDelete={dealsActions.onClientDelete}
              onClientMerge={dealsActions.onClientMerge}
              onClientFindSimilar={dealsActions.onClientFindSimilar}
              onClientNormalizeName={dealsActions.onClientNormalizeName}
            />
          </Suspense>
        }
      />
      <Route
        path="/policies"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <PoliciesView
              policies={data.policiesList}
              deals={data.deals}
              clients={data.clients}
              clientDuplicateHints={data.clientDuplicateHints}
              payments={data.payments}
              onDealSelect={dealsActions.onSelectDeal}
              onDealPreview={dealsActions.onDealPreview}
              onClientEdit={dealsActions.onClientEdit}
              onClientOpenById={dealsActions.onClientOpenById}
              onClientFindSimilar={dealsActions.onClientFindSimilar}
              onClientNormalizeName={dealsActions.onClientNormalizeName}
              onRequestEditPolicy={dealsActions.onRequestEditPolicy}
              onMovePolicy={dealsActions.onMovePolicy}
              onAddFinancialRecord={financeActions.onAddFinancialRecord}
              onUpdateFinancialRecord={financeActions.onUpdateFinancialRecord}
              onDeleteFinancialRecord={financeActions.onDeleteFinancialRecord}
              onDeletePayment={financeActions.onDeletePayment}
              onMarkPaymentPaid={financeActions.onMarkPaymentPaid}
              onMarkFinancialRecordPaid={financeActions.onMarkFinancialRecordPaid}
              onRefreshPoliciesList={dealsActions.onRefreshPoliciesList}
              onLoadMorePolicies={loading.onLoadMorePolicies}
              policiesHasMore={loading.policiesHasMore}
              isLoadingMorePolicies={loading.isLoadingMorePolicies}
              isPoliciesLoading={loading.isPoliciesListLoading}
              policiesError={loading.policiesListError}
            />
          </Suspense>
        }
      />
      <Route
        path="/commissions"
        element={
          <Suspense fallback={<RouteSkeleton />}>
            <CommissionsView
              payments={data.payments}
              policies={data.policies}
              statements={data.statements}
              salesChannels={data.salesChannels}
              currentUser={data.currentUser}
              isLoading={shouldBlockCommissionsView}
              hasCommissionsSnapshotLoaded={loading.hasCommissionsSnapshotLoaded}
              onRefreshStatements={loading.onRefreshCommissionsSnapshot}
              onLoadMoreStatements={loading.onLoadMoreStatements}
              statementsTotalCount={loading.statementsTotalCount}
              statementsHasMore={loading.statementsHasMore}
              isLoadingMoreStatements={loading.isLoadingMoreStatements}
              onDealSelect={dealsActions.onSelectDeal}
              onDealPreview={dealsActions.onDealPreview}
              onRequestEditPolicy={dealsActions.onRequestEditPolicy}
              onUpdateFinancialRecord={financeActions.onUpdateFinancialRecord}
              onCreateStatement={financeActions.onCreateFinanceStatement}
              onDeleteStatement={financeActions.onDeleteFinanceStatement}
              onAttachStatementRecords={financeActions.onAttachFinanceStatementRecords}
              onUpdateStatement={financeActions.onUpdateFinanceStatement}
              onRemoveStatementRecords={financeActions.onRemoveFinanceStatementRecords}
              onApplyStatementAmount={financeActions.onApplyFinanceStatementAmount}
            />
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
              onRefreshTasks={loading.onRefreshTasks}
              page={loading.tasksPage}
              totalCount={loading.tasksTotalCount}
              onDealSelect={dealsActions.onSelectDeal}
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
      {UiCatalogPage && (
        <Route
          path="/dev/ui-kit"
          element={
            <Suspense fallback={<RouteSkeleton />}>
              <UiCatalogPage />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Navigate to="/deals" replace />} />
    </Routes>
  );
};
