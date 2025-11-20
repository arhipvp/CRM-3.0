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
            setError(
                err instanceof Error ? err.message : 'Не удалось загрузить файлы'
            );
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
        try {
            const uploader =
                entityType === 'client' ? uploadClientDriveFile : uploadPolicyDriveFile;
            await uploader(entityId, file);
            await loadFiles();
        } catch (err) {
            throw err;
        }
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
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-8 text-slate-500">Загрузка...</div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Имя</th>
                                    <th className="px-4 py-3">Размер</th>
                                    <th className="px-4 py-3">Изменен</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedFiles.map((file) => (
                                    <tr key={file.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">
                                                    {getDriveItemIcon(file.isFolder)}
                                                </span>
                                                {file.webViewLink ? (
                                                    <a
                                                        href={file.webViewLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-medium text-slate-900 hover:text-sky-600 hover:underline truncate max-w-[200px] sm:max-w-xs block"
                                                        title={file.name}
                                                    >
                                                        {file.name}
                                                    </a>
                                                ) : (
                                                    <span className="font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs block" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {formatDriveFileSize(file.size)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {formatDriveDate(file.modifiedAt || file.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                                {!files.length && (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="px-4 py-8 text-center text-slate-500"
                                        >
                                            Папка пуста
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Modal>
    );
};
