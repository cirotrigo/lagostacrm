'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { useUploadPdfDocument } from '../hooks';
import { useToast } from '@/context/ToastContext';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface DocumentUploadProps {
    disabled?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ disabled }) => {
    const { showToast } = useToast();
    const uploadMutation = useUploadPdfDocument();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const validateFile = (file: File): boolean => {
        if (file.type !== 'application/pdf') {
            showToast('Apenas arquivos PDF sao aceitos', 'error');
            return false;
        }

        if (file.size > MAX_FILE_SIZE) {
            showToast('Arquivo muito grande. Maximo: 20MB', 'error');
            return false;
        }

        return true;
    };

    const handleFile = useCallback(async (file: File) => {
        if (!validateFile(file)) return;

        setSelectedFile(file);

        try {
            await uploadMutation.mutateAsync(file);
            showToast('PDF processado com sucesso', 'success');
            setSelectedFile(null);
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Erro ao processar PDF',
                'error'
            );
            setSelectedFile(null);
        }
    }, [uploadMutation, showToast]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setIsDragging(true);
        }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, [disabled, handleFile]);

    const handleClick = () => {
        if (!disabled && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const isUploading = uploadMutation.isPending;

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            className={`
                relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                ${isDragging
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-slate-200 dark:border-white/10 hover:border-primary-400 hover:bg-slate-50/50 dark:hover:bg-white/3'
                }
                ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileInput}
                className="hidden"
                disabled={disabled || isUploading}
            />

            {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        Processando {selectedFile?.name}...
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Isso pode levar alguns segundos
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-white/10">
                        <Upload className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-medium text-primary-600 dark:text-primary-400">
                            Clique para selecionar
                        </span>
                        {' '}ou arraste um PDF
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Maximo 20MB
                    </div>
                </div>
            )}
        </div>
    );
};
