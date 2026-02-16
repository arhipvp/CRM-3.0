import { useCallback, useEffect, useState } from 'react';

import { exportStatementXlsx } from '../../../../api';
import { confirmTexts } from '../../../../constants/confirmTexts';
import type { Statement } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import type { ConfirmDialogOptions } from '../../../../constants/confirmTexts';

interface UseStatementsManagerArgs {
  selectedStatementId: string | null;
  selectedStatement?: Statement;
  onCreateStatement?: (values: {
    name: string;
    statementType: Statement['statementType'];
    counterparty?: string;
    comment?: string;
    recordIds?: string[];
  }) => Promise<Statement>;
  onUpdateStatement?: (
    statementId: string,
    values: Partial<{
      name: string;
      statementType: Statement['statementType'];
      counterparty: string;
      comment: string;
      paidAt: string | null;
      recordIds: string[];
    }>,
  ) => Promise<Statement>;
  onDeleteStatement?: (statementId: string) => Promise<void>;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  resetSelection: () => void;
  setSelectedStatementId: (statementId: string | null) => void;
  setStatementTab: (tab: 'records' | 'files') => void;
  loadStatementDriveFiles: (statementId: string) => Promise<void>;
  setStatementDriveDownloadMessage: (message: string | null) => void;
}

export const useStatementsManager = ({
  selectedStatementId,
  selectedStatement,
  onCreateStatement,
  onUpdateStatement,
  onDeleteStatement,
  confirm,
  resetSelection,
  setSelectedStatementId,
  setStatementTab,
  loadStatementDriveFiles,
  setStatementDriveDownloadMessage,
}: UseStatementsManagerArgs) => {
  const [isStatementModalOpen, setStatementModalOpen] = useState(false);
  const [isStatementCreating, setIsStatementCreating] = useState(false);
  const [editingStatement, setEditingStatement] = useState<Statement | null>(null);
  const [deletingStatement, setDeletingStatement] = useState<Statement | null>(null);
  const [editStatementForm, setEditStatementForm] = useState({
    name: '',
    statementType: 'income' as Statement['statementType'],
    counterparty: '',
    comment: '',
    paidAt: '',
  });
  const [statementForm, setStatementForm] = useState({
    name: '',
    statementType: 'income' as Statement['statementType'],
    counterparty: '',
    comment: '',
  });
  const [isStatementExporting, setIsStatementExporting] = useState(false);
  const [statementExportError, setStatementExportError] = useState<string | null>(null);

  useEffect(() => {
    setStatementExportError(null);
    setIsStatementExporting(false);
  }, [selectedStatementId]);

  const handleExportStatement = useCallback(async () => {
    if (!selectedStatement) {
      return;
    }
    setIsStatementExporting(true);
    setStatementExportError(null);
    try {
      const file = await exportStatementXlsx(selectedStatement.id);
      setStatementDriveDownloadMessage(`Файл сформирован: ${file.name}`);
      setStatementTab('files');
      await loadStatementDriveFiles(selectedStatement.id);
    } catch (error) {
      setStatementExportError(formatErrorMessage(error, 'Не удалось сформировать ведомость.'));
    } finally {
      setIsStatementExporting(false);
    }
  }, [
    loadStatementDriveFiles,
    selectedStatement,
    setStatementDriveDownloadMessage,
    setStatementTab,
  ]);

  const handleCreateStatement = useCallback(async () => {
    if (!onCreateStatement) {
      return;
    }
    if (isStatementCreating) {
      return;
    }
    if (!statementForm.name.trim()) {
      return;
    }
    setIsStatementCreating(true);
    try {
      const created = await onCreateStatement({
        name: statementForm.name.trim(),
        statementType: statementForm.statementType,
        counterparty: statementForm.counterparty.trim(),
        comment: statementForm.comment.trim(),
      });
      setStatementModalOpen(false);
      setStatementForm({
        name: '',
        statementType: statementForm.statementType,
        counterparty: '',
        comment: '',
      });
      setSelectedStatementId(created.id);
      resetSelection();
    } finally {
      setIsStatementCreating(false);
    }
  }, [
    isStatementCreating,
    onCreateStatement,
    resetSelection,
    setSelectedStatementId,
    statementForm,
  ]);

  const handleEditStatementOpen = useCallback((statement: Statement) => {
    setEditingStatement(statement);
    setEditStatementForm({
      name: statement.name ?? '',
      statementType: statement.statementType,
      counterparty: statement.counterparty ?? '',
      comment: statement.comment ?? '',
      paidAt: statement.paidAt ?? '',
    });
  }, []);

  const handleEditStatementSubmit = useCallback(async () => {
    if (!editingStatement || !onUpdateStatement) {
      return;
    }
    const existingPaidAt = editingStatement.paidAt ?? '';
    const nextPaidAt = editStatementForm.paidAt ?? '';
    const isSettingPaidAtNow = Boolean(nextPaidAt) && !existingPaidAt;
    if (isSettingPaidAtNow) {
      const confirmed = await confirm(confirmTexts.markStatementAsPaid());
      if (!confirmed) {
        return;
      }
    }
    await onUpdateStatement(editingStatement.id, {
      name: editStatementForm.name.trim(),
      statementType: editStatementForm.statementType,
      counterparty: editStatementForm.counterparty.trim(),
      comment: editStatementForm.comment.trim(),
      paidAt: editStatementForm.paidAt || null,
    });
    setEditingStatement(null);
  }, [confirm, editStatementForm, editingStatement, onUpdateStatement]);

  const handleDeleteStatementConfirm = useCallback(async () => {
    if (!deletingStatement || !onDeleteStatement) {
      return;
    }
    await onDeleteStatement(deletingStatement.id);
    setDeletingStatement(null);
  }, [deletingStatement, onDeleteStatement]);

  return {
    isStatementModalOpen,
    setStatementModalOpen,
    isStatementCreating,
    statementForm,
    setStatementForm,
    handleCreateStatement,
    editingStatement,
    setEditingStatement,
    editStatementForm,
    setEditStatementForm,
    handleEditStatementOpen,
    handleEditStatementSubmit,
    deletingStatement,
    setDeletingStatement,
    handleDeleteStatementConfirm,
    isStatementExporting,
    statementExportError,
    handleExportStatement,
  };
};
