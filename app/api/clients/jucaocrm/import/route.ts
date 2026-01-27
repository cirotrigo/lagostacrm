/**
 * Import Products API - JucãoCRM
 *
 * POST /api/clients/jucaocrm/import
 * - Upload de arquivo XLSX
 * - Parse no servidor
 * - Criação de job e staging
 * - Retorna jobId para acompanhamento
 *
 * GET /api/clients/jucaocrm/import
 * - Lista jobs de importação da organização
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  parseXlsxToProducts,
  isValidXlsxFile,
  importJobService,
  stagingService,
} from '@/clients/jucaocrm/features/import-xlsx';

/**
 * POST - Inicia uma nova importação
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

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Obter organização do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 400 }
      );
    }

    const organizationId = profile.organization_id;

    // Processar form data
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo não enviado (field "file")' },
        { status: 400 }
      );
    }

    // Validar extensão
    if (!isValidXlsxFile(file)) {
      return NextResponse.json(
        { error: 'Arquivo inválido. Envie um arquivo .xlsx ou .xls' },
        { status: 400 }
      );
    }

    // Parse do arquivo
    const parseResult = await parseXlsxToProducts(file);

    if (parseResult.products.length === 0) {
      return NextResponse.json(
        {
          error: parseResult.errors[0]?.message || 'Nenhum produto válido encontrado',
          parseErrors: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // Criar job de importação
    const { data: job, error: jobError } = await importJobService.create({
      organizationId,
      userId: user.id,
      fileName: file.name,
      totalRows: parseResult.products.length,
    });

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || 'Falha ao criar job de importação' },
        { status: 500 }
      );
    }

    // Inserir dados no staging
    const { inserted, error: stagingError } = await stagingService.insertBatch(
      job.id,
      parseResult.products
    );

    if (stagingError) {
      // Limpar job criado em caso de erro
      await importJobService.fail(job.id, stagingError.message);
      return NextResponse.json(
        { error: `Falha ao inserir dados no staging: ${stagingError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      fileName: file.name,
      totalRows: parseResult.products.length,
      stagedRows: inserted,
      parseErrors: parseResult.errors,
      message: 'Arquivo processado. Chame /start para iniciar o processamento.',
    });
  } catch (e) {
    console.error('[import/route] Erro:', e);
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}

/**
 * GET - Lista jobs de importação
 */
export async function GET() {
  try {
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

    // Obter organização do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 400 }
      );
    }

    const { data: jobs, error: jobsError } = await importJobService.listByOrganization(
      profile.organization_id
    );

    if (jobsError) {
      return NextResponse.json(
        { error: jobsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ jobs });
  } catch (e) {
    console.error('[import/route] Erro:', e);
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
