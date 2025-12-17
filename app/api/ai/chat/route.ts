// Route Handler for AI Chat - /api/ai/chat
// Full integration with AI SDK v6 ToolLoopAgent + createAgentUIStreamResponse

import { createAgentUIStreamResponse, UIMessage } from 'ai';
import { createCRMAgent } from '@/lib/ai/crmAgent';
import { createClient } from '@/lib/supabase/server';
import { CRMCallOptionsSchema, type CRMCallOptions } from '@/types/ai';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export const maxDuration = 60;

export async function POST(req: Request) {
    // Mitigação CSRF: endpoint autenticado por cookies.
    if (!isAllowedOrigin(req)) {
        return new Response('Forbidden', { status: 403 });
    }

    const supabase = await createClient();

    // 0. Parse request body early (we may need boardId to recover a missing profile.organization_id)
    const body = await req.json().catch(() => null);
    const messages: UIMessage[] = (body?.messages ?? []) as UIMessage[];
    const rawContext = (body?.context ?? {}) as Record<string, unknown>;

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    // 2. Get profile with organization + role (RBAC)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id, first_name, nickname, role')
        .eq('id', user.id)
        .single();

    // Se não existir profile, o usuário está autenticado mas o trigger handle_new_user falhou
    // (ou o seed está inconsistente). Retornamos um erro claro para facilitar o setup.
    if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[AI Chat] Failed to load profile:', { message: profileError.message });
    }

    // Alguns usuários legados podem existir sem organization_id no profile (ex.: signup sem raw_user_meta_data).
    // Se veio boardId no contexto e o board é visível para o usuário autenticado (RLS), inferimos a org com segurança.
    let organizationId = profile?.organization_id ?? null;
    if (!organizationId) {
        const boardId = typeof rawContext?.boardId === 'string' ? rawContext.boardId : null;
        if (boardId) {
            const { data: board, error: boardError } = await supabase
                .from('boards')
                .select('organization_id')
                .eq('id', boardId)
                .maybeSingle();

            if (boardError) {
                console.warn('[AI Chat] Failed to infer organization from board:', { boardId, message: boardError.message });
            }

            if (board?.organization_id) {
                organizationId = board.organization_id;

                // Best-effort: persistir no profile para corrigir de vez.
                const { error: updateProfileError } = await supabase
                    .from('profiles')
                    .update({ organization_id: organizationId, updated_at: new Date().toISOString() })
                    .eq('id', user.id);

                if (updateProfileError) {
                    console.warn('[AI Chat] Failed to backfill profile.organization_id:', { message: updateProfileError.message });
                }
            }
        }
    }

    if (!organizationId) {
        return new Response(
            'Profile sem organização. Finalize o setup (ou re-login) para vincular seu usuário a uma organização antes de usar a IA.',
            { status: 409 }
        );
    }

    // 3. Get API key (org-wide: organization_settings é a fonte de verdade)
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
        .eq('organization_id', organizationId)
        .maybeSingle();

    const provider = (orgSettings?.ai_provider ?? 'google') as 'google' | 'openai' | 'anthropic';
    const modelId: string | null = orgSettings?.ai_model ?? null;

    const apiKey: string | null =
        provider === 'google'
            ? (orgSettings?.ai_google_key ?? null)
            : provider === 'openai'
                ? (orgSettings?.ai_openai_key ?? null)
                : (orgSettings?.ai_anthropic_key ?? null);

    if (!apiKey) {
        const providerLabel = provider === 'google' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'Anthropic';
        return new Response(
            `API key not configured for ${providerLabel}. Configure em Configurações → Inteligência Artificial.`,
            { status: 400 }
        );
    }

    const resolvedModelId =
        modelId || (provider === 'google' ? 'gemini-2.5-flash' : provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5');

    // 5. Build type-safe context for agent
    // Nunca confiamos no `organizationId` vindo do client.
    const ClientContextSchema = CRMCallOptionsSchema.omit({ organizationId: true }).partial();
    const parsedClientContext = ClientContextSchema.safeParse(rawContext);
    const clientContext = parsedClientContext.success ? parsedClientContext.data : {};

    const userRole = profile?.role === 'admin' || profile?.role === 'vendedor' ? profile.role : undefined;
    const userName = profile?.nickname || profile?.first_name || user.email || undefined;

    const context: CRMCallOptions = {
        organizationId,
        ...clientContext,
        userId: user.id,
        userName,
        userRole,
    };

    console.log('[AI Chat] 📨 Request received:', {
        messagesCount: messages?.length,
        rawContext,
        context: {
            organizationId: context.organizationId,
            boardId: context.boardId,
            dealId: context.dealId,
            boardName: context.boardName,
            stagesCount: context.stages?.length,
            userName: context.userName,
        },
    });

    // 6. Create agent with API key and context
    const agent = await createCRMAgent(context, user.id, apiKey, resolvedModelId, provider);

    // 7. Return streaming response using AI SDK v6 createAgentUIStreamResponse
    return createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
        options: context,
    });
}
