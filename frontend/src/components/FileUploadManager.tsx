import React, { useEffect, useState } from 'react';

interface FileUploadManagerProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🔊';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('presentation')) return '📑';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
};

export const FileUploadManager: React.FC<FileUploadManagerProps> = ({ onUpload, disabled }) => {
  const [isUploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setDragActive] = useState(false);

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

  const uploadFile = async (file: File, resetInput?: () => void) => {
    if (isUploading || disabled) return;

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 100 МБ');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 90));
      }, 200);

      await onUpload(file);

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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setUploading(false);
      resetInput?.();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await uploadFile(file, () => {
      event.target.value = '';
    });
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

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;

    await uploadFile(droppedFile);
  };

  const dropAreaClasses = [
    'border-2 border-dashed rounded-2xl p-6 transition-colors duration-200',
    isDragActive ? 'border-sky-500 bg-slate-50' : 'border-slate-300 bg-slate-50',
    isUploading ? 'opacity-80' : 'hover:border-slate-400 hover:bg-slate-100',
  ].join(' ');

  return (
    <div className="space-y-3">
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
            onChange={handleFileSelect}
            disabled={isUploading || disabled}
            className="hidden"
          />
          <div className="text-center">
            <p className="text-3xl mb-2">📁</p>
            <p className="text-sm font-medium text-slate-700">
              {isUploading ? 'Загружаем файл...' : 'Нажмите или перетащите файл сюда'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Максимум 100 МБ</p>
          </div>
        </div>
      </label>

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

      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
    </div>
  );
};
