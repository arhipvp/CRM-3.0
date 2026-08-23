import { useMemo, useState } from 'react';

import type { DriveFile } from '../../../../types';

interface UseDriveMoveInteractionParams {
  rootFolderId?: string | null;
  files: DriveFile[];
  selectedFileIds: string[];
  expandedFolderIds: Set<string>;
  isDisabled: boolean;
  onMove: (fileIds: string[], targetFolderId: string) => Promise<void>;
}

export function useDriveMoveInteraction({
  rootFolderId,
  files,
  selectedFileIds,
  expandedFolderIds,
  isDisabled,
  onMove,
}: UseDriveMoveInteractionParams) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedFileIds, setDraggedFileIds] = useState<string[]>([]);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const selectedFiles = useMemo(
    () =>
      selectedFileIds
        .map((fileId) => files.find((file) => file.id === fileId))
        .filter((file): file is DriveFile => Boolean(file && !file.isFolder)),
    [files, selectedFileIds],
  );
  const destinationFolders = useMemo(
    () => files.filter((file) => file.isFolder && expandedFolderIds.has(file.id)),
    [expandedFolderIds, files],
  );
  const completeMove = async (fileIds: string[], targetFolderId: string) => {
    await onMove(fileIds, targetFolderId);
    setDraggedFileIds([]);
    setDropTargetFolderId(null);
    setIsDialogOpen(false);
  };
  const onDragStart = (file: DriveFile) => {
    if (isDisabled || file.isFolder) return;
    setDraggedFileIds(
      selectedFileIds.includes(file.id) ? selectedFiles.map((item) => item.id) : [file.id],
    );
  };
  const onFolderDragOver = (event: React.DragEvent<HTMLTableRowElement>, folder: DriveFile) => {
    if (
      isDisabled ||
      !folder.isFolder ||
      !expandedFolderIds.has(folder.id) ||
      !draggedFileIds.length
    )
      return;
    event.preventDefault();
    setDropTargetFolderId(folder.id);
  };
  const onFolderDrop = (event: React.DragEvent<HTMLTableRowElement>, folder: DriveFile) => {
    event.preventDefault();
    if (
      !isDisabled &&
      folder.isFolder &&
      expandedFolderIds.has(folder.id) &&
      draggedFileIds.length
    ) {
      void completeMove(draggedFileIds, folder.id);
    }
  };
  const onDragOverRoot = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDisabled && rootFolderId && draggedFileIds.length) {
      event.preventDefault();
      setDropTargetFolderId(rootFolderId);
    }
  };
  const onDropRoot = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDisabled && rootFolderId && draggedFileIds.length) {
      void completeMove(draggedFileIds, rootFolderId);
    }
  };

  return {
    rootFolderId,
    isDialogOpen,
    setIsDialogOpen,
    draggedFileIds,
    dropTargetFolderId,
    setDropTargetFolderId,
    selectedFiles,
    destinationFolders,
    completeMove,
    onDragStart,
    onFolderDragOver,
    onFolderDrop,
    onDragOverRoot,
    onDropRoot,
  };
}
