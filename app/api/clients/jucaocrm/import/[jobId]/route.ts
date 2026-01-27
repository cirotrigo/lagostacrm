/**
 * Import Job Status API - JucãoCRM
 *
 * GET /api/clients/jucaocrm/import/[jobId]
 * - Retorna status e progresso de um job de importação
 *
 * DELETE /api/clients/jucaocrm/import/[jobId]
 * - Cancela/deleta um job de importação
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importJobService, stagingService } from '@/clients/jucaocrm/features/import-xlsx';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET - Retorna status de um job
 */
export async function GET(req: Request, { params }: RouteParams) {
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

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar job
    const { data: job, error: jobError } = await importJobService.getById(jobId);

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se usuário tem acesso (mesma organização)
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

    // Buscar contagem de staging (progresso detalhado)
    const { data: counts } = await stagingService.getCounts(jobId);

    return NextResponse.json({
      job,
      staging: counts,
      progress: {
        percentage: job.totalRows > 0
          ? Math.round((job.processedRows / job.totalRows) * 100)
          : 0,
        remaining: job.totalRows - job.processedRows,
      },
    });
  } catch (e) {
    console.error('[import/[jobId]/route] Erro:', e);
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancela/deleta um job
 */
export async function DELETE(req: Request, { params }: RouteParams) {
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

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar job para verificar permissão
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

    // Não permitir deletar jobs em processamento
    if (job.status === 'processing') {
      return NextResponse.json(
        { error: 'Não é possível deletar um job em processamento' },
        { status: 400 }
      );
    }

    // Deletar (CASCADE remove staging automaticamente)
    const { error: deleteError } = await importJobService.delete(jobId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Job deletado' });
  } catch (e) {
    console.error('[import/[jobId]/route] Erro:', e);
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
