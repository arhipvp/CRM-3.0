import React, { useEffect, useRef, useState } from 'react';
import { formatErrorMessage } from '../utils/formatErrorMessage';
import { buildFallbackKey, dedupeCollectedFiles, dedupeFiles, type CollectedFile } from '../utils/fileUpload';

interface FileUploadManagerProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

const CLIPBOARD_TEXT_TYPES = new Set(['text/plain', 'text/html', 'text/uri-list']);

const formatClipboardTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

const inferClipboardExtension = (mimeType: string | undefined) => {
  if (!mimeType) {
    return 'bin';
  }
  const normalized = mimeType.toLowerCase();
  const mapped: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
  };
  if (mapped[normalized]) {
    return mapped[normalized];
  }
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) {
    return 'bin';
  }
  const raw = normalized.slice(slashIndex + 1).split(';')[0];
  const cleaned = raw.replace(/^x-/, '').replace(/^vnd\./, '').split('+')[0];
  return cleaned || 'bin';
};

const buildClipboardFileName = (mimeType: string | undefined, index: number) => {
  const timestamp = formatClipboardTimestamp(new Date());
  const extension = inferClipboardExtension(mimeType);
  return `clipboard-${timestamp}-${index + 1}.${extension}`;
};

const pickClipboardItemType = (types: readonly string[]) =>
  types.find((type) => !CLIPBOARD_TEXT_TYPES.has(type)) ?? null;

const isFileEntry = (
  entry: FileSystemEntry | null | undefined
): entry is FileSystemFileEntry => Boolean(entry && entry.isFile);

const isDirectoryEntry = (
  entry: FileSystemEntry | null | undefined
): entry is FileSystemDirectoryEntry =>
  Boolean(entry && typeof (entry as FileSystemDirectoryEntry).createReader === 'function');

const readDirectoryEntries = (
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> =>
  new Promise((resolve) => {
    const entries: FileSystemEntry[] = [];

    const readChunk = () => {
      reader.readEntries(
        (results) => {
          if (!results.length) {
            resolve(entries);
            return;
          }
          entries.push(...results);
          readChunk();
        },
        (error) => {
          console.error('Failed to read directory entries', error);
          resolve(entries);
        }
      );
    };

    readChunk();
  });

const traverseEntry = async (entry: FileSystemEntry): Promise<CollectedFile[]> => {
  if (isFileEntry(entry)) {
    return new Promise((resolve) => {
      entry.file(
        (file) => resolve([{ file, key: entry.fullPath || buildFallbackKey(file) }]),
        (error) => {
          console.error('Failed to read file from directory entry', error);
          resolve([]);
        }
      );
    });
  }

  if (isDirectoryEntry(entry)) {
    try {
      const reader = entry.createReader();
      const entries = await readDirectoryEntries(reader);
      const nestedFiles = await Promise.all(entries.map(traverseEntry));
      return nestedFiles.flat();
    } catch (error) {
      console.error('Failed to traverse directory entry', error);
      return [];
    }
  }

  return [];
};

const collectFilesFromDataTransfer = async (
  event: React.DragEvent<HTMLLabelElement>
): Promise<File[]> => {
  const items = Array.from(event.dataTransfer?.items ?? []);
  if (!items.length) {
    return dedupeFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  const nested = await Promise.all<CollectedFile[]>(
    items.map(async (item) => {
      if (item.kind !== 'file') {
        return [];
      }
      const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.();
      if (entry) {
        return traverseEntry(entry);
      }
      const file = item.getAsFile();
      return file ? [{ file, key: buildFallbackKey(file) }] : [];
    })
  );

  const collected = nested.flat();
  if (collected.length > 0) {
    return dedupeCollectedFiles(collected);
  }

  return dedupeFiles(Array.from(event.dataTransfer?.files ?? []));
};

const collectFilesFromClipboardItems = async (
  items: ClipboardItem[]
): Promise<File[]> => {
  const files: File[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const type = pickClipboardItemType(item.types);
    if (!type) {
      continue;
    }

    try {
      const blob = await item.getType(type);
      const fileName = buildClipboardFileName(blob.type || type, index);
      files.push(new File([blob], fileName, { type: blob.type || type }));
    } catch (error) {
      console.error('Failed to read clipboard item', error);
    }
  }

  return dedupeFiles(files);
};

export const FileUploadManager: React.FC<FileUploadManagerProps> = ({ onUpload, disabled }) => {
  const [isUploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const preventDefaults = (event: DragEvent) => {
      event.preventDefault();
    };

    const options = { passive: false, capture: true };
    window.addEventListener('dragover', preventDefaults, options);
    window.addEventListener('drop', preventDefaults, options);
    document.body?.addEventListener('dragover', preventDefaults, options);
    document.body?.addEventListener('drop', preventDefaults, options);

    return () => {
      window.removeEventListener('dragover', preventDefaults, options);
      window.removeEventListener('drop', preventDefaults, options);
      document.body?.removeEventListener('dragover', preventDefaults, options);
      document.body?.removeEventListener('drop', preventDefaults, options);
    };
  }, []);

  useEffect(() => {
    const input = fileInputRef.current;
    if (input) {
      input.setAttribute('directory', '');
      input.setAttribute('webkitdirectory', '');
    }
  }, []);

  const uploadFiles = async (files: File[], resetInput?: () => void) => {
    if (isUploading || disabled || files.length === 0) return;

    const maxSize = 100 * 1024 * 1024;
    const oversizedFile = files.find((file) => file.size > maxSize);
    if (oversizedFile) {
      setError('Размер файла не должен превышать 100 МБ');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    const totalFiles = files.length;

    try {
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 90));
      }, 200);

      for (let index = 0; index < totalFiles; index += 1) {
        await onUpload(files[index]);
        setUploadProgress(Math.round(((index + 1) / totalFiles) * 100));
      }

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);
    } catch (err) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      setUploadProgress(0);
      setError(formatErrorMessage(err, 'Не удалось загрузить файл'));
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setUploading(false);
      resetInput?.();
    }
  };

  const handlePasteFiles = async (files: File[]) => {
    if (!files.length) {
      setError('В буфере нет файлов для загрузки.');
      return;
    }
    await uploadFiles(files);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    await uploadFiles(files, () => {
      event.target.value = '';
    });
  };

  const handleClipboardPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (isUploading || disabled) return;

    const items = Array.from(event.clipboardData?.items ?? []);
    const filesFromItems = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const filesFromList = Array.from(event.clipboardData?.files ?? []);
    const files = dedupeFiles([...filesFromItems, ...filesFromList]);

    if (!files.length) {
      return;
    }

    event.preventDefault();
    await handlePasteFiles(files);
  };

  const handleClipboardButtonClick = async () => {
    if (isUploading || disabled) return;
    setError(null);

    if (!navigator.clipboard?.read) {
      setError('Браузер не поддерживает чтение буфера. Используйте Ctrl+V.');
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      const files = await collectFilesFromClipboardItems(items);
      await handlePasteFiles(files);
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось прочитать буфер обмена'));
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading || disabled) return;
    setDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading || disabled) return;
    setDragActive(true);
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading || disabled) return;
    setDragActive(false);

    const droppedFiles = await collectFilesFromDataTransfer(event);
    if (!droppedFiles.length) return;

    await uploadFiles(droppedFiles);
  };

  const dropAreaClasses = [
    'border-2 border-dashed rounded-2xl p-6 transition-colors duration-200',
    isDragActive ? 'border-sky-500 bg-slate-50' : 'border-slate-300 bg-slate-50',
    isUploading ? 'opacity-80' : 'hover:border-slate-400 hover:bg-slate-100',
  ].join(' ');

  return (
    <div
      className="space-y-3"
      ref={containerRef}
      tabIndex={0}
      onPaste={handleClipboardPaste}
      onClick={() => containerRef.current?.focus()}
    >
      <label
        className="block cursor-pointer"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={dropAreaClasses}>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading || disabled}
            className="hidden"
            ref={fileInputRef}
          />
          <div className="text-center">
            <p className="text-3xl mb-2" aria-hidden="true">
              📎
            </p>
            <p className="text-sm font-medium text-slate-700">
              {isUploading ? 'Загружаем файл...' : 'Нажмите или перетащите файл сюда'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Максимум 100 МБ • Можно вставить из буфера (Ctrl+V)
            </p>
          </div>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm rounded-xl"
          onClick={handleClipboardButtonClick}
          disabled={isUploading || disabled}
        >
          Добавить из буфера
        </button>
      </div>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mt-1">
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">{Math.round(uploadProgress)}%</p>
        </div>
      )}

      {error && (
        <div className="app-alert app-alert-danger">{error}</div>
      )}
    </div>
  );
};
