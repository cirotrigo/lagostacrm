'use client';

/**
 * Import Products Button Component
 *
 * Botão e modal para importação de produtos via XLSX.
 * Componente isolado do cliente JucãoCRM.
 *
 * TODO: Finalizar implementação após extrair código do repositório origem
 */

import React, { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { parseXlsx, isValidXlsxFile } from '../parser/parseXlsx';
import { importProductsFromXlsx } from '../services/importProductsFromXlsx';
import type { ImportState, ParseXlsxResult, ImportResult } from '../types';

interface ImportProductsButtonProps {
  /**
   * Callback chamado após importação bem-sucedida
   */
  onImportComplete?: (result: ImportResult) => void;

  /**
   * Texto do botão
   * @default "Importar XLSX"
   */
  label?: string;

  /**
   * Variante visual do botão
   * @default "secondary"
   */
  variant?: 'primary' | 'secondary' | 'ghost';

  /**
   * Desabilitar o botão
   */
  disabled?: boolean;
}

/**
 * Botão para importar produtos de arquivo XLSX
 *
 * @example
 * ```tsx
 * <ImportProductsButton
 *   onImportComplete={(result) => {
 *     toast.success(`${result.imported} produtos importados!`);
 *   }}
 * />
 * ```
 */
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
    parseResult: null,
    importResult: null,
    error: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      file: null,
      parseResult: null,
      importResult: null,
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
      const result = await parseXlsx(file);

      if (!result.success || result.validRows === 0) {
        setState((prev) => ({
          ...prev,
          step: 'error',
          parseResult: result,
          error: result.errors[0]?.message || 'Nenhum produto válido encontrado no arquivo',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        step: 'preview',
        parseResult: result,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Erro ao processar arquivo',
      }));
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!state.parseResult?.data.length) return;

    setState((prev) => ({ ...prev, step: 'importing' }));

    try {
      const result = await importProductsFromXlsx(state.parseResult.data, {
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
  }, [state.parseResult, onImportComplete]);

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-500',
    secondary: 'border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200',
    ghost: 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300',
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      >
        <FileSpreadsheet className="h-4 w-4" />
        {label}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
            {/* Header */}
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

            {/* Body */}
            <div className="px-6 py-5">
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

              {state.step === 'parsing' && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Processando arquivo...
                  </p>
                </div>
              )}

              {state.step === 'preview' && state.parseResult && (
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-xl px-4 py-3 mb-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">
                        {state.parseResult.validRows} produto(s) encontrado(s)
                      </span>
                    </div>
                    {state.parseResult.errors.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {state.parseResult.errors.length} linha(s) com erro serão ignoradas
                      </p>
                    )}
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    <p className="font-medium mb-2">Preview dos primeiros itens:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {state.parseResult.data.slice(0, 5).map((row, i) => (
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
                      {state.parseResult.data.length > 5 && (
                        <p className="text-xs text-slate-400 px-3">
                          + {state.parseResult.data.length - 5} mais...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {state.step === 'importing' && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 text-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Importando produtos...
                  </p>
                </div>
              )}

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

            {/* Footer */}
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
                    Importar {state.parseResult?.validRows} produto(s)
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
