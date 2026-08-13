import React from 'react';

import { Button } from '../common/Button';
import { PolicyBasicsStep } from './addPolicy/components/PolicyBasicsStep';
import { PolicyFinanceStep } from './addPolicy/components/PolicyFinanceStep';
import { PolicyPaymentsStep } from './addPolicy/components/PolicyPaymentsStep';
import {
  type AddPolicyFormProps,
  useAddPolicyFormController,
} from './addPolicy/useAddPolicyFormController';

export const AddPolicyForm: React.FC<AddPolicyFormProps> = (props) => {
  const {
    number,
    setNumber,
    insuranceCompanyId,
    setInsuranceCompanyId,
    insuranceTypeId,
    setInsuranceTypeId,
    isVehicle,
    setIsVehicle,
    brand,
    setBrand,
    model,
    setModel,
    vin,
    setVin,
    deductible,
    setDeductible,
    officialDealer,
    setOfficialDealer,
    gap,
    setGap,
    counterparty,
    setCounterparty,
    setCounterpartyTouched,
    note,
    setNote,
    salesChannelId,
    setSalesChannelId,
    startDate,
    endDate,
    setPolicyClientId,
    expandedPaymentIndex,
    setExpandedPaymentIndex,
    clientQuery,
    setClientQuery,
    showClientSuggestions,
    setShowClientSuggestions,
    filteredClients,
    handleClientSelect,
    companies,
    types,
    shouldShowCascoFields,
    vehicleBrands,
    vehicleModels,
    loadingOptions,
    optionsError,
    error,
    isSubmitting,
    submitLabel,
    steps,
    currentStep,
    setCurrentStep,
    totalSteps,
    orderedPaymentEntries,
    paymentIssuesByIndex,
    paymentErrorsCount,
    paymentWarningsCount,
    policyDurationWarning,
    firstPaymentDateWarning,
    handleStartDateChange,
    handleEndDateChange,
    handleAddCounterpartyExpenses,
    handleAddExecutorExpenses,
    handleAddPayment,
    handleRemovePayment,
    togglePaymentDetails,
    handleNextStep,
    handlePreviousStep,
    handleFormKeyDown,
    markFinalSubmitIntent,
    updatePaymentField,
    addRecord,
    updateRecordField,
    removeRecord,
    handleSubmit,
    onCancel,
    onRequestAddClient,
    salesChannels,
    isDirty,
    executorName,
  } = useAddPolicyFormController(props);

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5" data-testid="policy-form-body">
        <div className="space-y-6">
          {(error || optionsError) && (
            <p className="app-alert app-alert-danger">{error || optionsError}</p>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {steps.map((step, stepIndex) => (
                <Button
                  key={step.title}
                  onClick={() => setCurrentStep(stepIndex + 1)}
                  variant={currentStep === stepIndex + 1 ? 'primary' : 'secondary'}
                  size="sm"
                >
                  {step.title}
                </Button>
              ))}
            </div>
            <p className="text-sm text-slate-600">{steps[currentStep - 1].description}</p>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <PolicyBasicsStep
                number={number}
                onNumberChange={setNumber}
                insuranceCompanyId={insuranceCompanyId}
                onInsuranceCompanyChange={setInsuranceCompanyId}
                loadingOptions={loadingOptions}
                companies={companies}
                insuranceTypeId={insuranceTypeId}
                onInsuranceTypeChange={setInsuranceTypeId}
                types={types}
                salesChannelId={salesChannelId}
                onSalesChannelChange={setSalesChannelId}
                salesChannels={salesChannels}
                clientQuery={clientQuery}
                onClientQueryChange={(value) => {
                  setClientQuery(value);
                  setShowClientSuggestions(true);
                  setPolicyClientId('');
                }}
                onClientQueryFocus={() => setShowClientSuggestions(true)}
                onClientQueryBlur={() => {
                  setTimeout(() => setShowClientSuggestions(false), 120);
                }}
                showClientSuggestions={showClientSuggestions}
                filteredClients={filteredClients}
                onClientSelect={handleClientSelect}
                onRequestAddClient={onRequestAddClient}
                isVehicle={isVehicle}
                onIsVehicleChange={(checked) => {
                  if (!checked) {
                    setBrand('');
                    setModel('');
                    setVin('');
                  }
                  setIsVehicle(checked);
                }}
                brand={brand}
                onBrandChange={(value) => {
                  setBrand(value);
                  setModel('');
                }}
                model={model}
                onModelChange={setModel}
                vin={vin}
                onVinChange={setVin}
                vehicleBrands={vehicleBrands}
                vehicleModels={vehicleModels}
                showCascoFields={shouldShowCascoFields}
                deductible={deductible}
                onDeductibleChange={setDeductible}
                officialDealer={officialDealer}
                onOfficialDealerChange={setOfficialDealer}
                gap={gap}
                onGapChange={setGap}
              />
              <div className="space-y-2">
                <label className="app-label" htmlFor="policy-note-input">
                  Примечание к полису
                </label>
                <textarea
                  id="policy-note-input"
                  rows={4}
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Комментарий, особенности, важные договоренности..."
                  className="field field-textarea min-h-28"
                />
                <p className="text-xs text-slate-500">{note.length}/2000</p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <PolicyPaymentsStep
              startDate={startDate}
              onStartDateChange={handleStartDateChange}
              endDate={endDate}
              onEndDateChange={handleEndDateChange}
              policyDurationWarning={policyDurationWarning}
              paymentEntries={orderedPaymentEntries}
              paymentIssuesByIndex={paymentIssuesByIndex}
              expandedPaymentIndex={expandedPaymentIndex}
              onTogglePaymentDetails={togglePaymentDetails}
              onExpandPaymentDetails={setExpandedPaymentIndex}
              onAddPayment={handleAddPayment}
              firstPaymentDateWarning={firstPaymentDateWarning}
              onPaymentFieldChange={updatePaymentField}
              onRemovePayment={handleRemovePayment}
              onAddRecord={addRecord}
              onUpdateRecord={updateRecordField}
              onRemoveRecord={removeRecord}
            />
          )}

          {currentStep === 3 && (
            <PolicyFinanceStep
              counterparty={counterparty}
              onCounterpartyChange={setCounterparty}
              onCounterpartyTouched={() => setCounterpartyTouched(true)}
              onAddCounterpartyExpenses={handleAddCounterpartyExpenses}
              executorName={executorName}
              onAddExecutorExpenses={handleAddExecutorExpenses}
              paymentEntries={orderedPaymentEntries}
              paymentIssuesByIndex={paymentIssuesByIndex}
              expandedPaymentIndex={expandedPaymentIndex}
              onTogglePaymentDetails={togglePaymentDetails}
              onExpandPaymentDetails={setExpandedPaymentIndex}
              onAddRecord={addRecord}
              onUpdateRecord={updateRecordField}
              onRemoveRecord={removeRecord}
            />
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4"
        data-testid="policy-form-footer"
      >
        <Button type="button" onClick={onCancel} variant="secondary" disabled={isSubmitting}>
          Отмена
        </Button>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
              data-testid="policy-form-dirty-badge"
            >
              Есть несохранённые изменения
            </span>
          )}
          {paymentErrorsCount > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
              Ошибок: {paymentErrorsCount}
            </span>
          )}
          {paymentWarningsCount > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Предупреждений: {paymentWarningsCount}
            </span>
          )}
          {currentStep > 1 && (
            <Button
              type="button"
              onClick={handlePreviousStep}
              variant="secondary"
              disabled={isSubmitting}
            >
              Назад
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={handleNextStep}
              variant="primary"
              disabled={isSubmitting}
            >
              Далее
            </Button>
          ) : (
            <Button
              type="submit"
              onMouseDown={markFinalSubmitIntent}
              onClick={markFinalSubmitIntent}
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Сохраняем...' : submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};
