/**
 * Import Callback API - JucãoCRM
 *
 * POST /api/clients/jucaocrm/import/callback
 * - Endpoint chamado pelo N8N para atualizar progresso
 * - Protegido por secret compartilhado
 */

import { NextResponse } from 'next/server';
import { importJobService } from '@/clients/jucaocrm/features/import-xlsx';

/**
 * Payload esperado do N8N
 */
interface CallbackPayload {
  jobId: string;
  action: 'progress' | 'complete' | 'error';
  progress?: {
    processedRows: number;
    createdCount: number;
    updatedCount: number;
    errorCount: number;
    lastError?: string;
  };
  error?: string;
}

/**
 * POST - Callback do N8N
 */
export async function POST(req: Request) {
  try {
    // Verificar CLIENT_ID
    const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
    if (clientId !== 'jucaocrm') {
      return NextResponse.json(
        { error: 'Esta funcionalidade está disponível apenas para JucãoCRM' },
        { status: 403 }
      );
    }

    // Verificar secret (se configurado)
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = req.headers.get('X-Webhook-Secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json(
          { error: 'Secret inválido' },
          { status: 401 }
        );
      }
    }

    const body = await req.json() as CallbackPayload;

    if (!body.jobId) {
      return NextResponse.json(
        { error: 'jobId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se job existe
    const { data: job, error: jobError } = await importJobService.getById(body.jobId);

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job não encontrado' },
        { status: 404 }
      );
    }

    switch (body.action) {
      case 'progress': {
        if (!body.progress) {
          return NextResponse.json(
            { error: 'progress é obrigatório para action=progress' },
            { status: 400 }
          );
        }

        const { error: updateError } = await importJobService.updateProgress(
          body.jobId,
          body.progress
        );

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'progress',
          jobId: body.jobId,
        });
      }

      case 'complete': {
        const progress = body.progress || {
          processedRows: job.totalRows,
          createdCount: job.createdCount,
          updatedCount: job.updatedCount,
          errorCount: job.errorCount,
        };

        const { error: completeError } = await importJobService.complete(
          body.jobId,
          progress
        );

        if (completeError) {
          return NextResponse.json(
            { error: completeError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'complete',
          jobId: body.jobId,
        });
      }

      case 'error': {
        const errorMessage = body.error || 'Erro desconhecido no N8N';

        const { error: failError } = await importJobService.fail(
          body.jobId,
          errorMessage
        );

        if (failError) {
          return NextResponse.json(
            { error: failError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'error',
          jobId: body.jobId,
        });
      }

      default:
        return NextResponse.json(
          { error: `Action inválida: ${body.action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    console.error('[import/callback] Erro:', e);
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
