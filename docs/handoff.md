# Handoff IA ↔ Humano — Arquitetura e Integração n8n

Este documento descreve a arquitetura do handoff IA↔Humano após a refatoração de
abril/2026 e lista as mudanças necessárias nos workflows n8n de cada cliente
para que o bot pare instantaneamente quando um humano assume.

## Visão geral

Antes, o estado "bot ligado/desligado" era derivado em tempo de render a partir
das labels do Chatwoot (`atendimento-humano`). Isso causava três problemas:

1. O toggle do CRM demorava 1–3 s para refletir (cache do React Query).
2. O CRM não ficava sincronizado quando um humano respondia direto no Instagram.
3. O agente n8n só parava de responder no turno seguinte **se** a label já
   tivesse propagado no payload do webhook — o que é uma race condition.

Agora existe uma **fonte única da verdade**: a coluna
`messaging_conversation_links.ai_enabled` no Supabase.

```
┌─────────────────────────────────────────────────────────────┐
│               POST /api/messaging/handoff                   │
│  body: { conversation_id, mode: "ai"|"human", source, reason } │
│                                                              │
│  1. UPDATE messaging_conversation_links (Realtime publica)  │
│  2. Chatwoot: add/remove label atendimento-humano           │
│  3. Chatwoot: assign/unassign agente                        │
└─────────────────────────────────────────────────────────────┘
    ▲              ▲                  ▲                  ▲
    │              │                  │                  │
┌───┴──┐    ┌──────┴────┐     ┌───────┴─────┐    ┌──────┴─────┐
│  UI   │   │ n8n agent │     │ n8n auto    │    │  Webhook   │
│toggle │   │ tool      │     │ assign      │    │ Chatwoot   │
└───────┘   │ transferir│     │ (echo IG/WA)│    │ (mirror)   │
            │ _humano   │     └─────────────┘    └────────────┘
            └───────────┘
```

Todos os atores gravam no mesmo endpoint. A UI reage via Supabase Realtime
(canal `messaging-links-realtime`, já configurado em `useMessagingRealtime`).

## Endpoint

### POST /api/messaging/handoff

Autenticação (uma das duas):
- `Cookie` de sessão do CRM (para uso via UI)
- `X-Api-Key: ncrm_...` (para workflows n8n e integrações externas)

Body:
```json
{
  "conversation_id": 12345,
  "mode": "human",
  "reason": "client_requested",
  "source": "agent",
  "skip_chatwoot": false
}
```

Campos:
- `conversation_id` — ID da conversa no Chatwoot (obrigatório)
- `mode` — `"ai"` liga o bot, `"human"` pausa o bot (obrigatório)
- `reason` — texto livre, ex: `client_requested`, `manual_reply`, `agent_decision`
- `source` — quem originou: `ui | agent | echo_ig | echo_wa | webhook | api`
- `skip_chatwoot` — `true` se o Chatwoot já reflete o estado (evita echo)

Resposta:
```json
{
  "ok": true,
  "ai_enabled": false,
  "conversation_id": 12345,
  "source": "agent",
  "reason": "client_requested",
  "chatwoot": { "labels": "ok", "assign": "ok" }
}
```

### GET /api/messaging/handoff?conversation_id=12345

Lookup rápido do estado atual. Use no Filtro_Inicial do n8n **antes** de
processar o turno.

Resposta:
```json
{
  "ai_enabled": true,
  "handoff_source": null,
  "handoff_reason": null,
  "handoff_at": null,
  "assigned_agent_id": null
}
```

Latência alvo: < 100 ms (um SELECT indexado em `messaging_conversation_links`).

## Mudanças necessárias nos workflows n8n

Aplicar em **cada cliente** (Empório Fonseca, Wine Vix, Coronel Picanha).

### 1. Workflow "Agente" — adicionar node `Check_Handoff` no Filtro_Inicial

Objetivo: consultar o estado canônico no CRM **antes** de processar o turno.
Se o bot estiver em modo humano, parar imediatamente.

**Posicionar ANTES do node `Filtro_Inicial`** (ou logo depois, se preferir
preservar o filtro existente como defesa adicional).

**Tipo:** HTTP Request
**Name:** `Check_Handoff`
**Method:** GET
**URL:**
```
{{ $('Fluxo_Variaveis').item.json['CRM-Host'] }}/api/messaging/handoff?conversation_id={{ $json.body.conversation.id }}
```
**Auth:** HTTP Header Auth — credencial do CRM do cliente (`X-Api-Key`)
**Continue on Fail:** true (se o CRM estiver fora, deixa passar para não derrubar o bot)

**Node seguinte:** `IF_Handoff_AI`
**Condição:** `{{ $json.ai_enabled }} == true`
- true → segue para `Filtro_Inicial` atual
- false → `No Operation` (bot não responde)

### 2. Workflow "Agente" — nova tool `transferir_humano`

Substitui a chamada `crm_transferir_humano` (que só movia stage) por uma
chamada que **realmente pausa o bot**.

**Tool node (HTTP Request dentro do AI Agent):**
```yaml
name: transferir_humano
description: |
  Transfere a conversa para atendimento humano IMEDIATAMENTE.
  O bot para de responder até que um humano devolva manualmente no CRM.
  Use quando: cliente pede para falar com pessoa, reclamação, situação
  fora do escopo, ou quando você não souber responder com confiança.
method: POST
url: {{ $('Fluxo_Variaveis').item.json['CRM-Host'] }}/api/messaging/handoff
authentication: httpHeaderAuth (credencial CRM do cliente)
headers:
  Content-Type: application/json
body (JSON):
  {
    "conversation_id": {{ $('Fluxo_Variaveis').item.json.conversation_id }},
    "mode": "human",
    "reason": "{{ $fromAI('reason', 'motivo curto em texto livre') }}",
    "source": "agent"
  }
```

**Atualização do prompt do agente:** trocar referências a
`crm_transferir_humano` por `transferir_humano` e adicionar a regra:
```
Quando usar transferir_humano:
- Cliente pede explicitamente para falar com gerente/humano/atendente
- Reclamação ou insatisfação
- Pergunta fora do seu escopo de conhecimento
- Dúvida complexa que a base de conhecimento não cobre
Depois de chamar transferir_humano, envie UMA mensagem curta avisando
o cliente que vai passar para a equipe, e NÃO responda mais nada.
```

> **Nota:** você pode manter o `crm_transferir_humano` antigo em paralelo para
> continuar movendo o deal de stage. A diferença é que `transferir_humano` é
> quem efetivamente pausa o bot. Idealmente, crie um fluxo no n8n que chama os
> dois em sequência (ou junte as duas ações em uma tool só do lado CRM).

### 3. Workflow "Auto-assign" — simplificar para 1 chamada

Antes, o workflow fazia POST labels + POST assign diretamente no Chatwoot.
Agora, uma única chamada ao `/api/messaging/handoff` cuida de tudo.

**Substituir os 2 nodes HTTP por 1:**

**Name:** `Mark_Human_Handoff`
**Method:** POST
**URL:** `{CRM-Host}/api/messaging/handoff`
**Auth:** HTTP Header Auth — credencial do CRM do cliente
**Body (JSON):**
```json
{
  "conversation_id": {{ $json.conversation.id }},
  "mode": "human",
  "reason": "manual_reply_detected",
  "source": "echo_ig"
}
```

Use `source: "echo_ig"` para respostas vindas do echo do Instagram,
`source: "echo_wa"` para WhatsApp via Evolution API. O `skip_chatwoot` fica
`false` — queremos que o CRM aplique a label também.

## Comportamento esperado (casos de teste)

| Cenário | Resultado esperado |
|---|---|
| Usuário clica "IA Ativa → Atendimento Humano" no CRM | Botão muda instantâneo (<50 ms). Label aplicada no Chatwoot em ~500 ms. Próximo turno do cliente NÃO é respondido pelo bot. |
| Cliente envia "quero falar com atendente" via WhatsApp | Bot detecta intenção, chama `transferir_humano` (reason=client_requested), envia mensagem curta "vou te passar para a equipe" e para. Label aplicada. CRM mostra "Atendimento Humano" em ~1 s (via realtime). |
| Funcionário responde direto pelo Instagram | Echo chega no Chatwoot com `sender:null`. Workflow Auto-assign chama `/api/messaging/handoff` com `source:echo_ig`. Label aplicada. Próximo turno bloqueado. CRM atualiza via realtime. |
| Funcionário clica "Atendimento Humano → IA Ativa" no CRM | Label removida, assignee limpo, `ai_enabled=true`. Próximo turno é processado normalmente pelo bot, com memória Redis preservada. |
| Outro usuário do CRM abre a mesma conversa em outra aba | Vê o mesmo estado em tempo real (via `messaging-links-realtime`). Se o primeiro alternar, o segundo vê a mudança em <1 s. |

## Rollout recomendado

1. Rodar a migration `20260405000000_ai_handoff_state.sql` em cada Supabase de
   cliente (Empório, Wine Vix, Coronel).
2. Deploy do CRM (Vercel) — o adapter e a rota novos funcionam imediatamente
   com `ai_enabled` default `true` para conversas existentes.
3. Atualizar 1 cliente por vez no n8n (sugestão: começar pelo Coronel ou Wine
   Vix, deixar Empório por último).
4. Testar os 5 cenários da tabela acima.
5. Quando os 3 clientes estiverem migrados, remover o fallback de labels no
   adapter (manter só `conversation.ai_enabled` puro).
