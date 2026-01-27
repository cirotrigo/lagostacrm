'use client';

/**
 * Import Products Button Component - JucãoCRM
 *
 * Botão e modal para importação de produtos via XLSX.
 * Suporta dois modos:
 * - Direto: para arquivos pequenos (< 500 produtos)
 * - Assíncrono: para arquivos grandes, via API + N8N
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X, AlertCircle, CheckCircle, Loader2, Zap, Clock } from 'lucide-react';
import { parseXlsxToProducts, isValidXlsxFile, type ParsedProducts } from '../parser/parseXlsx';
import { importProductsFromXlsx } from '../services/importProductsFromXlsx';
import { ImportProgressCard } from './ImportProgressCard';
import type { ImportResult, ImportJob } from '../types';

/**
 * Threshold para usar importação assíncrona
 */
const ASYNC_THRESHOLD = 500;

/**
 * Intervalo de polling em ms
 */
const POLL_INTERVAL = 2000;

type ImportStep =
  | 'idle'
  | 'parsing'
  | 'preview'
  | 'uploading'
  | 'starting'
  | 'processing'
  | 'importing-direct'
  | 'done'
  | 'error';

interface ImportState {
  step: ImportStep;
  file: File | null;
  parsedProducts: ParsedProducts | null;
  importResult: ImportResult | null;
  job: ImportJob | null;
  error: string | null;
}

interface ImportProductsButtonProps {
  onImportComplete?: (result: ImportResult) => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export const ImportProductsButton: React.FC<ImportProductsButtonProps> = ({
  onImportComplete,
  label = 'Importar XLSX',
  variant = 'secondary',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ImportState>({
    step: 'idle',
    file: null,
    parsedProducts: null,
    importResult: null,
    job: null,
    error: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setState({
      step: 'idle',
      file: null,
      parsedProducts: null,
      importResult: null,
      job: null,
      error: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidXlsxFile(file)) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: 'Arquivo inválido. Selecione um arquivo .xlsx ou .xls',
      }));
      return;
    }

    setState((prev) => ({ ...prev, step: 'parsing', file, error: null }));

    try {
      const result = await parseXlsxToProducts(file);

      if (result.products.length === 0) {
        setState((prev) => ({
          ...prev,
          step: 'error',
          parsedProducts: result,
          error: result.errors[0]?.message || 'Nenhum produto válido encontrado no arquivo',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        step: 'preview',
        parsedProducts: result,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Erro ao processar arquivo',
      }));
    }
  }, []);

  /**
   * Polls the job status until complete or failed
   */
  const startPolling = useCallback((jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/clients/jucaocrm/import/${jobId}`);
        if (!res.ok) {
          throw new Error('Falha ao buscar status');
        }

        const data = await res.json();
        const job = data.job as ImportJob;

        setState((prev) => ({ ...prev, job }));

        if (job.status === 'completed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          const result: ImportResult = {
            success: true,
            imported: job.createdCount + job.updatedCount,
            skipped: 0,
            errors: [],
            jobId: job.id,
          };

          setState((prev) => ({
            ...prev,
            step: 'done',
            importResult: result,
          }));

          // Dispatch event to refresh products list
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('crm:products-updated'));
          }

          onImportComplete?.(result);
        } else if (job.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setState((prev) => ({
            ...prev,
            step: 'error',
            error: job.lastError || 'Falha no processamento',
          }));
        }
      } catch (error) {
        console.error('[ImportProductsButton] Poll error:', error);
      }
    };

    // Initial poll
    poll();

    // Start interval
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
  }, [onImportComplete]);

  /**
   * Async import via API
   */
  const handleAsyncImport = useCallback(async () => {
    if (!state.file) return;

    setState((prev) => ({ ...prev, step: 'uploading' }));

    try {
      // 1. Upload file and create job
      const formData = new FormData();
      formData.append('file', state.file);

      const uploadRes = await fetch('/api/clients/jucaocrm/import', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Falha no upload');
      }

      const uploadData = await uploadRes.json();
      const jobId = uploadData.jobId as string;

      setState((prev) => ({ ...prev, step: 'starting' }));

      // 2. Start processing via N8N
      const startRes = await fetch(`/api/clients/jucaocrm/import/${jobId}/start`, {
        method: 'POST',
      });

      if (!startRes.ok) {
        const errorData = await startRes.json();
        // If webhook not configured, show specific error
        if (startRes.status === 503) {
          throw new Error('N8N não configurado. Entre em contato com o suporte.');
        }
        throw new Error(errorData.error || 'Falha ao iniciar processamento');
      }

      setState((prev) => ({ ...prev, step: 'processing' }));

      // 3. Start polling for progress
      startPolling(jobId);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Erro durante importação',
      }));
    }
  }, [state.file, startPolling]);

  /**
   * Direct import (synchronous, for small files)
   */
  const handleDirectImport = useCallback(async () => {
    if (!state.parsedProducts?.products.length) return;

    setState((prev) => ({ ...prev, step: 'importing-direct' }));

    try {
      const result = await importProductsFromXlsx(state.parsedProducts.products, {
        onComplete: (res) => {
          setState((prev) => ({
            ...prev,
            step: 'done',
            importResult: res,
          }));
          onImportComplete?.(res);
        },
      });

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          step: 'error',
          importResult: result,
          error: result.errors[0]?.message || 'Falha ao importar produtos',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Erro durante importação',
      }));
    }
  }, [state.parsedProducts, onImportComplete]);

  const handleImport = useCallback(() => {
    const productCount = state.parsedProducts?.products.length ?? 0;

    // Use async import for large files
    if (productCount >= ASYNC_THRESHOLD) {
      handleAsyncImport();
    } else {
      handleDirectImport();
    }
  }, [state.parsedProducts, handleAsyncImport, handleDirectImport]);

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-500',
    secondary: 'border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200',
    ghost: 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300',
  };

  const validCount = state.parsedProducts?.products.length ?? 0;
  const errorCount = state.parsedProducts?.errors.length ?? 0;
  const isLargeFile = validCount >= ASYNC_THRESHOLD;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      >
        <FileSpreadsheet className="h-4 w-4" />
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importar Produtos
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {/* Idle - File selection */}
              {state.step === 'idle' && (
                <div className="text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="xlsx-file-input"
                  />
                  <label
                    htmlFor="xlsx-file-input"
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
                  >
                    <Upload className="h-10 w-10 text-slate-400 mb-3" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Clique para selecionar arquivo
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      .xlsx ou .xls
                    </span>
                  </label>
                </div>
              )}

              {/* Parsing */}
              {state.step === 'parsing' && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Processando arquivo...
                  </p>
                </div>
              )}

              {/* Preview */}
              {state.step === 'preview' && state.parsedProducts && (
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-xl px-4 py-3 mb-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">
                        {validCount} produto(s) encontrado(s)
                      </span>
                    </div>
                    {errorCount > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {errorCount} linha(s) com erro serão ignoradas
                      </p>
                    )}
                  </div>

                  {/* Import mode indicator */}
                  {isLargeFile ? (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">
                        Arquivo grande: importação será processada em segundo plano
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <span className="text-xs text-purple-700 dark:text-purple-300">
                        Importação direta (mais rápido para arquivos pequenos)
                      </span>
                    </div>
                  )}

                  <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    <p className="font-medium mb-2">Preview dos primeiros itens:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {state.parsedProducts.products.slice(0, 5).map((row, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-lg text-xs"
                        >
                          <span className="font-medium">{row.name}</span>
                          {row.price !== undefined && (
                            <span className="ml-2 text-slate-500">
                              R$ {typeof row.price === 'number' ? row.price.toFixed(2) : row.price}
                            </span>
                          )}
                        </div>
                      ))}
                      {state.parsedProducts.products.length > 5 && (
                        <p className="text-xs text-slate-400 px-3">
                          + {state.parsedProducts.products.length - 5} mais...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Uploading */}
              {state.step === 'uploading' && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Enviando arquivo...
                  </p>
                </div>
              )}

              {/* Starting N8N */}
              {state.step === 'starting' && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Iniciando processamento...
                  </p>
                </div>
              )}

              {/* Processing (async with job) */}
              {state.step === 'processing' && state.job && (
                <ImportProgressCard job={state.job} />
              )}

              {/* Processing (async without job yet - initial state) */}
              {state.step === 'processing' && !state.job && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Aguardando resposta do servidor...
                  </p>
                </div>
              )}

              {/* Direct importing */}
              {state.step === 'importing-direct' && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Importando produtos...
                  </p>
                </div>
              )}

              {/* Done */}
              {state.step === 'done' && state.importResult && (
                <div className="text-center py-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    Importação concluída!
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {state.importResult.imported} produto(s) importado(s)
                    {state.importResult.skipped > 0 && (
                      <span className="text-slate-400">
                        {' '}• {state.importResult.skipped} ignorado(s)
                      </span>
                    )}
                  </p>
                  {state.importResult.errors.length > 0 && (
                    <p className="text-xs text-red-500 mt-2">
                      {state.importResult.errors.length} erro(s) durante importação
                    </p>
                  )}
                </div>
              )}

              {/* Done with job */}
              {state.step === 'done' && state.job && !state.importResult && (
                <ImportProgressCard job={state.job} onClose={handleClose} />
              )}

              {/* Error */}
              {state.step === 'error' && (
                <div className="text-center py-4">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    Erro
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {state.error}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10">
              {state.step === 'preview' && (
                <>
                  <button
                    type="button"
                    onClick={reset}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-xl"
                  >
                    Importar {validCount} produto(s)
                  </button>
                </>
              )}

              {(state.step === 'done' || state.step === 'error') && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-xl"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportProductsButton;
