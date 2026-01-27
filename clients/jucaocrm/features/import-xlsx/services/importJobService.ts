/**
 * Import Job Service - JucãoCRM
 *
 * Serviço para gerenciar jobs de importação na tabela import_jobs.
 * Isolado na feature import-xlsx do cliente JucãoCRM.
 */

import { supabase } from '@/lib/supabase/client';
import { sanitizeUUID } from '@/lib/supabase/utils';
import type {
  ImportJob,
  ImportJobRow,
  ImportJobStatus,
  ImportProgress,
  CreateImportJobInput,
  toImportJob,
} from '../types';

/**
 * Converte uma row do banco (snake_case) para o tipo ImportJob (camelCase)
 */
function transformJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    status: row.status,
    fileName: row.file_name,
    fileUrl: row.file_url,
    totalRows: row.total_rows,
    processedRows: row.processed_rows,
    createdCount: row.created_count,
    updatedCount: row.updated_count,
    errorCount: row.error_count,
    lastError: row.last_error,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

export const importJobService = {
  /**
   * Cria um novo job de importação
   */
  async create(
    input: CreateImportJobInput
  ): Promise<{ data: ImportJob | null; error: Error | null }> {
    try {
      if (!supabase) {
        return { data: null, error: new Error('Supabase não configurado') };
      }

      const { data, error } = await supabase
        .from('import_jobs')
        .insert({
          organization_id: sanitizeUUID(input.organizationId),
          user_id: sanitizeUUID(input.userId),
          status: 'queued' as ImportJobStatus,
          file_name: input.fileName,
          file_url: input.fileUrl || null,
          total_rows: input.totalRows,
          processed_rows: 0,
          created_count: 0,
          updated_count: 0,
          error_count: 0,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: transformJob(data as ImportJobRow), error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  },

  /**
   * Busca um job por ID
   */
  async getById(id: string): Promise<{ data: ImportJob | null; error: Error | null }> {
    try {
      if (!supabase) {
        return { data: null, error: new Error('Supabase não configurado') };
      }

      const { data, error } = await supabase
        .from('import_jobs')
        .select()
        .eq('id', sanitizeUUID(id))
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: transformJob(data as ImportJobRow), error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  },

  /**
   * Lista jobs de uma organização
   */
  async listByOrganization(
    organizationId: string
  ): Promise<{ data: ImportJob[]; error: Error | null }> {
    try {
      if (!supabase) {
        return { data: [], error: new Error('Supabase não configurado') };
      }

      const { data, error } = await supabase
        .from('import_jobs')
        .select()
        .eq('organization_id', sanitizeUUID(organizationId))
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error };
      }

      return {
        data: (data as ImportJobRow[]).map(transformJob),
        error: null,
      };
    } catch (e) {
      return { data: [], error: e as Error };
    }
  },

  /**
   * Atualiza o status de um job
   */
  async updateStatus(
    id: string,
    status: ImportJobStatus
  ): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      const updates: Record<string, unknown> = { status };

      if (status === 'processing') {
        updates.started_at = new Date().toISOString();
      }

      if (status === 'completed' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('import_jobs')
        .update(updates)
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  /**
   * Atualiza o progresso de um job
   */
  async updateProgress(
    id: string,
    progress: ImportProgress
  ): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      const updates: Record<string, unknown> = {
        processed_rows: progress.processedRows,
        created_count: progress.createdCount,
        updated_count: progress.updatedCount,
        error_count: progress.errorCount,
      };

      if (progress.lastError) {
        updates.last_error = progress.lastError;
      }

      const { error } = await supabase
        .from('import_jobs')
        .update(updates)
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  /**
   * Marca um job como completo
   */
  async complete(
    id: string,
    progress: ImportProgress
  ): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      const { error } = await supabase
        .from('import_jobs')
        .update({
          status: 'completed' as ImportJobStatus,
          processed_rows: progress.processedRows,
          created_count: progress.createdCount,
          updated_count: progress.updatedCount,
          error_count: progress.errorCount,
          last_error: progress.lastError || null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  /**
   * Marca um job como falho
   */
  async fail(id: string, errorMessage: string): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      const { error } = await supabase
        .from('import_jobs')
        .update({
          status: 'failed' as ImportJobStatus,
          last_error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  /**
   * Deleta um job e seus dados de staging associados
   */
  async delete(id: string): Promise<{ error: Error | null }> {
    try {
      if (!supabase) {
        return { error: new Error('Supabase não configurado') };
      }

      // ON DELETE CASCADE cuida do staging automaticamente
      const { error } = await supabase
        .from('import_jobs')
        .delete()
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },
};
