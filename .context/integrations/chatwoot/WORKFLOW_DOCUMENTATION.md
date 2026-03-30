# Documentacao do Workflow - Agente de Atendimento Chatwoot

> **Versao:** 1.0
> **Ultima atualizacao:** 2026-02-13
> **Arquivo:** `[Coronel Picanha] Agente de atendimento.json`

---

## Visao Geral

Este workflow automatiza o atendimento ao cliente via WhatsApp usando:
- **Chatwoot** como plataforma de mensagens (conectado ao Evolution API)
- **n8n** como orquestrador de automacao
- **LagostaCRM** como CRM para gestao de contatos e deals
- **OpenAI GPT** como agente de IA para respostas inteligentes
- **Redis** para memoria de conversacao

---

## Arquitetura

```
+-------------------------------------------------------------------+
|                     FLUXO DE ATENDIMENTO                           |
+-------------------------------------------------------------------+
|                                                                    |
|  Cliente envia mensagem no WhatsApp                                |
|       |                                                            |
|       v                                                            |
|  Evolution API recebe mensagem                                     |
|       |                                                            |
|       v                                                            |
|  Chatwoot processa e dispara webhook                               |
|       |                                                            |
|       v                                                            |
|  n8n Webhook recebe payload                                        |
|       |                                                            |
|       v                                                            |
|  Filtro_Inicial (message_type === "incoming")                      |
|       |                                                            |
|       v                                                            |
|  Fluxo_Variaveis (extrai dados do payload)                         |
|       |                                                            |
|       v                                                            |
|  Encontrar_Cliente_CRM (busca contato no CRM)                      |
|       |                                                            |
|       +-- Existe? --+                                              |
|       |             |                                              |
|      Sim           Nao                                             |
|       |             |                                              |
|       v             v                                              |
|  Set_Contato    Criar_Contato_CRM                                  |
|  _Existente          |                                             |
|       |              v                                             |
|       v         Criar_Deal_CRM                                     |
|  Garantir_Deal       |                                             |
|  _Existente          v                                             |
|       |         Set_Contato_Novo                                   |
|       v              |                                             |
|  Restaurar_Dados     |                                             |
|  _Contato            |                                             |
|       |              |                                             |
|       +------+-------+                                             |
|              |                                                     |
|              v                                                     |
|        Merge_Contatos                                              |
|              |                                                     |
|              v                                                     |
|        MessageType (switch por tipo de midia)                      |
|              |                                                     |
|              +-- texto/audio/imagem/pdf                            |
|              |                                                     |
|              v                                                     |
|        Buffer de Mensagens (agrupa mensagens rapidas)              |
|              |                                                     |
|              v                                                     |
|        Agente de IA (processa e gera resposta)                     |
|              |                                                     |
|              v                                                     |
|        Enviar_Resposta_Chatwoot                                    |
|                                                                    |
+-------------------------------------------------------------------+
```

---

## Nos do Workflow

### 1. Webhook (Gatilho)

**Tipo:** `n8n-nodes-base.webhook`
**Path:** `/webhook/agente/atendimento`
**Metodo:** POST

Recebe webhooks do Chatwoot quando mensagens sao enviadas/recebidas.

**Payload esperado do Chatwoot:**
```json
{
  "event": "message_created",
  "message_type": "incoming",
  "content": "texto da mensagem",
  "sender": {
    "name": "Nome do Cliente",
    "phone_number": "5527999999999",
    "email": "email@example.com",
    "identifier": "5527999999999@s.whatsapp.net"
  },
  "conversation": {
    "id": 123,
    "contact_inbox": {
      "contact_id": 456
    },
    "labels": [],
    "meta": {
      "assignee": null
    }
  },
  "inbox": {
    "id": 1
  },
  "account": {
    "id": 1
  },
  "attachments": []
}
```

---

### 2. Filtro_Inicial

**Tipo:** `n8n-nodes-base.filter`

Filtra mensagens para processar apenas as relevantes:

| Condicao | Descricao |
|----------|-----------|
| `message_type === "incoming"` | Apenas mensagens do cliente (nao respostas do bot) |
| `sender.identifier not contains "@g.us"` | Ignora mensagens de grupo |
| `conversation.meta.assignee.id is empty` | Ignora se ha atendente humano |
| `conversation.labels not contains "atendimento-humano"` | Ignora se etiqueta de atendimento humano |

**Importante:** A verificacao `message_type === "incoming"` evita que o bot processe suas proprias respostas (que vem como `message_type: "outgoing"`).

---

### 3. Fluxo_Variaveis

**Tipo:** `n8n-nodes-base.set`

Extrai e normaliza dados do payload do Chatwoot:

| Variavel | Expressao | Descricao |
|----------|-----------|-----------|
| `ClienteNome` | `body.sender?.name` | Nome do cliente (capitalizado) |
| `ClienteTelefone` | `body.sender?.phone_number` | Telefone do cliente |
| `ClienteEmail` | `body.sender?.email` | Email do cliente |
| `CRM-Host` | `https://coronelpicanhacrm.vercel.app` | URL do CRM |
| `CRM-BoardKey` | `suporte-ao-cliente-restaurante` | Board do Kanban |
| `CW-Host` | `https://chatwoot-coronel.lagostacriativa.com.br` | URL do Chatwoot |
| `CW-ContactID` | `body.conversation?.contact_inbox?.contact_id` | ID do contato no Chatwoot |
| `CW-ConversationID` | `body.conversation?.id` | ID da conversa |
| `CW-MessageID` | `body.id` | ID da mensagem |
| `CW-Inbox` | `body.inbox?.id` | ID do inbox |
| `CW-Account` | `body.account?.id` | ID da conta |
| `Mensagem` | `body.content` | Conteudo da mensagem |
| `MessagemTime` | `body.created_at` | Timestamp da mensagem |
| `MessageType` | `body.attachments?.[0]?.file_type` | Tipo de midia |
| `URL-Arquivo` | `body.attachments?.[0]?.data_url` | URL do arquivo anexo |
| `BufferDelay` | `3` | Segundos para aguardar mais mensagens |
| `CW-EtiquetaRH` | `atendimento-humano` | Label para escalar atendimento |

---

### 4. Encontrar_Cliente_CRM

**Tipo:** `n8n-nodes-base.httpRequest`
**Metodo:** GET
**URL:** `{CRM-Host}/api/public/v1/contacts?phone={ClienteTelefone}&limit=1`

Busca o contato no CRM pelo numero de telefone.

---

### 5. Existe_No_CRM?

**Tipo:** `n8n-nodes-base.if`

Verifica se o contato foi encontrado no CRM:
- **True:** Contato existe → `Set_Contato_Existente`
- **False:** Contato nao existe → `Criar_Contato_CRM`

---

### 6. Criar_Contato_CRM (caminho contato novo)

**Tipo:** `n8n-nodes-base.httpRequest`
**Metodo:** POST
**URL:** `{CRM-Host}/api/public/v1/contacts`

```json
{
  "name": "{{ ClienteNome }}",
  "phone": "{{ ClienteTelefone }}",
  "email": "{{ ClienteEmail }}",
  "source": "WHATSAPP",
  "stage": "LEAD",
  "status": "ACTIVE"
}
```

---

### 7. Criar_Deal_CRM (caminho contato novo)

**Tipo:** `n8n-nodes-base.httpRequest`
**Metodo:** POST
**URL:** `{CRM-Host}/api/public/v1/deals`

```json
{
  "title": "WhatsApp - {{ ClienteNome }}",
  "value": 0,
  "board_key": "{{ CRM-BoardKey }}",
  "contact_id": "{{ contact_id }}"
}
```

---

### 8. Set_Contato_Existente (caminho contato existente)

**Tipo:** `n8n-nodes-base.set`

Define variaveis do contato encontrado:
- `contact_id`
- `contact_name`
- `contact_phone`
- `contact_email`

---

### 9. Garantir_Deal_Existente (caminho contato existente)

**Tipo:** `n8n-nodes-base.httpRequest`
**Metodo:** POST
**URL:** `{CRM-Host}/api/public/v1/deals`

Garante que existe um Deal aberto para o contato. O endpoint POST /deals tem logica de "find or create":
- Se ja existe deal aberto → retorna o existente (`action: "existing"`)
- Se nao existe → cria novo (`action: "created"`)

```json
{
  "title": "WhatsApp - {{ ClienteNome }}",
  "value": 0,
  "board_key": "{{ CRM-BoardKey }}",
  "contact_id": "{{ contact_id }}"
}
```

---

### 10. Restaurar_Dados_Contato (caminho contato existente)

**Tipo:** `n8n-nodes-base.set`

Restaura os dados do contato apos a chamada HTTP do deal (que sobrescreve o output):

| Campo | Expressao |
|-------|-----------|
| `contact_id` | `$('Set_Contato_Existente').item.json.contact_id` |
| `contact_name` | `$('Set_Contato_Existente').item.json.contact_name` |
| `contact_phone` | `$('Set_Contato_Existente').item.json.contact_phone` |
| `contact_email` | `$('Set_Contato_Existente').item.json.contact_email` |

---

### 11. Merge_Contatos

**Tipo:** `n8n-nodes-base.merge`

Combina os dois caminhos (contato novo e existente) em um unico fluxo.

---

### 12. MessageType (Switch)

**Tipo:** `n8n-nodes-base.switch`

Roteia por tipo de midia:
- **texto:** Mensagem de texto simples
- **audio:** Mensagem de audio (transcrito via Whisper)
- **imagem:** Imagem (analisada via GPT Vision)
- **pdf:** Documento PDF (extraido texto)

---

### 13. Buffer de Mensagens

Agrupa mensagens enviadas em sequencia rapida para evitar respostas fragmentadas.

**Nos envolvidos:**
- `get messages buffer` - Busca mensagens pendentes no Redis
- `push message buffer` - Adiciona mensagem ao buffer
- `Switch_Buffer` - Verifica se deve aguardar mais mensagens
- `Wait_Buffer` - Aguarda X segundos (BufferDelay)
- `delete buffer` - Limpa buffer apos processar
- `normalizacao` - Concatena mensagens do buffer

**Logica:**
1. Mensagem chega → adiciona ao buffer Redis
2. Verifica se BufferDelay > 0
3. Se sim → aguarda e verifica novamente
4. Se nao → processa todas as mensagens acumuladas

---

### 14. Agente de IA

**Tipo:** `@n8n/n8n-nodes-langchain.agent`

Agente de IA que processa mensagens e gera respostas.

**Componentes conectados:**
- **LLM:** OpenAI GPT (gpt-5.2-chat-latest)
- **Memory:** Redis Chat Memory (sessao por telefone)
- **Tools:** Tools do CRM para movimentacao no Kanban

**Tools disponiveis:**

| Tool | Descricao |
|------|-----------|
| `crm_em_atendimento` | Move deal para "Em Atendimento" |
| `crm_aguardando_cliente` | Move deal para "Aguardando Cliente" |
| `crm_info_fornecidas` | Move deal para "Informacoes Fornecidas" |
| `crm_canal_oficial` | Move deal para "Direcionado para Canal Oficial" |
| `crm_finalizado` | Move deal para "Finalizado" |

---

### 15. Enviar_Resposta_Chatwoot

**Tipo:** `n8n-nodes-base.httpRequest`
**Metodo:** POST
**URL:** `{CW-Host}/api/v1/accounts/{CW-Account}/conversations/{CW-ConversationID}/messages`

Envia a resposta do agente de volta para o Chatwoot.

---

## Integracao com CRM

### Etapas do Kanban (Board: suporte-ao-cliente-restaurante)

| # | Etapa | Cor | Descricao |
|---|-------|-----|-----------|
| 1 | Nova Interacao | Cinza | Deal recem criado |
| 2 | Em Atendimento | Verde | Atendimento em andamento |
| 3 | Aguardando Cliente | Amarelo | Esperando resposta do cliente |
| 4 | Informacoes Fornecidas | Azul | Cliente enviou informacoes |
| 5 | Direcionado para Canal Oficial | Roxo | Escalado para atendimento humano |
| 6 | Finalizado | Cinza escuro | Atendimento concluido |

### Sincronizacao de Labels WhatsApp

Quando um deal muda de etapa, um trigger PostgreSQL (`trg_add_stage_tag_to_deal`) automaticamente:
1. Adiciona tag da etapa ao deal
2. Dispara webhook para workflow de sincronizacao de labels
3. Label correspondente e aplicada no contato do WhatsApp

---

## Configuracoes Necessarias

### Credenciais n8n

| Nome | Tipo | Uso |
|------|------|-----|
| `Coronel CRM` | HTTP Header Auth | Autenticacao na API do CRM |
| `OpenAi account 2` | OpenAI API | Acesso ao GPT |
| `Redis Coronel` | Redis | Memoria de conversacao |
| `Chatwoot API` | HTTP Header Auth | API do Chatwoot |

### Variaveis de Ambiente

```env
# CRM
CRM_HOST=https://coronelpicanhacrm.vercel.app
CRM_API_KEY=<api-key>

# Chatwoot
CHATWOOT_HOST=https://chatwoot-coronel.lagostacriativa.com.br
CHATWOOT_API_KEY=<api-key>

# Redis
REDIS_HOST=n8n_redis
REDIS_PASSWORD=<password>
```

---

## Troubleshooting

### Problema: Duas execucoes por mensagem

**Causa:** Chatwoot envia webhooks para `incoming` (cliente) e `outgoing` (bot).

**Solucao:** Filtro `message_type === "incoming"` no `Filtro_Inicial`.

---

### Problema: "Deal not found for this identity"

**Causa:** Contato existe no CRM mas nao tem Deal aberto.

**Solucao:** No `Garantir_Deal_Existente` garante que sempre existe um Deal.

---

### Problema: ClienteTelefone null no Redis

**Causa:** Payload do Chatwoot diferente do esperado.

**Solucao:** Verificar estrutura do payload e ajustar expressoes em `Fluxo_Variaveis`.

---

### Problema: Mensagens nao chegam no workflow

**Causa:** Automacao do Chatwoot nao configurada corretamente.

**Verificar:**
1. Automacao ativa no Chatwoot
2. URL do webhook correta
3. Evento `message_created` selecionado
4. Condicao de inbox correta

---

## URLs dos Servicos

| Servico | URL |
|---------|-----|
| LagostaCRM | https://coronelpicanhacrm.vercel.app |
| Chatwoot | https://chatwoot-coronel.lagostacriativa.com.br |
| n8n | https://n8n-coronel.lagostacriativa.com.br |
| Evolution API | https://evolution-coronel.lagostacriativa.com.br |

---

## Historico de Alteracoes

| Data | Versao | Alteracao |
|------|--------|-----------|
| 2026-02-13 | 1.0 | Versao inicial com Chatwoot + Evolution API |

