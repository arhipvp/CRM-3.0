import type { DriveFile } from '../../../../types';
import { ActionLink, Button } from '../../../common/Button';
import { InlineAlert } from '../../../common/InlineAlert';
import { Modal } from '../../../Modal';
import { PREVIEW_RENAME_INPUT_CLASS, RENAME_INPUT_CLASS } from './FilesTabParts';

export interface FilePreviewState {
  file: DriveFile;
  kind: 'image' | 'pdf' | 'drive';
  src: string;
}

interface FilePreviewDialogsProps {
  filePreview: FilePreviewState | null;
  closeFilePreview: () => void;
  previewRenameDraft: string;
  setPreviewRenameDraft: (value: string) => void;
  previewRenameExtension: string;
  previewRenameError: string | null;
  isPreviewRenameDisabled: boolean;
  handlePreviewRenameSubmit: (draft: string) => Promise<void>;
  handleDownloadDriveFiles: (fileIds?: string[]) => Promise<void>;
  handlePreviewDelete: () => Promise<void>;
  isDownloading: boolean;
  isTrashing: boolean;
  isDriveLoading: boolean;
  driveError: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  isPreviewLoading: boolean;
  goToPrevFile: () => void;
  goToNextFile: () => void;
  currentPreviewIndex: number;
  previewableFilesCount: number;
  renamingFile: DriveFile | null;
  closeRenameModal: () => void;
  renameError: string | null;
  renameDraft: string;
  setRenameDraft: (value: string) => void;
  renameExtension: string;
  handleRenameSubmit: () => Promise<void>;
  isRenaming: boolean;
}

export function FilePreviewDialogs(props: FilePreviewDialogsProps) {
  const {
    filePreview,
    closeFilePreview,
    previewRenameDraft,
    setPreviewRenameDraft,
    previewRenameExtension,
    previewRenameError,
    isPreviewRenameDisabled,
    handlePreviewRenameSubmit,
    handleDownloadDriveFiles,
    handlePreviewDelete,
    isDownloading,
    isTrashing,
    isDriveLoading,
    driveError,
    canGoPrev,
    canGoNext,
    isPreviewLoading,
    goToPrevFile,
    goToNextFile,
    currentPreviewIndex,
    previewableFilesCount,
    renamingFile,
    closeRenameModal,
    renameError,
    renameDraft,
    setRenameDraft,
    renameExtension,
    handleRenameSubmit,
    isRenaming,
  } = props;
  return (
    <>
      {filePreview && (
        <Modal
          title="Просмотр файла"
          onClose={closeFilePreview}
          size="xl"
          panelClassName="max-h-[92vh] overflow-hidden"
          bodyClassName="max-h-[calc(92vh-72px)] overflow-y-auto"
        >
          <div className="space-y-3">
            <form
              className="space-y-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (isPreviewRenameDisabled) return;
                const formData = new FormData(event.currentTarget);
                void handlePreviewRenameSubmit(String(formData.get('previewRenameDraft') ?? ''));
              }}
            >
              <label
                htmlFor="deal-file-preview-rename"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Имя файла
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className="ui-modal-input-shell">
                  <input
                    id="deal-file-preview-rename"
                    name="previewRenameDraft"
                    type="text"
                    value={previewRenameDraft}
                    onChange={(event) => setPreviewRenameDraft(event.target.value)}
                    disabled={isPreviewRenameDisabled}
                    className={PREVIEW_RENAME_INPUT_CLASS}
                  />
                  {previewRenameExtension && (
                    <span className="shrink-0 text-sm font-medium text-slate-500">
                      {previewRenameExtension}
                    </span>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isPreviewRenameDisabled}
                  variant="primary"
                  size="sm"
                  icon="edit"
                >
                  Переименовать
                </Button>
                <Button
                  type="button"
                  onClick={() => handleDownloadDriveFiles([filePreview.file.id])}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                  variant="secondary"
                  size="sm"
                  icon="download"
                >
                  {isDownloading ? 'Скачиваю...' : 'Скачать'}
                </Button>
                {filePreview.file.webViewLink && (
                  <ActionLink
                    href={filePreview.file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="sm"
                  >
                    Открыть в Google Drive
                  </ActionLink>
                )}
                <Button
                  type="button"
                  onClick={() => void handlePreviewDelete()}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                  variant="danger"
                  size="sm"
                  icon="delete"
                >
                  {isTrashing ? 'Удаляю...' : 'Удалить'}
                </Button>
              </div>
              {previewRenameError && <InlineAlert as="p">{previewRenameError}</InlineAlert>}
            </form>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                onClick={goToPrevFile}
                disabled={!canGoPrev || isPreviewLoading}
                variant="secondary"
                size="sm"
                icon="chevronLeft"
              >
                Назад
              </Button>
              <p className="text-xs font-semibold text-slate-500">
                {currentPreviewIndex >= 0
                  ? `${currentPreviewIndex + 1} / ${previewableFilesCount}`
                  : '—'}
              </p>
              <Button
                type="button"
                onClick={goToNextFile}
                disabled={!canGoNext || isPreviewLoading}
                variant="secondary"
                size="sm"
                icon="chevronRight"
                iconPosition="end"
              >
                Вперёд
              </Button>
            </div>
            <div className="min-h-[60vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {filePreview.kind === 'image' && (
                <div className="flex min-h-[60vh] items-center justify-center p-3">
                  <img
                    src={filePreview.src}
                    alt={filePreview.file.name}
                    className="max-h-[70vh] max-w-full h-auto w-auto"
                  />
                </div>
              )}
              {filePreview.kind === 'pdf' && (
                <iframe
                  src={filePreview.src}
                  title={`Просмотр файла ${filePreview.file.name}`}
                  className="h-[70vh] w-full bg-white"
                />
              )}
              {filePreview.kind === 'drive' && (
                <div className="space-y-2">
                  <iframe
                    src={filePreview.src}
                    title={`Просмотр файла ${filePreview.file.name}`}
                    className="h-[70vh] w-full bg-white"
                    allow="autoplay"
                  />
                  <p className="px-3 pb-3 text-xs text-slate-500">
                    Если документ не открылся во встроенном просмотре, откройте его в Google Drive
                    или скачайте файл.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {renamingFile && (
        <Modal
          title="Переименовать файл"
          onClose={closeRenameModal}
          size="sm"
          zIndex={50}
          closeOnOverlayClick={false}
        >
          <div className="space-y-4">
            {renameError && <InlineAlert as="p">{renameError}</InlineAlert>}
            <div>
              <label className="block text-sm font-semibold text-slate-700">Новое имя</label>
              <div className="ui-modal-input-shell">
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  className={RENAME_INPUT_CLASS}
                />
                {renameExtension && (
                  <span className="shrink-0 text-sm font-medium text-slate-500">
                    {renameExtension}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                onClick={() => void handleRenameSubmit()}
                disabled={isRenaming}
                variant="primary"
                size="block"
                icon="check"
              >
                {isRenaming ? 'Сохраняем...' : 'Сохранить'}
              </Button>
              <Button type="button" onClick={closeRenameModal} variant="secondary" size="block">
                Отмена
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
