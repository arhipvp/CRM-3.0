import type { DriveFile } from '../../../../types';
import { DriveMoveDestinationDialog } from '../../../common/drive/DriveMoveDestinationDialog';

interface DriveMoveControlsProps {
  rootFolderId: string;
  isDisabled: boolean;
  isMoving: boolean;
  isDialogOpen: boolean;
  draggedFileIds: string[];
  dropTargetFolderId: string | null;
  selectedFiles: DriveFile[];
  destinationFolders: DriveFile[];
  onOpenDialog: () => void;
  onCloseDialog: () => void;
  onMove: (fileIds: string[], targetFolderId: string) => Promise<void>;
  onDragOverRoot: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeaveRoot: () => void;
  onDropRoot: (event: React.DragEvent<HTMLDivElement>) => void;
  getFolderDepth: (folderId: string) => number;
}

export function DriveRootDropZone({
  rootFolderId,
  isDisabled,
  draggedFileIds,
  dropTargetFolderId,
  onDragOverRoot,
  onDragLeaveRoot,
  onDropRoot,
}: Pick<
  DriveMoveControlsProps,
  | 'rootFolderId'
  | 'isDisabled'
  | 'draggedFileIds'
  | 'dropTargetFolderId'
  | 'onDragOverRoot'
  | 'onDragLeaveRoot'
  | 'onDropRoot'
>) {
  return (
    <div
      className={`mb-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition-colors ${
        dropTargetFolderId === rootFolderId
          ? 'border-sky-500 bg-sky-50 text-sky-800'
          : 'border-slate-200 text-slate-600'
      }`}
      onDragOver={onDragOverRoot}
      onDragLeave={onDragLeaveRoot}
      onDrop={onDropRoot}
      aria-disabled={isDisabled || !draggedFileIds.length}
    >
      Перетащите файлы сюда, чтобы переместить в корень сделки.
    </div>
  );
}

export function DriveMoveDialog({
  rootFolderId,
  isMoving,
  isDialogOpen,
  selectedFiles,
  destinationFolders,
  onCloseDialog,
  onMove,
  getFolderDepth,
}: Pick<
  DriveMoveControlsProps,
  | 'rootFolderId'
  | 'isMoving'
  | 'isDialogOpen'
  | 'selectedFiles'
  | 'destinationFolders'
  | 'onCloseDialog'
  | 'onMove'
  | 'getFolderDepth'
>) {
  if (!isDialogOpen) return null;
  return (
    <DriveMoveDestinationDialog
      rootFolderId={rootFolderId}
      folders={destinationFolders}
      selectedFiles={selectedFiles}
      isMoving={isMoving}
      onClose={onCloseDialog}
      onMove={(targetFolderId) =>
        onMove(
          selectedFiles.map((file) => file.id),
          targetFolderId,
        )
      }
      getFolderDepth={getFolderDepth}
    />
  );
}
