# Integracao n8n Workflow ↔ Chatwoot ↔ LagostaCRM

> **Data:** 2026-02-13
> **Workflow:** [Coronel Picanha] Agente de atendimento

---

## Resumo do Workflow

O workflow `[Coronel Picanha] Agente de atendimento` e um agente de IA que:

1. Recebe mensagens do Chatwoot (webhook)
2. Processa texto, audio, imagens e PDFs
3. Integra com o LagostaCRM (contatos, deals)
4. Move deals no Kanban conforme o atendimento progride
5. Envia respostas via API do Chatwoot

---

## Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DO WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Chatwoot Webhook] → POST /agente/atendimento                          │
│          ↓                                                               │
│  [Filtro_Inicial] - Filtra apenas mensagens incoming sem assignee       │
│          ↓                                                               │
│  [Fluxo_Variaveis] - Extrai dados do webhook                            │
│          ↓                                                               │
│  [Encontrar_Cliente_CRM] - GET /api/public/v1/contacts?phone=           │
│          ↓                                                               │
│  [Existe_No_CRM?] ─── Sim ──→ [Set_Contato_Existente]                   │
│          │                            ↓                                  │
│          └─── Nao ──→ [Criar_Contato_CRM] → [Criar_Deal_CRM]            │
│                               ↓                                          │
│                       [Set_Contato_Novo]                                 │
│                               ↓                                          │
│  [Merge_Contatos] ← ─────────────────────                                │
│          ↓                                                               │
│  [MessageType] - Switch por tipo de mensagem                            │
│     ├── texto → [Msg Texto]                                             │
│     ├── audio → [getAudio] → [Transcrever Audio]                        │
│     ├── imagem → [getImage] → [Analise Imagem]                          │
│     └── documento → [getDoc] → [Extract PDF] → [Analise Doc]            │
│          ↓                                                               │
│  [Merge_Tipos] → [Buffer Redis] → [Agente de IA]                        │
│          ↓                                                               │
│  [Humanizador] → [Split Out] → [Loop Over Items]                        │
│          ↓                                                               │
│  [Enviar_Resposta_Chatwoot] - POST /api/v1/accounts/.../messages        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Variaveis do Fluxo

| Variavel | Valor | Descricao |
|----------|-------|-----------|
| `CRM-Host` | `https://coronelpicanhacrm.vercel.app` | URL do LagostaCRM |
| `CRM-BoardKey` | `suporte-ao-cliente-restaurante` | Board do Kanban |
| `CW-Host` | `https://chatwoot-coronel.lagostacriativa.com.br` | URL do Chatwoot |
| `N8N-Host` | `https://n8n-coronel.lagostacriativa.com.br` | URL do n8n |
| `BufferDelay` | `3` | Segundos de buffer para mensagens |
| `CW-EtiquetaRH` | `atendimento-humano` | Label para handoff humano |

---

## Tools do Agente de IA

### Movimentacao no Kanban (CRM)

| Tool | Stage Destino | Quando Usar |
|------|---------------|-------------|
| `crm_em_atendimento` | Em Atendimento | Ao comecar atender ativamente |
| `crm_aguardando_cliente` | Aguardando Cliente | Ao aguardar resposta do cliente |
| `crm_info_fornecidas` | Informacoes Fornecidas | Cliente forneceu informacoes |
| `crm_canal_oficial` | Direcionado para Canal Oficial | Encaminhou para reserva/evento |
| `crm_finalizado` | Finalizado | Atendimento concluido |

### Outras Tools

| Tool | Descricao |
|------|-----------|
| `update_contato` | Atualiza nome/email do contato |
| `buscar_deals` | Lista deals do contato |
| `buscar_promocoes` | Consulta promocoes ativas |
| `adicionar_produto_deal` | Adiciona produto ao deal |
| `registrar_agendamento_crm` | Cria atividade de reuniao |

---

## Pontos de Integracao com Chatwoot Tables

### 1. Criar messaging_conversation_links

**Quando:** Apos criar/encontrar contato no CRM

**Onde adicionar:** Apos o node `Merge_Contatos`

```javascript
// Novo node: "Criar_Conversation_Link"
POST {{ CRM-Host }}/api/chatwoot/conversation-links
{
  "chatwoot_conversation_id": {{ CW-ConversationID }},
  "chatwoot_contact_id": {{ CW-ContactID }},
  "chatwoot_inbox_id": {{ CW-Inbox }},
  "contact_id": {{ contact_id }},
  "chatwoot_url": "{{ CW-Host }}/app/accounts/{{ CW-Account }}/conversations/{{ CW-ConversationID }}",
  "contact_avatar_url": {{ CW-Contact-Thumbnail }}  // Sincroniza avatar do Chatwoot para o contato CRM
}
```

> **Nota:** O campo `contact_avatar_url` é opcional. Se fornecido junto com `contact_id`, o avatar será sincronizado para o contato no CRM (apenas se o contato ainda não tiver avatar).

### 2. Labels Sync ao Mover Deal

**Fluxo atual:**
1. Agente chama `crm_em_atendimento` (ou outra tool)
2. API move deal para novo stage
3. Trigger `trg_auto_tag_deal_on_stage` adiciona tag ao deal
4. Trigger `trg_notify_deal_stage_changed` envia webhook

**O que falta:**
- Configurar endpoint de webhook para `deal.stage_changed`
- Criar workflow n8n para aplicar labels no Chatwoot

**Workflow sugerido:**

```
[Webhook deal.stage_changed]
      ↓
[Buscar Label Map] - GET /api/chatwoot/labels?stage_id=xxx
      ↓
[Buscar Conversation Link] - GET /api/chatwoot/conversation-links?deal_id=xxx
      ↓
[Aplicar Label Chatwoot] - POST /api/v1/accounts/.../conversations/.../labels
      ↓
[Registrar Log] - POST /api/chatwoot/labels/sync-log
```

### 3. Atualizar Deal ID no Link

**Quando:** Apos criar deal no CRM

**Onde adicionar:** Apos o node `Criar_Deal_CRM` ou `Garantir_Deal_Existente`

```javascript
// Atualizar conversation link com deal_id
PATCH {{ CRM-Host }}/api/chatwoot/conversation-links
{
  "id": {{ conversation_link_id }},
  "deal_id": {{ deal_id }}
}
```

---

## Sugestoes de Modificacao do Workflow

### Adicao 1: Criar Link na Entrada

Adicionar node apos `Merge_Contatos`:

```json
{
  "name": "Criar_Conversation_Link",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "={{ $('Fluxo_Variaveis').item.json['CRM-Host'] }}/api/chatwoot/conversation-links",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": {
      "chatwoot_conversation_id": "={{ $('Fluxo_Variaveis').item.json['CW-ConversationID'] }}",
      "chatwoot_contact_id": "={{ $('Fluxo_Variaveis').item.json['CW-ContactID'] }}",
      "chatwoot_inbox_id": "={{ $('Fluxo_Variaveis').item.json['CW-Inbox'] }}",
      "contact_id": "={{ $json.contact_id }}",
      "chatwoot_url": "={{ $('Fluxo_Variaveis').item.json['CW-Host'] }}/app/accounts/{{ $('Fluxo_Variaveis').item.json['CW-Account'] }}/conversations/{{ $('Fluxo_Variaveis').item.json['CW-ConversationID'] }}"
    }
  }
}
```

### Adicao 2: Configurar Mapeamento de Labels

Criar mapeamentos iniciais na tabela `messaging_label_map`:

| crm_tag_name | chatwoot_label | board_stage_id |
|--------------|----------------|----------------|
| `nova-interacao` | `nova_interacao` | (uuid stage 1) |
| `em-atendimento` | `em_atendimento` | (uuid stage 2) |
| `aguardando-cliente` | `aguardando_cliente` | (uuid stage 3) |
| `info-fornecidas` | `info_fornecidas` | (uuid stage 4) |
| `canal-oficial` | `canal_oficial` | (uuid stage 5) |
| `finalizado` | `finalizado` | (uuid stage 6) |

### Adicao 3: Workflow de Labels Sync

Criar novo workflow `[Coronel Picanha] Deal Stage Label Sync`:

```
Trigger: Webhook /deal/stage-changed
   ↓
HTTP Request: GET /api/chatwoot/labels?stage_id={{ stage_id }}
   ↓
HTTP Request: GET /api/chatwoot/conversation-links?deal_id={{ deal_id }}
   ↓
IF: Tem conversation link?
   ├── Sim → HTTP Request: POST Chatwoot /labels
   └── Nao → No Operation
   ↓
HTTP Request: POST /api/chatwoot/labels/sync-log
```

---

## Configuracao Necessaria

### 1. Endpoint de Webhook no CRM

Adicionar em `integration_outbound_endpoints`:

```sql
INSERT INTO integration_outbound_endpoints (
  organization_id,
  name,
  url,
  events,
  active
) VALUES (
  'uuid-org',
  'n8n Labels Sync',
  'https://n8n-coronel.lagostacriativa.com.br/webhook/deal/stage-changed',
  ARRAY['deal.stage_changed'],
  true
);
```

### 2. Credenciais n8n

O workflow ja usa as credenciais:
- `Coronel CRM` (httpHeaderAuth) - para LagostaCRM
- `ChatWoot Coronel` (httpHeaderAuth) - para Chatwoot
- `Redis account` - para buffer de mensagens
- `OpenAi account 2` - para IA

### 3. Variaveis de Ambiente LagostaCRM

Ja configuradas em `.env.example`:
- `CHATWOOT_BASE_URL`
- `CHATWOOT_API_TOKEN`
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_WEBHOOK_SECRET`
- `N8N_WEBHOOK_SECRET`

---

## Fluxo Completo Integrado

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO INTEGRADO COMPLETO                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Cliente envia mensagem no WhatsApp                                  │
│                    ↓                                                     │
│  2. Evolution API → Chatwoot                                            │
│                    ↓                                                     │
│  3. Chatwoot Webhook → n8n (Agente de atendimento)                      │
│                    ↓                                                     │
│  4. n8n busca/cria contato no LagostaCRM                                │
│     n8n cria conversation_link (Chatwoot ↔ CRM)                         │
│                    ↓                                                     │
│  5. n8n processa mensagem (texto/audio/imagem/pdf)                      │
│                    ↓                                                     │
│  6. Agente IA responde e usa tools:                                     │
│     - crm_em_atendimento → Move deal no Kanban                          │
│                    ↓                                                     │
│  7. Trigger SQL adiciona tag ao deal                                    │
│     Trigger SQL envia webhook deal.stage_changed                        │
│                    ↓                                                     │
│  8. n8n (Labels Sync) recebe webhook                                    │
│     - Busca label mapping                                               │
│     - Busca conversation link                                           │
│     - Aplica label no Chatwoot                                          │
│                    ↓                                                     │
│  9. n8n (Agente) envia resposta via Chatwoot API                        │
│                    ↓                                                     │
│ 10. Chatwoot → Evolution API → WhatsApp → Cliente                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Proximos Passos

1. [ ] Adicionar node `Criar_Conversation_Link` no workflow principal
2. [ ] Criar workflow `Deal Stage Label Sync`
3. [ ] Configurar `integration_outbound_endpoints` com evento `deal.stage_changed`
4. [ ] Popular `messaging_label_map` com mapeamentos dos stages
5. [ ] Testar fluxo completo de labels sync
6. [ ] Adicionar node para atualizar `deal_id` no conversation link

---

## Referencias

- [IMPLEMENTATION_PLAN.md](../chatwoot/IMPLEMENTATION_PLAN.md)
- [ARCHITECTURE.md](../chatwoot/ARCHITECTURE.md)
- [LABELS_SYNC.md](../chatwoot/LABELS_SYNC.md)
