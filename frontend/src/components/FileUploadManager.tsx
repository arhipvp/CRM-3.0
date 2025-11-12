import React, { useState } from 'react';
import { Document } from '../types';

interface FileUploadManagerProps {
  dealId: string;
  documents: Document[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
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

export const FileUploadManager: React.FC<FileUploadManagerProps> = ({
  documents,
  onUpload,
  onDelete,
}) => {
  const [isUploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Ограничение размера: 100 МБ
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 100 МБ');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      // Имитация прогресса загрузки
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 90));
      }, 200);

      await onUpload(file);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      // Очистить input
      event.target.value = '';
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот файл?')) return;
    try {
      await onDelete(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить файл');
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 hover:bg-slate-100 transition">
        <label className="block cursor-pointer">
          <input
            type="file"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
          <div className="text-center">
            <p className="text-3xl mb-2">📁</p>
            <p className="text-sm font-medium text-slate-700">
              {isUploading ? 'Загружаем файл...' : 'Нажмите или перетащите файл сюда'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Максимум 100 МБ</p>
          </div>
        </label>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4">
            <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sky-500 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">{Math.round(uploadProgress)}%</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}

      {documents.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">
            Загруженные файлы ({documents.length})
          </p>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">{getFileIcon(doc.mime_type)}</span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={doc.file || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-sky-600 hover:text-sky-800 break-all"
                    >
                      {doc.title}
                    </a>
                    <div className="text-xs text-slate-500 flex gap-2 mt-1">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-xs text-slate-400 hover:text-red-500 flex-shrink-0 ml-2"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && !error && (
        <p className="text-sm text-slate-500 text-center py-4">Файлы пока не загружены</p>
      )}
    </div>
  );
};
