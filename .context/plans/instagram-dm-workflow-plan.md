# Plano: Suporte Multi-Canal (Instagram DM) — Workflow N8N + LagostaCRM

> **Data:** 2026-02-15
> **Status:** Aprovado para implementação
> **Pré-requisitos validados:**
> - [x] Chatwoot do Coronel Picanha suporta Instagram
> - [x] Instagram da marca é Business
> - [ ] App no Meta Developer configurado

> **Atualização v2.0 (multi-org / fork-safe):**
> - Arquitetura de plataforma: `.context/plans/instagram-dm-platform-v2.md`
> - Rollout operacional: `.context/plans/instagram-dm-rollout-v2.md`
> - Checklist único de execução: `.context/plans/instagram-dm-execution-checklist-v2.md`
> - Plano por sprint (S1-S3): `.context/plans/instagram-dm-sprint-plan-v2.md`

---

## Contexto

O workflow `[Coronel Picanha] Agente de atendimento` funciona exclusivamente com WhatsApp, usando `sender.phone_number` como identificador em 14 nodes. O objetivo é adicionar suporte ao Instagram DM sem quebrar o WhatsApp.

O Chatwoot já unifica webhooks de todos os canais — mensagens do Instagram DM chegam no mesmo webhook com a mesma estrutura. A diferença é que `sender.phone_number` será `null` e `sender.identifier` terá o username/IGSID do Instagram.

O envio de resposta via Chatwoot (`POST /conversations/{id}/messages`) é canal-agnóstico — não precisa de Switch no final do fluxo.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO MULTI-CANAL                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐      ┌─────────────┐                                       │
│  │  WhatsApp   │      │  Instagram  │                                       │
│  │  Evolution  │      │  Graph API  │                                       │
│  └──────┬──────┘      └──────┬──────┘                                       │
│         │                    │                                              │
│         └────────────────────┼──────────────────────────────────────────────│
│                              │                                              │
│                     ┌────────▼────────┐                                     │
│                     │    CHATWOOT     │                                     │
│                     │   (Omnichannel) │                                     │
│                     └────────┬────────┘                                     │
│                              │                                              │
│                     ┌────────▼────────┐                                     │
│                     │   WEBHOOK n8n   │                                     │
│                     │                 │                                     │
│                     │  Fluxo_Variaveis│◄── IdentificadorContato (universal) │
│                     │       ↓         │                                     │
│                     │  Encontrar CRM  │◄── Busca por phone OU social_id     │
│                     │       ↓         │                                     │
│                     │  Buffer Redis   │◄── Chave: IdentificadorContato      │
│                     │       ↓         │                                     │
│                     │  Agente IA      │                                     │
│                     │       ↓         │                                     │
│                     │  Tools CRM      │◄── Usa deal_id (canal-agnóstico)    │
│                     │       ↓         │                                     │
│                     │  Resposta       │◄── Chatwoot API (universal)         │
│                     └─────────────────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1 — CRM: Suporte a Identificador Social

### 1.1 Migration: Campo `social_id` na tabela `contacts`

**Arquivo:** `supabase/migrations/20260218000000_contacts_social_id.sql`

```sql
-- Migration: 20260218000000_contacts_social_id.sql

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS social_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_social_id
  ON public.contacts(organization_id, social_id)
  WHERE social_id IS NOT NULL;

COMMENT ON COLUMN public.contacts.social_id IS
  'Identificador de rede social (Instagram username/IGSID, etc.)';
```

**Justificativa:** A tabela `contacts` hoje só tem `phone` e `email` como identificadores de busca. Para Instagram, precisamos de um campo dedicado que não colida com a lógica existente.

---

### 1.2 API de Contacts: Busca e criação por `social_id`

**Arquivo:** `app/api/public/v1/contacts/route.ts`

#### GET — Adicionar `social_id` como parâmetro de busca

No handler GET, adicionar:
```typescript
const socialId = (url.searchParams.get('social_id') || '').trim() || null;
```

Na query builder, adicionar:
```typescript
if (socialId) query = query.eq('social_id', socialId);
```

#### POST — Aceitar `social_id` na criação/upsert

No schema Zod `ContactUpsertSchema`, adicionar:
```typescript
social_id: z.string().optional(),
```

Na lógica de lookup (busca por contato existente), incluir `social_id`:
```typescript
// Atual: busca por email OR phone
// Novo: busca por email OR phone OR social_id
if (socialId) {
  lookup = lookup.or(
    [email && `email.eq.${email}`, phone && `phone.eq.${phone}`, `social_id.eq.${socialId}`]
      .filter(Boolean).join(',')
  );
}
```

No payload de insert/update, incluir:
```typescript
social_id: socialId || undefined,
```

No response, incluir o campo `social_id`.

#### PATCH — Arquivo `[contactId]/route.ts`

Adicionar `social_id` ao `ContactPatchSchema`.

---

### 1.3 API move-stage: Suporte a `ai_summary`

**Arquivo:** `lib/public-api/dealsMoveStage.ts`

Na função `moveStageByDealId`, adicionar parâmetro `aiSummary`:

```typescript
export async function moveStageByDealId(opts: {
  organizationId: string;
  dealId: string;
  target: { ... };
  mark?: 'won' | 'lost' | null;
  aiSummary?: string | null;  // NOVO
}) {
  // ... no objeto updates:
  if (opts.aiSummary) {
    updates.ai_summary = opts.aiSummary;
  }
}
```

**Arquivo:** `app/api/public/v1/deals/move-stage/route.ts`

Adicionar `ai_summary` ao schema:
```typescript
ai_summary: z.string().optional(),
```

---

## Fase 2 — Workflow N8N: Adaptação Multi-Canal

### 2.1 `Fluxo_Variaveis` — Novas variáveis de canal

Adicionar 3 novas variáveis:

| Variável | Expressão |
|----------|-----------|
| `Canal` | `{{ $('Webhook').item.json.body.conversation?.channel \|\| $('Webhook').item.json.body.inbox?.channel?.type \|\| 'Channel::Whatsapp' }}` |
| `IdentificadorContato` | Ver abaixo |
| `Source` | `{{ ($('Webhook').item.json.body.conversation?.channel \|\| '').includes('Instagram') ? 'INSTAGRAM' : 'WHATSAPP' }}` |

**IdentificadorContato (expressão completa):**
```javascript
{{
  (() => {
    const canal = $('Webhook').item.json.body.conversation?.channel || '';
    if (canal.includes('Instagram')) {
      return $('Webhook').item.json.body.sender?.identifier ||
             $('Webhook').item.json.body.sender?.name ||
             'ig-unknown';
    }
    return $('Webhook').item.json.body.sender?.phone_number || '';
  })()
}}
```

**Importante:** Manter `ClienteTelefone` existente (para compatibilidade com WhatsApp).

---

### 2.2 `Filtro_Inicial` — Sem mudanças

Condição atual: `sender.identifier NOT CONTAINS "@g.us"` (filtra grupos WhatsApp).

Manter esta condição — mensagens do Instagram não contêm `@g.us`, então passam normalmente.

---

### 2.3 `Encontrar_Cliente_CRM` — Busca dual

Trocar a lógica para busca condicional:

```
SE ClienteTelefone não vazio:
  GET /contacts?phone=ClienteTelefone           (comportamento atual)
SENÃO:
  GET /contacts?social_id=IdentificadorContato  (busca por social_id)
```

**Implementação:** Usar expressão condicional no query param:

```
URL: {{ CRM-Host }}/api/public/v1/contacts

Query params (dinâmico):
  phone: {{ $('Fluxo_Variaveis').item.json.ClienteTelefone || '' }}
  social_id: {{ $('Fluxo_Variaveis').item.json.ClienteTelefone ? '' : $('Fluxo_Variaveis').item.json.IdentificadorContato }}
  limit: 1
```

---

### 2.4 `Criar_Contato_CRM` — Campos dinâmicos

```json
{
  "name": "{{ ClienteNome }}",
  "phone": "{{ ClienteTelefone }}",
  "social_id": "{{ IdentificadorContato }}",
  "source": "{{ Source }}",
  "stage": "LEAD",
  "status": "ACTIVE"
}
```

| Canal | phone | social_id |
|-------|-------|-----------|
| WhatsApp | preenchido | vazio |
| Instagram | vazio | preenchido |

---

### 2.5 `Criar_Deal_CRM` e `Garantir_Deal_Existente` — Título dinâmico

```json
{
  "title": "{{ Source }} - {{ ClienteNome }}",
  "value": 0,
  "board_key": "{{ CRM-BoardKey }}",
  "contact_id": "{{ contact_id }}"
}
```

---

### 2.6 `normalizacao` — chat_id universal

```
message.chat_id = {{ IdentificadorContato }}
```

(Em vez de `ClienteTelefone`)

---

### 2.7 Buffer Redis (3 nodes)

| Node | Mudança |
|------|---------|
| `push message buffer` | `key: buffer:{{ IdentificadorContato }}` |
| `get messages buffer` | `key: buffer:{{ IdentificadorContato }}` |
| `delete buffer` | `key: buffer:{{ IdentificadorContato }}` |

---

### 2.8 `Memoria_Redis` — sessionKey universal

```
sessionKey: {{ IdentificadorContato }}
```

(Em vez de `ClienteTelefone`)

---

### 2.9 Tools CRM (5 nodes) — Usar deal_id

Trocar TODAS as 5 tools de:

**Antes:**
```
URL: /api/public/v1/deals/move-stage-by-identity
Body: { "board_key_or_id": "...", "phone": "{{ contact_phone }}", ... }
```

**Depois:**
```
URL: /api/public/v1/deals/move-stage
Body: { "deal_id": "{{ deal_id }}", "to_stage_label": "...", "ai_summary": "..." }
```

| Node | to_stage_label |
|------|----------------|
| `crm_em_atendimento` | "Em Atendimento" |
| `crm_aguardando_cliente` | "Aguardando Cliente" |
| `crm_info_fornecidas` | "Informações Fornecidas" |
| `crm_canal_oficial` | "Direcionado Canal Oficial" |
| `crm_finalizado` | "Finalizado" |

**Onde pegar deal_id:** `$('Merge_Contatos').item.json.deal_id` (já disponível)

---

### 2.10 `Agente de IA` — Input com canal

Atualizar o campo text do agente:

```xml
<DadosUsuario>
contact_id: {{ contact_id }}
client_name: {{ contact_name }}
client_phone: {{ contact_phone }}
canal: {{ Source }}
</DadosUsuario>

Mensagem do usuário: {{ messages }}
```

---

## Fase 3 — Chatwoot: Configurar Inbox Instagram

### Checklist de Configuração

- [ ] Acessar Chatwoot do Coronel Picanha (admin)
- [ ] Ir em Settings → Inboxes → Add Inbox
- [ ] Selecionar "Instagram"
- [ ] Conectar página do Facebook vinculada ao Instagram Business
- [ ] Autorizar permissões:
  - `instagram_basic`
  - `instagram_manage_messages`
  - `pages_messaging`
- [ ] Configurar webhook (mesmo endpoint do WhatsApp)
- [ ] Testar: enviar DM do Instagram pessoal → verificar chegou no Chatwoot

---

## Resumo de Mudanças

### CRM (3 arquivos + 1 migration)

| Arquivo | Mudança | Status |
|---------|---------|--------|
| `supabase/migrations/20260218000000_contacts_social_id.sql` | Novo campo `social_id` | [ ] |
| `app/api/public/v1/contacts/route.ts` | Busca e criação por `social_id` | [ ] |
| `app/api/public/v1/contacts/[contactId]/route.ts` | PATCH com `social_id` | [ ] |
| `lib/public-api/dealsMoveStage.ts` | `ai_summary` em `moveStageByDealId` | [ ] |
| `app/api/public/v1/deals/move-stage/route.ts` | `ai_summary` no schema | [ ] |

### Workflow N8N (14 nodes modificados)

| Node | Mudança | Status |
|------|---------|--------|
| `Fluxo_Variaveis` | +3 variáveis (Canal, IdentificadorContato, Source) | [ ] |
| `Encontrar_Cliente_CRM` | Query dual: phone ou social_id | [ ] |
| `Criar_Contato_CRM` | Campos dinâmicos (phone/social_id/source) | [ ] |
| `Criar_Deal_CRM` | Título dinâmico | [ ] |
| `Garantir_Deal_Existente` | Título dinâmico | [ ] |
| `Set_Contato_Novo` | Incluir social_id nos dados | [ ] |
| `normalizacao` | chat_id = IdentificadorContato | [ ] |
| `push message buffer` | key com IdentificadorContato | [ ] |
| `get messages buffer` | key com IdentificadorContato | [ ] |
| `delete buffer` | key com IdentificadorContato | [ ] |
| `Memoria_Redis` | sessionKey = IdentificadorContato | [ ] |
| `crm_em_atendimento` | URL move-stage + deal_id | [ ] |
| `crm_aguardando_cliente` | URL move-stage + deal_id | [ ] |
| `crm_info_fornecidas` | URL move-stage + deal_id | [ ] |
| `crm_canal_oficial` | URL move-stage + deal_id | [ ] |
| `crm_finalizado` | URL move-stage + deal_id | [ ] |
| `Agente de IA` | Input com campo canal | [ ] |

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Quebrar WhatsApp ao mudar `ClienteTelefone` | Baixa | Variáveis novas são **adicionais**. `ClienteTelefone` continua existindo. `IdentificadorContato` = `ClienteTelefone` quando WhatsApp. |
| Instagram `sender.identifier` muda de formato | Baixa | Usar `social_id` como campo genérico, não `instagram_id`. Funciona para qualquer rede social futura. |
| `deal_id` vazio quando contato novo | Baixa | `Criar_Deal_CRM` e `Garantir_Deal_Existente` já retornam `deal_id`. Verificar propagação em `Set_Contato_Novo`. |
| Dois contatos para mesma pessoa (WhatsApp + Instagram) | Esperado | Comportamento V1. Em V2, criar tela de merge manual no CRM. |
| `move-stage` falha se deal fechado | Baixa | `moveStageByDealId` já verifica `is_won`/`is_lost`. |

---

## Ordem de Implementação

### Etapa 1: CRM
- [ ] Criar migration `social_id`
- [ ] Aplicar migration no Supabase
- [ ] Modificar API contacts (GET, POST, PATCH)
- [ ] Adicionar `ai_summary` em moveStageByDealId
- [ ] Modificar schema da rota move-stage

### Etapa 2: Testar CRM
- [ ] Criar contato com `social_id` via API
- [ ] Buscar contato por `social_id`
- [ ] Move-stage por `deal_id` com `ai_summary`

### Etapa 3: Workflow N8N
- [ ] Adicionar variáveis em `Fluxo_Variaveis`
- [ ] Modificar `Encontrar_Cliente_CRM`
- [ ] Modificar `Criar_Contato_CRM`
- [ ] Modificar nodes de Deal
- [ ] Modificar `normalizacao`
- [ ] Modificar 3 nodes de Buffer Redis
- [ ] Modificar `Memoria_Redis`
- [ ] Modificar 5 tools CRM
- [ ] Modificar `Agente de IA`

### Etapa 4: Testar WhatsApp (Regressão)
- [ ] Enviar mensagem WhatsApp → verificar fluxo completo
- [ ] Verificar contato criado com phone
- [ ] Verificar deal criado
- [ ] Verificar resposta do agente

### Etapa 5: Configurar Chatwoot
- [ ] Criar inbox Instagram no Chatwoot
- [ ] Conectar página Facebook/Instagram
- [ ] Configurar webhook

### Etapa 6: Testar Instagram (End-to-End)
- [ ] Enviar DM do Instagram pessoal
- [ ] Verificar chegou no Chatwoot
- [ ] Verificar webhook disparou
- [ ] Verificar contato criado com social_id
- [ ] Verificar deal criado
- [ ] Verificar resposta do agente no DM

---

## Critérios de Sucesso

- [ ] WhatsApp continua funcionando 100% (sem regressão)
- [ ] Instagram DM cria contato com `social_id`
- [ ] Instagram DM cria deal vinculado
- [ ] Agente IA responde no Instagram DM
- [ ] Tools CRM funcionam (move-stage) via `deal_id`
- [ ] Buffer Redis funciona para Instagram (sem colisão com WhatsApp)

---

## Notas de Implementação

### Para quem implementar:

1. **Ler arquivos antes de editar** — Verificar estrutura atual
2. **Testar cada fase** — Não pular para próxima sem validar
3. **Manter compatibilidade** — WhatsApp deve funcionar durante todo o processo
4. **Logs** — Adicionar logs nas mudanças para debug

### Arquivos para ler primeiro:

```
app/api/public/v1/contacts/route.ts
app/api/public/v1/contacts/[contactId]/route.ts
app/api/public/v1/deals/move-stage/route.ts
lib/public-api/dealsMoveStage.ts
```

### Workflow n8n para exportar:

- Exportar JSON do workflow atual antes de modificar
- Manter backup em `.context/integrations/n8n/`
