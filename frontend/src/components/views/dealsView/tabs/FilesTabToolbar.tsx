import type { Deal, PolicyRecognitionResult } from '../../../../types';
import { useNotification } from '../../../../contexts/NotificationContext';
import { copyToClipboard } from '../../../../utils/clipboard';
import { FileUploadManager } from '../../../FileUploadManager';
import { Button } from '../../../common/Button';
import { InlineAlert } from '../../../common/InlineAlert';
import { HeaderActionButton, RecognitionResults } from './FilesTabParts';

interface FilesTabToolbarProps {
  selectedDeal: Deal;
  driveFolderLink: string | null;
  mailboxEmail: string;
  isDriveLoading: boolean;
  loadDriveFiles: () => Promise<void>;
  onUploadDriveFile: (file: File) => Promise<void>;
  isSelectedDealDeleted: boolean;
  selectedDriveFileIds: string[];
  handleRecognizePolicies: () => Promise<void>;
  isRecognizing: boolean;
  canRecognizeSelectedFiles: boolean;
  handleTrashSelectedFiles: () => Promise<void>;
  isTrashing: boolean;
  handleDownloadDriveFiles: (fileIds?: string[]) => Promise<void>;
  isDownloading: boolean;
  driveError: string | null;
  recognitionMessage: string | null;
  trashMessage: string | null;
  downloadMessage: string | null;
  renameMessage: string | null;
  recognitionResults: PolicyRecognitionResult[];
  isCreatingMailbox: boolean;
  isCheckingMailbox: boolean;
  mailboxActionError: string | null;
  mailboxActionSuccess: string | null;
  onCreateMailbox: () => Promise<void>;
  onCheckMailbox: () => Promise<void>;
}

export function FilesTabToolbar(props: FilesTabToolbarProps) {
  const { addNotification } = useNotification();
  const disabled =
    props.isRecognizing ||
    props.isTrashing ||
    props.isDownloading ||
    !props.selectedDeal.driveFolderId ||
    props.selectedDriveFileIds.length === 0 ||
    !!props.driveError;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-label">Файлы</p>
            {props.isDriveLoading && (
              <span className="ui-loading-spinner-sm" aria-label="Идет загрузка файлов" />
            )}
            {props.driveFolderLink && (
              <a
                href={props.driveFolderLink}
                target="_blank"
                rel="noreferrer"
                className="link-action text-xs"
              >
                Открыть папку в Google Drive
              </a>
            )}
          </div>
          <p className="ui-section-meta">
            Файлы загружаются прямо из папки, привязанной к этой сделке.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!props.selectedDeal.mailboxEmail && (
            <HeaderActionButton
              onClick={props.onCreateMailbox}
              disabled={props.isCreatingMailbox || props.isCheckingMailbox}
              variant="primary"
              size="sm"
            >
              {props.isCreatingMailbox ? 'Создаю ящик...' : 'Создать почту сделки'}
            </HeaderActionButton>
          )}
          <HeaderActionButton
            onClick={props.onCheckMailbox}
            disabled={
              !props.selectedDeal.mailboxEmail || props.isCheckingMailbox || props.isCreatingMailbox
            }
            variant="secondary"
            size="sm"
          >
            {props.isCheckingMailbox ? 'Проверяем почту...' : 'Проверить почту'}
          </HeaderActionButton>
          <HeaderActionButton
            onClick={props.loadDriveFiles}
            disabled={!props.selectedDeal.driveFolderId || props.isDriveLoading}
            variant="secondary"
            size="sm"
            icon="refresh"
          >
            {props.isDriveLoading ? 'Обновляю...' : 'Обновить'}
          </HeaderActionButton>
        </div>
      </div>
      {props.mailboxEmail && (
        <p className="ui-section-meta">
          Почта сделки:{' '}
          <Button
            type="button"
            className="link-action text-xs"
            onClick={async (event) => {
              event.stopPropagation();
              if (await copyToClipboard(props.mailboxEmail))
                addNotification('Почта скопирована', 'success', 1600);
            }}
            aria-label="Скопировать почту сделки"
            title="Скопировать почту сделки"
          >
            {props.mailboxEmail}
          </Button>
        </p>
      )}
      {props.mailboxActionError && <InlineAlert>{props.mailboxActionError}</InlineAlert>}
      {props.mailboxActionSuccess && (
        <InlineAlert tone="success">{props.mailboxActionSuccess}</InlineAlert>
      )}
      <FileUploadManager
        onUpload={async (file) => {
          await props.onUploadDriveFile(file);
          await props.loadDriveFiles();
        }}
        disabled={!props.selectedDeal.driveFolderId || props.isSelectedDealDeleted}
      />
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button
          type="button"
          onClick={props.handleRecognizePolicies}
          disabled={disabled || !props.canRecognizeSelectedFiles}
          variant="primary"
          size="sm"
        >
          {props.isRecognizing
            ? 'Распознаём...'
            : 'Распознать полис (PDF, DOC, DOCX, JPG/JPEG, PNG)'}
        </Button>
        <Button
          type="button"
          onClick={() => props.handleDownloadDriveFiles()}
          disabled={disabled}
          variant="secondary"
          size="sm"
          icon="download"
        >
          {props.isDownloading ? 'Скачиваю...' : 'Скачать'}
        </Button>
        <Button
          type="button"
          onClick={props.handleTrashSelectedFiles}
          disabled={disabled}
          variant="danger"
          size="sm"
          icon="delete"
        >
          {props.isTrashing ? 'Удаляю...' : 'Удалить'}
        </Button>
        <p className="ui-section-meta">
          {props.selectedDriveFileIds.length
            ? `${props.selectedDriveFileIds.length} элемент${props.selectedDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            : 'Выберите файлы для распознавания.'}
        </p>
      </div>
      {props.recognitionMessage && (
        <p className="ui-status-danger-badge-xs">{props.recognitionMessage}</p>
      )}
      {props.trashMessage && <p className="ui-status-danger-badge-xs">{props.trashMessage}</p>}
      {props.downloadMessage && (
        <p className="ui-status-danger-badge-xs">{props.downloadMessage}</p>
      )}
      {props.renameMessage && <p className="ui-status-danger-badge-xs">{props.renameMessage}</p>}
      <RecognitionResults results={props.recognitionResults} />
      {props.driveError && (
        <div className="ui-panel-muted-text ui-status-danger-text">{props.driveError}</div>
      )}
      {!props.driveError && !props.selectedDeal.driveFolderId && (
        <div className="ui-panel-muted-text">
          Папка Google Drive ещё не создана. Сначала сохраните сделку, чтобы получить папку.
        </div>
      )}
    </>
  );
}
