import type { DriveFile } from '../../../../types';

export function splitFileName(name: string): { baseName: string; extension: string } {
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === name.length - 1)
    return { baseName: name, extension: '' };
  return { baseName: name.slice(0, lastDotIndex), extension: name.slice(lastDotIndex) };
}

export function getFilePreviewKind(file: DriveFile): 'image' | 'pdf' | 'drive' | null {
  if (file.isFolder) return null;
  const mimeType = file.mimeType?.toLowerCase();
  const name = file.name.toLowerCase();
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  )
    return 'drive';
  return null;
}

export const isImageFile = (file: DriveFile) => getFilePreviewKind(file) === 'image';
