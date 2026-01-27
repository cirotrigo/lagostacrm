/**
 * Staging Service - JucãoCRM
 *
 * Serviço para gerenciar dados de staging na tabela import_staging.
 * Isolado na feature import-xlsx do cliente JucãoCRM.
 */

import { supabase } from '@/lib/supabase/client';
import { sanitizeUUID } from '@/lib/supabase/utils';
import type {
  ImportStagingRow,
  ImportStagingDbRow,
  XlsxProductRow,
} from '../types';

/**
 * Converte uma row do banco (snake_case) para o tipo ImportStagingRow (camelCase)
 */
function transformStaging(row: ImportStagingDbRow): ImportStagingRow {
  return {
    id: row.id,
    jobId: row.job_id,
    rowIndex: row.row_index,
    sku: row.sku,
    name: row.name,
    price: row.price,
    description: row.description,
    processed: row.processed,
    error: row.error,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Tamanho padrão de batch para operações em lote
 */
const DEFAULT_BATCH_SIZE = 1000;

export const stagingService = {
  /**
   * Insere um batch de linhas parseadas do XLSX no staging
   *
   * @param jobId - ID do job de importação
   * @param rows - Linhas parseadas do XLSX
   * @returns Resultado da operação
   */
  async insertBatch(
    jobId: string,
    rows: XlsxProductRow[]
  ): Promise<{ inserted: number; error: Error | null }> {
    try {
      if (!supabase) {
        return { inserted: 0, error: new Error('Supabase não configurado') };
      }

      if (!rows.length) {
        return { inserted: 0, error: null };
      }

      const sanitizedJobId = sanitizeUUID(jobId);
      if (!sanitizedJobId) {
        return { inserted: 0, error: new Error('Job ID inválido') };
      }

      // Preparar dados para inserção
      const stagingRows = rows.map((row, index) => ({
        job_id: sanitizedJobId,
        row_index: index + 1,
        sku: row.sku?.toString().trim() || null,
        name: row.name.trim(),
        price: Number(row.price) || 0,
        description: row.description?.toString().trim() || null,
        processed: false,
        error: null,
      }));

      // Inserir em batches para evitar timeout
      let totalInserted = 0;
      for (let i = 0; i < stagingRows.length; i += DEFAULT_BATCH_SIZE) {
        const batch = stagingRows.slice(i, i + DEFAULT_BATCH_SIZE);
        const { error } = await supabase.from('import_staging').insert(batch);

        if (error) {
          return { inserted: totalInserted, error };
        }

        totalInserted += batch.length;
      }

      return { inserted: totalInserted, error: null };
    } catch (e) {
      return { inserted: 0, error: e as Error };
    }
  },

  /**
   * Busca linhas não processadas de um job
   *
   * @param jobId - ID do job
   * @param limit - Número máximo de linhas a retornar
   * @returns Linhas não processadas
   */
  async getUnprocessed(
    jobId: string,
    limit = 100
  ): Promise<{ data: ImportStagingRow[]; error: Error | null }> {
    try {
      if (!supabase) {
        return { data: [], error: new Error('Supabase não configurado') };
      }

      const { data, error } = await supabase
        .from('import_staging')
        .select()
        .eq('job_id', sanitizeUUID(jobId))
        .eq('processed', false)
        .order('row_index', { ascending: true })
        .limit(limit);

      if (error) {
        return { data: [], error };
      }

      return {
        data: (data as ImportStagingDbRow[]).map(transformStaging),
        error: null,
      };
    } catch (e) {
      return { data: [], error: e as Error };
    }
  },

  /**
   * Marca linhas como processadas
   *
   * @param ids - IDs das linhas a marcar
   * @returns Resultado da operação
   */
  async markProcessed(ids: string[]): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      if (!ids.length) {
        return { error: null };
      }

      const sanitizedIds = ids.map(sanitizeUUID).filter(Boolean) as string[];
      if (!sanitizedIds.length) {
        return { error: null };
      }

      const { error } = await supabase
        .from('import_staging')
        .update({ processed: true })
        .in('id', sanitizedIds);

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  /**
   * Marca uma linha com erro
   *
   * @param id - ID da linha
   * @param errorMessage - Mensagem de erro
   * @returns Resultado da operação
   */
  async markError(
    id: string,
    errorMessage: string
  ): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      const { error } = await supabase
        .from('import_staging')
        .update({ processed: true, error: errorMessage })
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  /**
   * Conta linhas processadas e não processadas de um job
   *
   * @param jobId - ID do job
   * @returns Contagem de linhas
   */
  async getCounts(
    jobId: string
  ): Promise<{
    data: { total: number; processed: number; pending: number; errors: number };
    error: Error | null;
  }> {
    try {
      if (!supabase) {
        return {
          data: { total: 0, processed: 0, pending: 0, errors: 0 },
          error: new Error('Supabase não configurado'),
        };
      }

      const sanitizedJobId = sanitizeUUID(jobId);

      // Total
      const { count: total, error: totalError } = await supabase
        .from('import_staging')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', sanitizedJobId);

      if (totalError) {
        return {
          data: { total: 0, processed: 0, pending: 0, errors: 0 },
          error: totalError,
        };
      }

      // Processados
      const { count: processed, error: processedError } = await supabase
        .from('import_staging')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', sanitizedJobId)
        .eq('processed', true);

      if (processedError) {
        return {
          data: { total: total || 0, processed: 0, pending: 0, errors: 0 },
          error: processedError,
        };
      }

      // Erros
      const { count: errors, error: errorsError } = await supabase
        .from('import_staging')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', sanitizedJobId)
        .not('error', 'is', null);

      if (errorsError) {
        return {
          data: {
            total: total || 0,
            processed: processed || 0,
            pending: (total || 0) - (processed || 0),
            errors: 0,
          },
          error: errorsError,
        };
      }

      return {
        data: {
          total: total || 0,
          processed: processed || 0,
          pending: (total || 0) - (processed || 0),
          errors: errors || 0,
        },
        error: null,
      };
    } catch (e) {
      return {
        data: { total: 0, processed: 0, pending: 0, errors: 0 },
        error: e as Error,
      };
    }
  },

  /**
   * Remove todos os dados de staging de um job
   * (Normalmente não é necessário devido ao ON DELETE CASCADE)
   *
   * @param jobId - ID do job
   * @returns Resultado da operação
   */
  async cleanup(jobId: string): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      const { error } = await supabase
        .from('import_staging')
        .delete()
        .eq('job_id', sanitizeUUID(jobId));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },
};
