import type { DriveFile } from '../../../types';
import { Modal } from '../../Modal';
import { Button } from '../Button';

interface DriveMoveDestinationDialogProps {
  rootFolderId: string;
  folders: DriveFile[];
  selectedFiles: DriveFile[];
  isMoving: boolean;
  onClose: () => void;
  onMove: (targetFolderId: string) => Promise<void>;
  getFolderDepth?: (folderId: string) => number;
}

export function DriveMoveDestinationDialog({
  rootFolderId,
  folders,
  selectedFiles,
  isMoving,
  onClose,
  onMove,
  getFolderDepth,
}: DriveMoveDestinationDialogProps) {
  const isUnavailable = (folderId: string) =>
    selectedFiles.some((file) => (file.parentId ?? rootFolderId) === folderId);
  const destinationButtons = [
    { id: rootFolderId, name: 'Корень сделки', depth: 0 },
    ...folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      depth: getFolderDepth?.(folder.id) ?? 0,
    })),
  ];

  return (
    <Modal title="Переместить файлы" onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Выберите папку назначения для файлов ({selectedFiles.length}).
        </p>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {destinationButtons.map((destination) => {
            const disabled = isMoving || isUnavailable(destination.id);
            return (
              <Button
                key={destination.id}
                type="button"
                variant="secondary"
                className="w-full justify-start text-left"
                style={{ paddingLeft: `${16 + destination.depth * 20}px` }}
                disabled={disabled}
                onClick={() => void onMove(destination.id)}
              >
                📁 {destination.name}
                {isUnavailable(destination.id) ? ' (текущая папка)' : ''}
              </Button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isMoving}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
}
