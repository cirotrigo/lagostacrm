/**
 * Start Import Job API - JucãoCRM
 *
 * POST /api/clients/jucaocrm/import/[jobId]/start
 * - Dispara o webhook N8N para processar a importação
 * - Atualiza status do job para 'processing'
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  importJobService,
  webhookService,
} from '@/clients/jucaocrm/features/import-xlsx';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST - Inicia o processamento via N8N
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    // Verificar CLIENT_ID
    const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
    if (clientId !== 'jucaocrm') {
      return NextResponse.json(
        { error: 'Esta funcionalidade está disponível apenas para JucãoCRM' },
        { status: 403 }
      );
    }

    // Verificar se webhook está configurado
    if (!webhookService.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Webhook N8N não configurado. Configure N8N_WEBHOOK_IMPORT_PRODUCTS',
          hint: 'Adicione a variável de ambiente N8N_WEBHOOK_IMPORT_PRODUCTS',
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar job
    const { data: job, error: jobError } = await importJobService.getById(jobId);

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se usuário tem acesso
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profile?.organization_id !== job.organizationId) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verificar status do job
    if (job.status === 'processing') {
      return NextResponse.json(
        { error: 'Job já está em processamento' },
        { status: 400 }
      );
    }

    if (job.status === 'completed') {
      return NextResponse.json(
        { error: 'Job já foi processado' },
        { status: 400 }
      );
    }

    if (job.status === 'failed') {
      return NextResponse.json(
        {
          error: 'Job falhou anteriormente. Crie um novo job.',
          lastError: job.lastError,
        },
        { status: 400 }
      );
    }

    // Atualizar status para 'processing'
    const { error: updateError } = await importJobService.updateStatus(jobId, 'processing');

    if (updateError) {
      return NextResponse.json(
        { error: `Falha ao atualizar status: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Disparar webhook N8N
    const { data: webhookResult, error: webhookError } = await webhookService.triggerImport(
      jobId,
      job.organizationId
    );

    if (webhookError) {
      // Reverter status em caso de falha
      await importJobService.fail(jobId, webhookError.message);

      return NextResponse.json(
        {
          error: `Falha ao disparar N8N: ${webhookError.message}`,
          hint: 'Verifique se o N8N está online e o webhook está configurado',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: 'processing',
      message: 'Processamento iniciado',
      webhook: webhookResult,
    });
  } catch (e) {
    console.error('[import/[jobId]/start] Erro:', e);
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
