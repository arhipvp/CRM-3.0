import React, { useCallback, useEffect, useState } from 'react';
import { DriveFile } from '../types';
import {
    fetchClientDriveFiles,
    fetchPolicyDriveFiles,
    uploadClientDriveFile,
    uploadPolicyDriveFile,
} from '../api';
import { FileUploadManager } from './FileUploadManager';
import { Modal } from './Modal';
import { formatErrorMessage } from '../utils/formatErrorMessage';

interface DriveFilesModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityId: string;
    entityType: 'client' | 'policy';
    title: string;
}

const formatDriveFileSize = (bytes?: number | null) => {
    if (bytes === undefined || bytes === null) {
        return '—';
    }
    if (bytes === 0) {
        return '0 Б';
    }
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${(bytes / Math.pow(k, i)).toFixed(1).replace(/\.0$/, '')} ${sizes[i]}`;
};

const formatDriveDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString('ru-RU') : '—';

const getDriveItemIcon = (isFolder: boolean) => (isFolder ? '📁' : '📄');

export const DriveFilesModal: React.FC<DriveFilesModalProps> = ({
    isOpen,
    onClose,
    entityId,
    entityType,
    title,
}) => {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = useCallback(async () => {
        if (!entityId) return;

        setIsLoading(true);
        setError(null);
        try {
            const fetcher =
                entityType === 'client' ? fetchClientDriveFiles : fetchPolicyDriveFiles;
            const { files: fetchedFiles } = await fetcher(entityId);
            setFiles(fetchedFiles);
        } catch (err) {
            console.error('Ошибка загрузки файлов:', err);
            setError(formatErrorMessage(err, 'Не удалось загрузить файлы'));
        } finally {
            setIsLoading(false);
        }
    }, [entityId, entityType]);

    useEffect(() => {
        if (isOpen) {
            void loadFiles();
        }
    }, [isOpen, loadFiles]);

    const handleUpload = async (file: File) => {
        const uploader =
            entityType === 'client' ? uploadClientDriveFile : uploadPolicyDriveFile;
        await uploader(entityId, file);
        await loadFiles();
    };

    const sortedFiles = [...files].sort((a, b) => {
        if (a.isFolder !== b.isFolder) {
            return a.isFolder ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });
    });

    return (
        <Modal onClose={onClose} title={title} size="lg">
            <div className="space-y-6">
                <FileUploadManager onUpload={handleUpload} />

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-8 text-slate-500">Загрузка...</div>
                ) : (
                    <div className="app-panel shadow-none overflow-hidden">
                        <div className="overflow-x-auto bg-white">
                        <table className="deals-table min-w-full border-collapse text-left text-sm">
                            <thead className="bg-white/90 backdrop-blur border-b border-slate-200">
                                <tr>
                                    <th className="border border-slate-200 px-4 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900">Имя</th>
                                    <th className="border border-slate-200 px-4 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[140px]">Размер</th>
                                    <th className="border border-slate-200 px-4 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[180px]">Изменён</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {sortedFiles.map((file) => (
                                    <tr key={file.id} className="transition-colors even:bg-slate-50/40 border-l-4 border-transparent hover:bg-slate-50/80 hover:border-sky-500">
                                        <td className="border border-slate-200 px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">
                                                    {getDriveItemIcon(file.isFolder)}
                                                </span>
                                                {file.webViewLink ? (
                                                    <a
                                                        href={file.webViewLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="link-action truncate max-w-[220px] sm:max-w-md block"
                                                        title={file.name}
                                                    >
                                                        {file.name}
                                                    </a>
                                                ) : (
                                                    <span className="font-semibold text-slate-900 truncate max-w-[220px] sm:max-w-md block" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="border border-slate-200 px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {formatDriveFileSize(file.size)}
                                        </td>
                                        <td className="border border-slate-200 px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {formatDriveDate(file.modifiedAt || file.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                                {!files.length && (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="border border-slate-200 px-4 py-8 text-center text-slate-600"
                                        >
                                            Папка пуста
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
