#!/usr/bin/env npx tsx
/**
 * 🧪 AI Tools Sales Team Matrix - 5 vendedores (integração real)
 *
 * Roda todas as tools para 5 vendedores com boards isolados e gera um relatório.
 *
 * Uso:
 *   npx tsx scripts/test-tools-sales-team.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createCRMTools } from '../lib/ai/tools';
import { createSalesTeamFixtures, cleanupSalesTeamFixtures, type SalesTeamFixtureBundle } from '../test/helpers/salesTeamFixtures';

type ToolMap = Record<string, { execute: (input: unknown) => unknown | Promise<unknown> }>;

const expectedTools = [
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
  'assignDeal',
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

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

async function callTool(map: ToolMap, name: string, input: unknown): Promise<unknown> {
  const tool = map[name];
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return await tool.execute(input);
}

async function runOneSeller(fx: SalesTeamFixtureBundle, sellerId: string) {
  const seller = fx.users.find((u) => u.userId === sellerId);
  if (!seller) throw new Error('Seller not found');

  const board = fx.boardsByUserId[seller.userId];
  const bundle = fx.dealsByUserId[seller.userId];

  const tools = createCRMTools(
    {
      organizationId: fx.organizationId,
      boardId: board.boardId,
      dealId: bundle.openDealId,
      wonStage: 'Ganho',
    },
    seller.userId,
  ) as unknown as ToolMap;

  for (const t of expectedTools) {
    if (!tools[t]) throw new Error(`Missing tool: ${t}`);
  }

  const cases: Array<{ tool: (typeof expectedTools)[number]; input: unknown }> = [
    { tool: 'analyzePipeline', input: { boardId: board.boardId } },
    { tool: 'getBoardMetrics', input: { boardId: board.boardId } },
    { tool: 'searchDeals', input: { query: fx.runId.split('_')[0] || 'Deal', limit: 5 } },
    { tool: 'searchContacts', input: { query: bundle.contactEmail, limit: 5 } },
    { tool: 'listDealsByStage', input: { boardId: board.boardId, stageName: 'Novo', limit: 10 } },
    { tool: 'listStagnantDeals', input: { boardId: board.boardId, daysStagnant: 7, limit: 10 } },
    { tool: 'listOverdueDeals', input: { boardId: board.boardId, limit: 10 } },
    { tool: 'getDealDetails', input: { dealId: bundle.openDealId } },

    { tool: 'moveDeal', input: { dealId: bundle.openDealId, stageName: 'Proposta' } },
    {
      tool: 'createDeal',
      input: {
        title: `Novo Deal ${seller.firstName} ${fx.runId}`,
        value: 123,
        contactName: `Contato Novo ${seller.firstName} ${fx.runId}`,
        boardId: board.boardId,
      },
    },
    {
      tool: 'updateDeal',
      input: { dealId: bundle.openDealId, title: `Deal Open (upd) ${seller.firstName} ${fx.runId}` },
    },

    { tool: 'listActivities', input: { boardId: board.boardId, dealId: bundle.openDealId, limit: 10 } },
    {
      tool: 'rescheduleActivity',
      input: { activityId: bundle.futureActivityId, newDate: new Date(Date.now() + 86400_000).toISOString() },
    },
    { tool: 'completeActivity', input: { activityId: bundle.futureActivityId } },
    {
      tool: 'logActivity',
      input: { title: `Ligação registrada ${seller.firstName} ${fx.runId}`, dealId: bundle.openDealId, type: 'CALL' },
    },

    { tool: 'addDealNote', input: { dealId: bundle.openDealId, content: `Nota ${seller.firstName} ${fx.runId}` } },
    { tool: 'listDealNotes', input: { dealId: bundle.openDealId, limit: 5 } },

    {
      tool: 'createContact',
      input: {
        name: `Contato Criado ${seller.firstName} ${fx.runId}`,
        email: `created.${seller.firstName.toLowerCase()}.${fx.runId}@example.com`,
        phone: '11999990000',
        companyName: `Empresa ${seller.firstName}`,
      },
    },

    { tool: 'createTask', input: { title: `Task ${seller.firstName} ${fx.runId}`, dealId: bundle.openDealId, type: 'TASK' } },

    {
      tool: 'moveDealsBulk',
      input: { dealIds: [bundle.openDealId, bundle.wonDealId], boardId: board.boardId, stageName: 'Proposta', allowPartial: false },
    },

    { tool: 'markDealAsWon', input: { dealId: bundle.wonDealId, wonValue: 2000 } },
    { tool: 'markDealAsLost', input: { dealId: bundle.lostDealId, reason: 'Preço' } },

    // assign deal para o próximo vendedor em círculo
    {
      tool: 'assignDeal',
      input: {
        dealId: bundle.wonDealId,
        newOwnerId: fx.users[(fx.users.findIndex((u) => u.userId === seller.userId) + 1) % fx.users.length].userId,
      },
    },

    { tool: 'listStages', input: { boardId: board.boardId } },
    { tool: 'updateStage', input: { stageId: board.stageIds.proposta, label: `Proposta (${seller.firstName})` } },
    {
      tool: 'reorderStages',
      input: { boardId: board.boardId, orderedStageIds: [board.stageIds.novo, board.stageIds.ganho, board.stageIds.proposta, board.stageIds.perdido] },
    },
  ];

  const results: Array<{ tool: string; ok: boolean; ms: number; error?: string }> = [];

  for (const c of cases) {
    const start = Date.now();
    try {
      const res = await callTool(tools, c.tool, c.input);
      const ms = Date.now() - start;
      const err = asObj(res)?.error;
      results.push({ tool: c.tool, ok: typeof err !== 'string', ms, error: typeof err === 'string' ? String(err) : undefined });
    } catch (e: unknown) {
      const ms = Date.now() - start;
      const msg =
        e &&
        typeof e === 'object' &&
        'message' in e &&
        typeof (e as { message?: unknown }).message === 'string'
          ? (e as { message: string }).message
          : String(e);
      results.push({ tool: c.tool, ok: false, ms, error: msg });
    }
  }

  return { seller, results };
}

async function main() {
  let fx: SalesTeamFixtureBundle | null = null;
  try {
    fx = await createSalesTeamFixtures();

    const runs: Array<{
      seller: { firstName: string; email: string };
      results: Array<{ tool: string; ok: boolean; ms: number; error?: string }>;
    }> = [];
    for (const s of fx.users) {
      runs.push(await runOneSeller(fx, s.userId));
    }

    const outDir = join(process.cwd(), 'testsprite_tests', 'tmp');
    mkdirSync(outDir, { recursive: true });

    const lines: string[] = [];
    lines.push(`# AI Tools — Matriz 5 vendedores`);
    lines.push('');
    lines.push(`RunId: \`${fx.runId}\``);
    lines.push(`Org: \`${fx.organizationId}\``);
    lines.push('');

    for (const r of runs) {
      lines.push(`## ${r.seller.firstName} (${r.seller.email})`);
      lines.push('');
      lines.push('| Tool | Resultado | Tempo (ms) |');
      lines.push('|---|---:|---:|');
      for (const row of r.results) {
        const status = row.ok ? '✅ OK' : `❌ FAIL${row.error ? ` — ${row.error.replace(/\|/g, '\\|').slice(0, 120)}` : ''}`;
        lines.push(`| ${row.tool} | ${status} | ${row.ms} |`);
      }
      lines.push('');
    }

    const outPath = join(outDir, 'ai-tools-sales-team-report.md');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');

    console.log(`✅ Relatório gerado em: ${outPath}`);

    const failed = runs.flatMap((r) => r.results.filter((x) => !x.ok));
    if (failed.length) {
      console.error(`❌ ${failed.length} falha(s) detectada(s). Ver relatório.`);
      process.exitCode = 1;
    }
  } finally {
    if (fx) await cleanupSalesTeamFixtures(fx);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
