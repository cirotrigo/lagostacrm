# Plano de testes — AI Tools (5 vendedores, perfis diferentes)

Este plano cobre **todas as tools** em `lib/ai/tools.ts` (29 tools) executadas por **5 vendedores reais** (usuários reais em `auth.users`, com `profiles` criados pelo trigger), cada um com:

- board isolado (para evitar interferência ao mexer em estágios)
- contato/deals/atividades próprios
- perfis com nomes/nicknames distintos (para validar personalização em mensagens como `assignDeal`)

> Observação: hoje as tools não aplicam RBAC por `profiles.role` (o papel existe, mas não bloqueia ações). Portanto, a suíte é principalmente **smoke/contrato + efeitos colaterais + isolamento de dados por usuário/board**.

## Objetivos

1. **Sem crash**: nenhuma tool pode lançar exception em cenários válidos.
2. **Contrato básico**: respostas são objetos esperados (e quando houver erro, é erro "controlado" via `{ error: string }`).
3. **Efeitos colaterais reais**: tools de escrita alteram o banco de forma consistente (move, create, update, log etc.).
4. **Cobertura por perfil**: executar o mesmo conjunto com 5 vendedores distintos para pegar diferenças de dados (owner_id, nickname etc.).
5. **Isolamento**: cada vendedor opera no seu board e nos seus próprios IDs (evita falso positivo por interferência entre casos).

## Perfis (5 vendedores)

Criados via `supabase.auth.admin.createUser`, com metadata:

- `organization_id`: org do teste
- `role`: `vendedor`
- `first_name` / `nickname`: diferentes por usuário

## Dados de fixture por vendedor

Para cada vendedor:

- 1 board + 4 estágios: `Novo`, `Proposta`, `Ganho`, `Perdido`
- 1 contato (com email único)
- 3 deals:
  - `openDeal` (stagnant, `updated_at` = 10 dias atrás)
  - `wonDeal` (candidato a ganho)
  - `lostDeal` (candidato a perdido)
- 2 atividades:
  - 1 atrasada (`date` = 2 dias atrás, `completed=false`) para `listOverdueDeals`
  - 1 futura (`date` = +3 dias, `completed=false`) para `rescheduleActivity` e `completeActivity`

## Matriz de execução (tools)

### Leitura (read-only)

- `analyzePipeline`
- `getBoardMetrics`
- `searchDeals`
- `searchContacts`
- `listDealsByStage`
- `listStagnantDeals`
- `listOverdueDeals`
- `getDealDetails`
- `listActivities`
- `listDealNotes`
- `getContactDetails`
- `listStages`

### Escrita (side-effects)

- `moveDeal`
- `createDeal`
- `updateDeal`
- `markDealAsWon`
- `markDealAsLost`
- `assignDeal`
- `createTask`
- `moveDealsBulk`
- `completeActivity`
- `rescheduleActivity`
- `logActivity`
- `addDealNote`
- `createContact`
- `updateContact`
- `linkDealToContact`
- `updateStage`
- `reorderStages`

## Como rodar

### Via Vitest (recomendado, CI-friendly)

- arquivo: `test/tools.salesTeamMatrix.test.ts`
- roda automaticamente em `npm run test:run`
- **só executa** se existir `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` reais (caso contrário, o teste fica skipped)

### Via script (gera relatório)

- arquivo: `scripts/test-tools-sales-team.ts`
- execução:
  - `npx tsx scripts/test-tools-sales-team.ts`
- output:
  - `testsprite_tests/tmp/ai-tools-sales-team-report.md`

## Critérios de sucesso

- 5 vendedores × (todas as tools) executadas sem exception
- nenhuma tool retornar resposta inválida/undefined
- tools de escrita retornarem sucesso (ou erro controlado e justificável)
- relatório do script sem falhas

## Extensões futuras (quando RBAC estiver ativo)

Quando implementarmos RBAC real por tool:

- definir matriz de permissões (ex.: vendedor vs gerente vs admin)
- adicionar testes de **negação** (403 lógico) para tools de configuração (ex.: `updateStage`, `reorderStages`) para papéis sem permissão
- adicionar teste de auditoria (log de ações) e trilha de atividades
