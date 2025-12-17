#!/usr/bin/env npx tsx
/**
 * 🧪 Chat “real” (AI SDK v6) simulando um vendedor
 *
 * Objetivo
 * - Rodar um roteiro de mensagens (perguntas de vendedor) e deixar o agente responder
 * - Verificar, via stream do AI SDK, quais tools foram chamadas
 * - Exercitar ações reais (mover/ganhar/perder/etc.) no Supabase, com cleanup seguro
 *
 * Requisitos
 * - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em .env/.env.local
 * - organization_settings com uma API key válida (Google/OpenAI/Anthropic)
 *
 * Uso (recomendado):
 *   RUN_REAL_AI=true npx tsx scripts/test-ai-chat-vendor.ts
 */

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createAgentUIStreamResponse, type UIMessage } from 'ai';

import { loadEnvFile, getSupabaseUrl, getServiceRoleKey, isPlaceholderApiKey } from '../test/helpers/env';
import {
	createSalesTeamFixtures,
	cleanupSalesTeamFixtures,
	type SalesTeamFixtureBundle,
} from '../test/helpers/salesTeamFixtures';
import { createCRMAgent } from '../lib/ai/crmAgent';

type Provider = 'google' | 'openai' | 'anthropic';

function toBool(v: unknown): boolean {
	return String(v || '').toLowerCase() === 'true';
}

function toUIMessage(role: 'user' | 'assistant', content: string): UIMessage {
	return {
		id: randomUUID(),
		role,
		content,
		parts: [{ type: 'text', text: content }],
	} as unknown as UIMessage;
}

async function readAIStream(res: Response): Promise<{ raw: string; textPreview: string }> {
	const reader = res.body?.getReader();
	if (!reader) return { raw: '', textPreview: '' };

	const decoder = new TextDecoder();
	let raw = '';
	let buffered = '';
	let textPreview = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = decoder.decode(value);
		raw += chunk;
		buffered += chunk;

		// Parse SSE-ish: linhas "data: {json}"
		let idx: number;
		while ((idx = buffered.indexOf('\n')) >= 0) {
			const line = buffered.slice(0, idx).trimEnd();
			buffered = buffered.slice(idx + 1);

			if (!line.startsWith('data:')) continue;
			const payload = line.slice('data:'.length).trim();
			if (!payload) continue;

			try {
				const evt = JSON.parse(payload);
				const maybeText =
					(typeof (evt as any).text === 'string' && (evt as any).text) ||
					(typeof (evt as any).delta === 'string' && (evt as any).delta) ||
					(typeof (evt as any).content === 'string' && (evt as any).content) ||
					'';

				if (maybeText) textPreview = (textPreview + maybeText).slice(-1200);
			} catch {
				// ignore
			}
		}
	}

	return {
		raw,
		textPreview: textPreview.trim() || raw.trim().slice(0, 600),
	};
}

async function resolveOrgAISettings(supabaseUrl: string, serviceRoleKey: string, organizationId: string) {
	const supabase = createClient(supabaseUrl, serviceRoleKey);

	const { data: orgSettings, error } = await supabase
		.from('organization_settings')
		.select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
		.eq('organization_id', organizationId)
		.maybeSingle();

	if (error) {
		throw new Error(`Falha ao carregar organization_settings: ${JSON.stringify(error, null, 2)}`);
	}

	const provider = (orgSettings?.ai_provider ?? 'google') as Provider;
	const modelId: string | null = orgSettings?.ai_model ?? null;

	const apiKey: string | null =
		provider === 'google'
			? (orgSettings?.ai_google_key ?? null)
			: provider === 'openai'
				? (orgSettings?.ai_openai_key ?? null)
				: (orgSettings?.ai_anthropic_key ?? null);

	if (isPlaceholderApiKey(apiKey)) {
		const providerLabel = provider === 'google' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'Anthropic';
		throw new Error(
			`API key não configurada para ${providerLabel} em organization_settings. Configure em Configurações → Inteligência Artificial.`,
		);
	}

	const resolvedModelId =
		modelId || (provider === 'google' ? 'gemini-2.5-flash' : provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5');

	return { provider, apiKey: apiKey as string, modelId: resolvedModelId };
}

async function runTurn(params: {
	userId: string;
	apiKey: string;
	modelId: string;
	provider: Provider;
	messages: UIMessage[];
	context: Record<string, unknown>;
	label: string;
	toolCallsBefore: number;
}) {
	const maxRetries = Number(process.env.AI_CHAT_RETRIES ?? '2');
	let last: { raw: string; textPreview: string; calls: string[]; retryNote?: string } | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const agent = await createCRMAgent(
			params.context as any,
			params.userId,
			params.apiKey,
			params.modelId,
			params.provider,
		);

		const res = createAgentUIStreamResponse({
			agent,
			uiMessages: params.messages,
			options: params.context as any,
		});

		const parsed = await readAIStream(res);

		const g = globalThis as any;
		const calls: string[] = Array.isArray(g.__AI_TOOL_CALLS__) ? g.__AI_TOOL_CALLS__.slice(params.toolCallsBefore) : [];

		const rawLower = parsed.raw.toLowerCase();
		const retryable =
			!res.ok ||
			rawLower.includes('server_error') ||
			rawLower.includes('temporary') ||
			rawLower.includes('timeout') ||
			rawLower.includes('econnreset') ||
			rawLower.includes('502') ||
			rawLower.includes('503') ||
			rawLower.includes('504');

		// Evita re-tentar quando já houve side effects via tools.
		if (retryable && calls.length === 0 && attempt < maxRetries) {
			const waitMs = Math.min(10_000, 750 * 2 ** attempt);
			console.warn(`\n⚠️ Provider instável (tentativa ${attempt + 1}/${maxRetries + 1}). Re-tentando em ${waitMs}ms...`);
			await new Promise((r) => setTimeout(r, waitMs));
			last = { ...parsed, calls, retryNote: 'retry' };
			continue;
		}

		console.log('\n------------------------------');
		console.log(`🧑‍💼 Vendedor: ${params.label}`);
		console.log(`🛠️ Tools chamadas: ${calls.length ? calls.join(', ') : '(nenhuma)'} `);

		if (parsed.textPreview) {
			const preview = parsed.textPreview.replace(/\s+/g, ' ').trim();
			console.log(`🤖 Resposta (preview): ${preview.slice(0, 420)}${preview.length > 420 ? '…' : ''}`);
		}

		return { ...parsed, calls, retryNote: attempt ? `retry:${attempt}` : undefined };
	}

	return last ?? { raw: '', textPreview: '', calls: [] };
}

async function main() {
	// Load env like Vitest does
	const nextRoot = process.cwd();
	const repoRoot = `${nextRoot}/..`;
	loadEnvFile(`${repoRoot}/.env`);
	loadEnvFile(`${repoRoot}/.env.local`, { override: true });
	loadEnvFile(`${nextRoot}/.env`);
	loadEnvFile(`${nextRoot}/.env.local`, { override: true });

	const runReal = toBool(process.env.RUN_REAL_AI);
	if (!runReal) {
		console.error('❌ Este script usa IA de verdade (custo/latência). Para rodar, exporte RUN_REAL_AI=true');
		process.exit(1);
	}

	const supabaseUrl = getSupabaseUrl();
	const serviceRoleKey = getServiceRoleKey();
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY (configure em .env.local).');
	}

	// Para cobrir assignDeal, tentamos usar 2 usuários na mesma org.
	// Se seu ambiente tiver poucas contas, ajuste SALES_CHAT_MIN_USERS (ex.: 1) e aceite que assignDeal não será coberto.
	const desiredMinUsers = Number(process.env.SALES_CHAT_MIN_USERS || 2);
	const wantAssignDeal = desiredMinUsers >= 2;

	const prevMinUsers = process.env.SALES_TEAM_MIN_USERS;
	const prevStrict = process.env.SALES_TEAM_STRICT;
	const prevToolDebug = process.env.AI_TOOL_CALLS_DEBUG;
	const prevApprovalBypass = process.env.AI_TOOL_APPROVAL_BYPASS;

	process.env.SALES_TEAM_MIN_USERS = String(desiredMinUsers);
	// Para scripts, é melhor falhar cedo do que rodar “meia matriz” e descobrir no final.
	process.env.SALES_TEAM_STRICT = String(process.env.SALES_TEAM_STRICT ?? 'true');
	process.env.AI_TOOL_CALLS_DEBUG = 'true';
	process.env.AI_TOOL_APPROVAL_BYPASS = 'true';

	let fx: SalesTeamFixtureBundle | null = null;
	try {
		fx = await createSalesTeamFixtures();

		if (wantAssignDeal && fx.users.length < 2) {
			throw new Error(
				`Não consegui obter 2 usuários reais na mesma organização para cobrir assignDeal. ` +
					`Obtive ${fx.users.length}. ` +
					`Se você quiser rodar mesmo assim, defina SALES_CHAT_MIN_USERS=1 (mas assignDeal ficará de fora).`,
			);
		}

		const seller = fx.users[0];
		const other = wantAssignDeal ? fx.users[1] : null;
		const board = fx.boardsByUserId[seller.userId];
		const bundle = fx.dealsByUserId[seller.userId];

		const { provider, apiKey, modelId } = await resolveOrgAISettings(supabaseUrl, serviceRoleKey, fx.organizationId);

		const context = {
			organizationId: fx.organizationId,
			boardId: board.boardId,
			boardName: `AI Tools Test Board ${seller.firstName}`,
			dealId: bundle.openDealId,
			wonStage: 'Ganho',
			lostStage: 'Perdido',
			stages: [
				{ id: board.stageIds.novo, name: 'Novo' },
				{ id: board.stageIds.proposta, name: 'Proposta' },
				{ id: board.stageIds.ganho, name: 'Ganho' },
				{ id: board.stageIds.perdido, name: 'Perdido' },
			],
			userId: seller.userId,
			userName: seller.nickname || seller.firstName,
			userRole: seller.role,
		};

		const messages: UIMessage[] = [];

		const script: Array<{ label: string; user: string }> = [
			{ label: 'Analise meu pipeline', user: 'Analise meu pipeline desse board e me diga pontos de atenção.' },
			{ label: 'Métricas do board', user: 'Quais são as métricas desse board agora?' },
			{ label: 'Buscar deals (Yahoo)', user: `Busque deals com "${fx.runId.split('_')[0]}" no título.` },
			{ label: 'Buscar contatos (email fixture)', user: `Procure contatos com o email ${bundle.contactEmail}.` },
			{ label: 'Deals por estágio', user: 'Quantos deals eu tenho no estágio Novo?' },
			{ label: 'Deals parados', user: 'Quais deals estão parados há mais de 7 dias?' },
			{ label: 'Deals atrasados', user: 'Quais deals têm atividades atrasadas?' },
			{ label: 'Detalhes do deal', user: 'Me dê os detalhes do deal atual.' },
			{ label: 'Mover para Proposta', user: 'Mova esse deal para o estágio Proposta.' },
			{ label: 'Criar deal Yahoo', user: `Crie um deal chamado Yahoo ${fx.runId} com valor 5000 e contato "Yahoo".` },
			{ label: 'Atualizar deal', user: `Atualize o título desse deal para "Yahoo - Renovação ${fx.runId}".` },
			{ label: 'Criar tarefa', user: 'Crie uma tarefa para eu ligar amanhã sobre esse deal.' },
			{ label: 'Listar atividades', user: 'Liste minhas atividades desse deal.' },
			{ label: 'Reagendar atividade', user: 'Reagende a próxima atividade pendente para depois de amanhã.' },
			{ label: 'Completar atividade', user: 'Marque essa atividade como concluída.' },
			{ label: 'Logar atividade', user: 'Registre uma ligação realizada agora para esse deal.' },
			{ label: 'Adicionar nota', user: 'Adicione uma nota nesse deal: "Cliente pediu proposta atualizada".' },
			{ label: 'Listar notas', user: 'Liste as notas desse deal.' },
			{ label: 'Criar contato', user: `Crie um contato Maria Yahoo ${fx.runId} com email maria.${fx.runId}@example.com e telefone 11999990000.` },
			{ label: 'Buscar contato Maria', user: `Procure contatos com "maria.${fx.runId}@example.com".` },
			{
				label: 'Detalhar contato',
				user: `Mostre detalhes do contato (contactId: ${bundle.contactId}).`,
			},
			{
				label: 'Atualizar contato',
				user: `Atualize as observações do contato (contactId: ${bundle.contactId}) para "Lead quente".`,
			},
			{
				label: 'Link deal -> contato',
				user: `Vincule o deal (dealId: ${bundle.openDealId}) ao contato (contactId: ${bundle.contactId}).`,
			},
			{
				label: 'Bulk move',
				user: `Mova em lote (bulk) os deals [${bundle.openDealId}, ${bundle.lostDealId}] para o estágio Proposta (stageId: ${board.stageIds.proposta}). Use moveDealsBulk.`,
			},
			{ label: 'Listar estágios', user: 'Liste os estágios desse board.' },
			{ label: 'Atualizar estágio', user: 'Atualize o label do estágio Proposta para "Proposta Enviada".' },
			{
				label: 'Reordenar estágios',
				user: `Reordene os estágios do board usando orderedStageIds exatamente nesta ordem: [${board.stageIds.novo}, ${board.stageIds.proposta}, ${board.stageIds.ganho}, ${board.stageIds.perdido}].`,
			},
			{
				label: 'Marcar como ganho',
				user: `Marque como ganho o deal (dealId: ${bundle.wonDealId}) com wonValue 2000.`,
			},
			{
				label: 'Marcar como perdido',
				user: `Marque como perdido o deal (dealId: ${bundle.lostDealId}) com reason "Preço".`,
			},
		];

		if (wantAssignDeal && other) {
			script.push({ label: 'Reatribuir deal', user: `Reatribua esse deal para outro responsável (userId: ${other.userId}).` });
		}

		const allToolsDetected = new Set<string>();

		for (const step of script) {
			messages.push(toUIMessage('user', step.user));

			const g = globalThis as any;
			const before = Array.isArray(g.__AI_TOOL_CALLS__) ? g.__AI_TOOL_CALLS__.length : 0;

			const parsed = await runTurn({
				userId: seller.userId,
				apiKey,
				modelId,
				provider,
				messages,
				context,
				label: step.label,
				toolCallsBefore: before,
			});

			parsed.calls.forEach((t) => allToolsDetected.add(t));
			messages.push(toUIMessage('assistant', parsed.textPreview || ''));

			await new Promise((r) => setTimeout(r, 400));
		}

		const expectedBase = [
			'analyzePipeline',
			'getBoardMetrics',
			'searchDeals',
			'searchContacts',
			'listDealsByStage',
			'listStagnantDeals',
			'listOverdueDeals',
			'getDealDetails',
			'moveDeal',
			'createDeal',
			'updateDeal',
			'markDealAsWon',
			'markDealAsLost',
			'createTask',
			'moveDealsBulk',
			'listActivities',
			'completeActivity',
			'rescheduleActivity',
			'logActivity',
			'addDealNote',
			'listDealNotes',
			'createContact',
			'updateContact',
			'getContactDetails',
			'linkDealToContact',
			'listStages',
			'updateStage',
			'reorderStages',
		] as const;

		const expected = (wantAssignDeal
			? ([...expectedBase, 'assignDeal'] as const)
			: expectedBase) as readonly string[];

		const missing = expected.filter((t) => !allToolsDetected.has(t));

		console.log('\n==============================');
		console.log('📌 RESUMO');
		console.log('==============================');
		console.log(`Org: ${fx.organizationId}`);
		console.log(`Vendedor: ${seller.email} (${seller.userId})`);
		console.log(`Board: ${board.boardId}`);
		console.log(`Tools detectadas (${allToolsDetected.size}): ${Array.from(allToolsDetected).sort().join(', ')}`);

		if (missing.length) {
			console.log(`\n⚠️ Tools NÃO detectadas no chat (${missing.length}): ${missing.join(', ')}`);
			console.log('Dica: como o modelo decide o plano, pode variar. Ajuste o roteiro/linguagem das prompts para forçar chamadas.');
			process.exitCode = 2;
		} else {
			console.log('\n✅ Todas as tools foram detectadas via chat.');
		}
	} finally {
		if (fx) await cleanupSalesTeamFixtures(fx);
		if (prevMinUsers === undefined) delete process.env.SALES_TEAM_MIN_USERS;
		else process.env.SALES_TEAM_MIN_USERS = prevMinUsers;

		if (prevStrict === undefined) delete process.env.SALES_TEAM_STRICT;
		else process.env.SALES_TEAM_STRICT = prevStrict;

		if (prevToolDebug === undefined) delete process.env.AI_TOOL_CALLS_DEBUG;
		else process.env.AI_TOOL_CALLS_DEBUG = prevToolDebug;

		if (prevApprovalBypass === undefined) delete process.env.AI_TOOL_APPROVAL_BYPASS;
		else process.env.AI_TOOL_APPROVAL_BYPASS = prevApprovalBypass;
	}
}

main().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
