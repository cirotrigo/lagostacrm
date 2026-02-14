/**
 * GET /api/ai-training/stats
 * Retorna estatísticas de treinamento da organização
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrainingStats } from '@/lib/ai-training/processor';

export async function GET() {
    try {
        const supabase = await createClient();

        // Autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            );
        }

        // Busca perfil
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Perfil não encontrado' },
                { status: 404 }
            );
        }

        // Busca estatísticas
        const stats = await getTrainingStats(profile.organization_id);

        return NextResponse.json(stats);

    } catch (error) {
        console.error('Error in GET /api/ai-training/stats:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}
