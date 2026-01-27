'use client';

/**
 * Import Progress Card Component - JucãoCRM
 *
 * Exibe o progresso de uma importação em andamento.
 */

import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Package, FileCheck } from 'lucide-react';
import type { ImportJob } from '../types';

interface ImportProgressCardProps {
  job: ImportJob;
  onClose?: () => void;
}

/**
 * Card que mostra progresso de importação
 */
export const ImportProgressCard: React.FC<ImportProgressCardProps> = ({ job, onClose }) => {
  const progress = job.totalRows > 0
    ? Math.round((job.processedRows / job.totalRows) * 100)
    : 0;

  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {isProcessing && (
          <div className="p-2 rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
          </div>
        )}
        {isCompleted && (
          <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
        )}
        {isFailed && (
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
        )}
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {isProcessing && 'Processando importação...'}
            {isCompleted && 'Importação concluída!'}
            {isFailed && 'Importação falhou'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {job.fileName}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span>{job.processedRows} de {job.totalRows} processados</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-primary-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
          <p className="text-lg font-bold text-green-600">{job.createdCount}</p>
          <p className="text-[10px] text-green-600 uppercase">Criados</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <p className="text-lg font-bold text-blue-600">{job.updatedCount}</p>
          <p className="text-[10px] text-blue-600 uppercase">Atualizados</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <p className="text-lg font-bold text-red-600">{job.errorCount}</p>
          <p className="text-[10px] text-red-600 uppercase">Erros</p>
        </div>
      </div>

      {/* Error message */}
      {isFailed && job.lastError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {job.lastError}
        </div>
      )}

      {/* Summary for completed */}
      {isCompleted && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <FileCheck className="h-4 w-4" />
          <span>
            {job.createdCount + job.updatedCount} produto(s) importado(s) com sucesso
          </span>
        </div>
      )}

      {/* Close button for completed/failed */}
      {(isCompleted || isFailed) && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-xl transition-colors"
        >
          Fechar
        </button>
      )}
    </div>
  );
};

export default ImportProgressCard;
