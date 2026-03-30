# Plano de Implementacao - Sincronizacao Tags/Etiquetas por Etapa do Deal

> **Escopo**: Automatizar aplicacao de tags e etiquetas WhatsApp baseado na etapa do Deal no Kanban.
> **Arquitetura simplificada**: Apenas webhook dedicado (nao modifica workflow do agente).

---

## Status de Implementacao

| Fase | Descricao | Status | Arquivo |
|------|-----------|--------|---------|
| 1 | Labels no WhatsApp | IMPLEMENTADO | Criadas manualmente no WhatsApp Business |
| 2 | Trigger auto-tag PostgreSQL | IMPLEMENTADO | `supabase/migrations/20260213000000_deal_stage_auto_tag.sql` |
| 3 | Verificar trigger notify_deal_stage_changed | JA EXISTIA | `supabase/migrations/20251201000000_schema_init.sql:2110-2216` |
| 4 | Workflow n8n dedicado | IMPLEMENTADO | `.context/integrations/n8n/[Coronel Picanha] Deal Stage Label Sync.json` |
| 5 | Registrar endpoint no CRM | Pendente (SQL manual) | - |
| 6 | Correcao formato LID | IMPLEMENTADO | Workflow busca @lid via /all-chats |
| 7 | Remocao label anterior | IMPLEMENTADO | Remove label antiga antes de aplicar nova |

---

## Resumo Executivo

Quando um Deal muda de etapa no Kanban, automaticamente:
1. **Tag no Deal** -> Aplicar tag com nome da etapa atual (via trigger PostgreSQL)
2. **Etiqueta no WhatsApp** -> Aplicar label correspondente no contato via WPPConnect (via webhook n8n)

**Exemplo:** Deal move para "Em Atendimento" ->
- Tag "Em Atendimento" e adicionada ao Deal no CRM (trigger `trg_add_stage_tag_to_deal`)
- Label "Em Atendimento" e aplicada no contato no WhatsApp (workflow `Deal Stage Label Sync`)

---

## Arquitetura Simplificada (Revisada)

```
+---------------------------------------------------------------------+
|                      FLUXO DE SINCRONIZACAO                          |
+---------------------------------------------------------------------+
|                                                                      |
|  Deal muda de etapa (via BOT ou MANUAL no CRM)                       |
|       |                                                              |
|       v                                                              |
|  Trigger BEFORE UPDATE: add_stage_tag_to_deal()                      |
|  -> Adiciona tag ao array deals.tags                                 |
|  -> Garante tag na tabela tags                                       |
|       |                                                              |
|       v                                                              |
|  Trigger AFTER UPDATE: notify_deal_stage_changed() [JA EXISTIA]      |
|  -> Dispara webhook com payload (deal + contact data)                |
|       |                                                              |
|       v                                                              |
|  Workflow n8n: [Coronel Picanha] Deal Stage Label Sync               |
|  -> Recebe webhook                                                   |
|  -> Busca/cria label no WhatsApp                                     |
|  -> Aplica label via WPPConnect API                                  |
|                                                                      |
|  COBRE AMBOS os cenarios (bot + manual) com UM workflow              |
|  SEM modificacao no workflow do agente                               |
|  SEM duplicacao de nos                                               |
|  SEM race condition                                                  |
|                                                                      |
+---------------------------------------------------------------------+
```

**Por que nao modificar o workflow do agente:**
As tools CRM (`crm_em_atendimento`, etc.) sao `httpRequestTool` conectadas como `ai_tool` ao no `Agente de IA`. No n8n, tools de agente executam dentro do loop do LLM - nao existe saida visual para encadear nos apos elas.

---

## O Que Foi Implementado

### 1. Migration: Trigger Auto-Tag (IMPLEMENTADO)

**Arquivo:** `supabase/migrations/20260213000000_deal_stage_auto_tag.sql`

**Funcionalidades:**
- Funcao `add_stage_tag_to_deal()` que adiciona tag ao `deals.tags`
- Garante que tag exista na tabela `tags` com cor correspondente
- Trigger `trg_add_stage_tag_to_deal` executa BEFORE UPDATE
- Cria tags padrao para todas as organizacoes existentes

**Mapeamento de cores:**
| Etapa | Cor |
|-------|-----|
| Nova Interacao | #9E9E9E (cinza) |
| Em Atendimento | #4CAF50 (verde) |
| Aguardando Cliente | #FFC107 (amarelo) |
| Informacoes Fornecidas / Info Fornecidas | #2196F3 (azul) |
| Direcionado para Canal Oficial / Canal Oficial | #9C27B0 (roxo) |
| Finalizado | #607D8B (cinza escuro) |

### 2. Trigger notify_deal_stage_changed (JA EXISTIA)

**Localizacao:** `supabase/migrations/20251201000000_schema_init.sql:2110-2216`

**Payload ja inclui dados do contato:**
```json
{
  "event_type": "deal.stage_changed",
  "occurred_at": "timestamp",
  "deal": {
    "id": "uuid",
    "title": "string",
    "from_stage_label": "string",
    "to_stage_label": "string",
    "contact_id": "uuid"
  },
  "contact": {
    "name": "string",
    "phone": "string",
    "email": "string"
  }
}
```

### 3. Workflow n8n: Deal Stage Label Sync (IMPLEMENTADO)

**Arquivo:** `.context/integrations/n8n/[Coronel Picanha] Deal Stage Label Sync.json`

**Webhook URL:** `https://coronel-n8n.lagostacriativa.com.br/webhook/deal-stage-label-sync`

**Fluxo:**
```
Webhook_Deal_Stage_Changed (POST /deal-stage-label-sync)
    |
    v
Extrair_Dados (Set node)
  -> contact_phone, to_stage_label, chatId
    |
    v
Dados_Validos? (IF node)
  -> Verifica se phone e stage existem
    |
    v
Buscar_Labels_WPP (GET /api/{session}/all-labels)
    |
    v
Encontrar_Ou_Criar_Label (Code node)
  -> Procura label pelo nome, define flag para criar se nao existir
    |
    +-- Label existe -> Merge_Labels
    |
    +-- Nao existe -> Criar_Label_WPP -> Set_Label_Criada -> Merge_Labels
                          |
                          v
                    Aplicar_Label_WPP (POST /add-or-remove-labels)
                          |
                          v
                    Aplicacao_OK? -> Fim_Sucesso ou Fim_Erro
```

**Credencial utilizada:** `WPPConnect API` (ID: `fkCh7h3e4c3iHT4J`)

---

## O Que Ainda Precisa Ser Feito

### 1. Criar Labels no WhatsApp (MANUAL)

Antes de ativar o workflow, criar as labels no WhatsApp Business:

```bash
# Listar labels existentes
curl -X GET "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/all-labels" \
  -H "Authorization: Bearer $WPPCONNECT_TOKEN"

# Criar cada label necessaria
curl -X POST "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/add-new-label" \
  -H "Authorization: Bearer $WPPCONNECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Em Atendimento"}'

# Testar aplicacao em chat de teste
curl -X POST "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/add-or-remove-labels" \
  -H "Authorization: Bearer $WPPCONNECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chatIds": ["5527999999999@c.us"], "labels": [{"labelId": "ID_DA_LABEL", "type": "add"}]}'
```

**IMPORTANTE:** Validar o formato exato aceito pela API. Algumas versoes do WPPConnect usam `"options"` ao inves de `"labels"` no body do `add-or-remove-labels`.

### 2. Aplicar Migration (SUPABASE)

```bash
# Na raiz do projeto
cd /Users/cirotrigo/Documents/Agente\ Coronel\ Picanha/lagostacrm
supabase db push

# Ou via SQL direto no Supabase Dashboard
```

### 3. Registrar Endpoint no CRM (SQL)

Executar no Supabase:

```sql
-- Obter o organization_id (executar primeiro)
SELECT id, name FROM public.organizations;

-- Registrar endpoint (substituir <org_id> pelo ID real)
INSERT INTO public.integration_outbound_endpoints (
  organization_id,
  name,
  url,
  secret,
  events,
  active
) VALUES (
  '<org_id>',
  'WhatsApp Label Sync',
  'https://coronel-n8n.lagostacriativa.com.br/webhook/deal-stage-label-sync',
  'label-sync-secret-2024',
  ARRAY['deal.stage_changed'],
  true
);
```

### 4. Importar e Ativar Workflow no n8n

1. Acessar n8n: https://coronel-n8n.lagostacriativa.com.br
2. Importar: `.context/integrations/n8n/[Coronel Picanha] Deal Stage Label Sync.json`
3. Verificar credenciais `WPPConnect API`
4. Ativar workflow

### 5. Preencher OrganizationID no Workflow do Agente (OPCIONAL)

No no `Fluxo_Variaveis` do workflow `[Coronel Picanha] Agente WPPConnect`, o campo `OrganizationID` esta vazio. Se necessario para outras funcionalidades, preencher com o UUID da organizacao:

```json
{
  "id": "org-id",
  "name": "OrganizationID",
  "type": "string",
  "value": "<UUID_DA_ORGANIZACAO>"
}
```

---

## Verificacao Completa

### Cenarios de Teste

| # | Cenario | Acao | Resultado Esperado |
|---|---------|------|-------------------|
| 1 | Bot move deal | Enviar msg no WhatsApp -> bot responde e chama `crm_em_atendimento` | Tag "Em Atendimento" no deal + Label no WhatsApp |
| 2 | Manual no CRM | Arrastar deal para "Aguardando Cliente" no Kanban | Tag "Aguardando Cliente" no deal + Label no WhatsApp |
| 3 | Movimentacao rapida | Mover deal 2 etapas em sequencia | Ambas as tags no deal + Ambas as labels no WhatsApp |
| 4 | WPPConnect offline | Mover deal com WPP fora | Tag no deal + Retry no webhook |
| 5 | Label inexistente | Mover para etapa cuja label nao existe no WPP | Label criada automaticamente + Aplicada |
| 6 | Contato sem chat WPP | Deal sem conversa previa no WhatsApp | Label NÃO aplicada (comportamento esperado) - vai para Fim_Nao_Encontrado |

### Testar Trigger PostgreSQL

```sql
-- Verificar que deal recebe tag ao mudar de etapa
UPDATE deals SET stage_id = '<stage_id_em_atendimento>' WHERE id = '<deal_id>';
SELECT tags FROM deals WHERE id = '<deal_id>';
-- Deve conter 'Em Atendimento' no array

-- Verificar tag na tabela tags
SELECT * FROM tags WHERE name = 'Em Atendimento';
-- Deve existir registro
```

### Testar Webhook

```bash
# Simular payload do webhook
curl -X POST "https://coronel-n8n.lagostacriativa.com.br/webhook/deal-stage-label-sync" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "deal.stage_changed",
    "deal": {
      "id": "test-deal-id",
      "to_stage_label": "Em Atendimento"
    },
    "contact": {
      "phone": "5527999999999",
      "name": "Teste"
    }
  }'
```

---

## Arquivos Criados/Modificados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/migrations/20260213000000_deal_stage_auto_tag.sql` | CRIADO | Trigger para auto-tag |
| `.context/integrations/n8n/[Coronel Picanha] Deal Stage Label Sync.json` | CRIADO | Workflow webhook dedicado |
| `.context/integrations/wppconnect/TAG_LABEL_SYNC_PLAN.md` | ATUALIZADO | Este documento |

**NAO MODIFICADOS:**
- `[Coronel Picanha] Agente WPPConnect.json` - nao precisa alteracao
- `supabase/migrations/20251201000000_schema_init.sql` - trigger ja existia

---

## Descoberta Importante: Formato @lid

### O Problema

O WPPConnect usa internamente o formato `@lid` (Linked ID) para identificar chats, não o formato `@c.us` baseado no número de telefone.

**Exemplo:**
- Formato `@c.us`: `5527997576827@c.us` (baseado no telefone) - NÃO FUNCIONA para labels
- Formato `@lid`: `73993746919534@lid` (ID interno do WhatsApp) - FUNCIONA para labels

### A Solução

O workflow foi atualizado para:
1. Buscar todos os chats via `/all-chats`
2. Procurar o chat pelo número de telefone do contato
3. Extrair o `@lid` correto do chat encontrado
4. Usar o `@lid` para aplicar a label

### Limitações (IMPORTANTE)

**Labels só podem ser aplicadas em chats existentes no WhatsApp.**

- O contato PRECISA ter uma conversa prévia no WhatsApp
- Se o contato nunca conversou, a label NÃO será aplicada
- O workflow trata isso graciosamente: vai para `Fim_Nao_Encontrado` sem erro
- A label será aplicada automaticamente quando o deal mudar de etapa DEPOIS que o contato iniciar conversa

**Fluxo para contatos novos:**
1. Contato novo cria deal (sem chat WhatsApp ainda) → Label NÃO aplicada
2. Contato envia primeira mensagem no WhatsApp → Chat criado
3. Deal muda de etapa novamente → Label APLICADA com sucesso

**Este é comportamento esperado do WhatsApp Business, não um bug.**

---

## Consideracoes Finais

### Remocao de Labels Antigas
- **Comportamento atual:** Apenas adiciona labels (acumula historico)
- **Fase futura:** Se quiser remover label anterior ao adicionar nova, implementar logica no Code node

### Sincronizacao Bidirecional (Fase Futura)
- Quando label e adicionada manualmente no WhatsApp, refletir no CRM
- Requer configurar webhook `onLabel` do WPPConnect
- Usar tabela `whatsapp_label_sync` para mapeamento

### Performance
- Labels consultadas 1x por movimentacao
- Cache pode ser implementado se necessario
- Retry automatico com backoff no no `Aplicar_Label_WPP`

---

## Referencias

- [WPPConnect API Documentation](https://wppconnect.io/docs)
- Trigger existente: `supabase/migrations/20251201000000_schema_init.sql:2110-2216`
- Tabelas de sincronizacao: `whatsapp_label_sync`, `whatsapp_conversation_labels`
