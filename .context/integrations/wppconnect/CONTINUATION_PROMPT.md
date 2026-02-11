# Prompt de Continuacao - Workflow n8n WPPConnect

Cole este prompt na proxima conversa para continuar a implementacao:

---

## Contexto do Projeto

Estou implementando integracao WhatsApp no LagostaCRM usando WPPConnect Server. A infraestrutura e o codigo ja estao prontos:

### Status Atual
- ✅ Servidor Hetzner com WPPConnect, n8n e Redis rodando
- ✅ WhatsApp conectado (session: `lagostacrm`)
- ✅ Migration SQL aplicada no Supabase (7 tabelas WhatsApp)
- ✅ API Routes Next.js criadas (`/api/whatsapp/*`)
- ✅ Frontend Inbox e Settings criados
- 🔄 **PENDENTE: Workflow n8n para processar mensagens**

### URLs dos Servicos
- WPPConnect: https://coronel-wwp.lagostacriativa.com.br
- n8n: https://coronel-n8n.lagostacriativa.com.br
- LagostaCRM: https://coronelpicanhacrm.vercel.app

### Credenciais
- WPPConnect Session: `lagostacrm`
- WPPConnect Token: `$2b$10$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C`
- Secret Key: `THISISMYSECURETOKEN`

---

## Tarefa Principal

Preciso que voce:

1. **Analise o workflow n8n existente** em `.context/integrations/n8n/[Coronel Picanha] Agente de atendimento.json`

2. **Crie uma nova versao do workflow** que use WPPConnect em vez de Chatwoot

3. **Configure os webhooks no WPPConnect** para apontar para o n8n

---

## Analise do Workflow Existente (Chatwoot)

O workflow atual tem a seguinte estrutura:

### 1. Entrada (Webhook Chatwoot)
```
Webhook POST /webhook/chatwoot/coronel-picanha
  ↓
Filtro_Inicial (ignora grupos, assignee, label atendimento-humano)
  ↓
Fluxo_Variaveis (extrai dados do payload Chatwoot)
```

**Variaveis extraidas do Chatwoot:**
- `ClienteNome` - nome do sender
- `ClienteTelefone` - telefone do sender
- `ClienteEmail` - email do sender
- `CW-ContactID`, `CW-ConversationID`, `CW-MessageID`
- `Mensagem` - conteudo da mensagem
- `MessageType` - tipo (text, audio, image, file)
- `URL-Arquivo` - URL do anexo

### 2. Integracao CRM
```
Encontrar_Cliente_CRM (busca por telefone)
  ↓
Existe_No_CRM? (if)
  ├─ Sim → Set_Contato_Existente
  └─ Nao → Criar_Contato_CRM → Criar_Deal_CRM → Set_Contato_Novo
  ↓
Merge_Contatos
```

### 3. Processamento de Tipos de Mensagem
```
MessageType (switch)
  ├─ text → Msg Texto
  ├─ audio → getAudio → Transcrever Audio (OpenAI Whisper)
  ├─ image → getImage → Analise Imagem (GPT-4 Vision)
  └─ file → getDoc → Extract from File → Analise Doc
  ↓
Merge_Tipos → normalizacao
```

### 4. Buffer de Mensagens (Redis)
```
push message buffer (Redis RPUSH)
  ↓
get messages buffer (Redis LRANGE)
  ↓
Switch_Buffer
  ├─ count < 2 → Wait_Buffer (3s) → loop
  └─ count >= 2 → delete buffer → message_json
```

### 5. Agente de IA
```
message_json (junta mensagens do buffer)
  ↓
Agente de IA (LangChain Agent com OpenAI)
  - Model: gpt-5.2-chat-latest
  - Memory: Redis (por telefone, TTL 186400s)
  - Tools: crm_em_atendimento, crm_aguardando_cliente, etc.
```

### 6. Humanizador e Resposta
```
Humanizador (divide mensagem em chunks naturais)
  ↓
Split Out (separa array de mensagens)
  ↓
Loop Over Items
  ↓
Enviar_Resposta_Chatwoot (POST para API Chatwoot)
  ↓
Wait_Msg (3s entre mensagens)
```

---

## O Que Precisa Mudar para WPPConnect

### 1. Webhook de Entrada
**De:** Chatwoot webhook payload
**Para:** WPPConnect webhook payload

```javascript
// Payload WPPConnect onMessage
{
  "event": "onmessage",
  "session": "lagostacrm",
  "data": {
    "id": "true_5527999999999@c.us_ABC123",
    "body": "Ola, quero fazer uma reserva",
    "type": "chat", // ou "ptt", "image", "document"
    "from": "5527999999999@c.us",
    "to": "5527988888888@c.us",
    "author": "5527999999999@c.us",
    "isGroupMsg": false,
    "sender": {
      "id": "5527999999999@c.us",
      "name": "Joao Silva",
      "pushname": "Joao"
    },
    "timestamp": 1707580800,
    "mediaUrl": "https://...", // se tiver midia
    "mimetype": "audio/ogg; codecs=opus" // se tiver midia
  }
}
```

### 2. Extracao de Variaveis
Adaptar `Fluxo_Variaveis` para o formato WPPConnect:

| Variavel | Chatwoot | WPPConnect |
|----------|----------|------------|
| ClienteNome | `body.messages[0].sender.name` | `data.sender.pushname` |
| ClienteTelefone | `body.meta.sender.phone_number` | `data.from.replace('@c.us','')` |
| Mensagem | `body.messages[0].content` | `data.body` |
| MessageType | `body.messages[0].attachments[0].file_type` | `data.type` |
| URL-Arquivo | `body.messages[0].attachments[0].data_url` | `data.mediaUrl` |

### 3. Filtros
Adaptar `Filtro_Inicial`:
- Ignorar mensagens de grupo: `data.isGroupMsg === false`
- Ignorar mensagens proprias: `data.fromMe === false`

### 4. Envio de Resposta
**De:** API Chatwoot
**Para:** API WPPConnect

```
POST https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/send-message
Headers:
  Authorization: Bearer $2b$10$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C
Body:
{
  "phone": "5527999999999",
  "message": "Ola! Aqui e o Coronel..."
}
```

### 5. Persistencia no LagostaCRM
Adicionar chamada ao webhook do CRM para persistir mensagens:

```
POST https://coronelpicanhacrm.vercel.app/api/whatsapp/webhook
Headers:
  Authorization: Bearer THISISMYSECURETOKEN
Body:
{
  "event": "message.received",
  "session_name": "lagostacrm",
  "organization_id": "ORG_ID",
  "data": {
    "wpp_message_id": "...",
    "conversation_id": "...",
    "content": "...",
    "sender_jid": "...",
    "sender_name": "...",
    "sender_phone": "..."
  }
}
```

---

## Endpoints WPPConnect Relevantes

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/{session}/send-message` | POST | Enviar texto |
| `/api/{session}/send-image` | POST | Enviar imagem |
| `/api/{session}/send-file-base64` | POST | Enviar arquivo |
| `/api/{session}/all-messages-in-chat/{phone}` | GET | Historico |
| `/api/{session}/status-session` | GET | Status da sessao |

---

## Fluxo Esperado

```
WhatsApp
   ↓
WPPConnect (webhook onMessage)
   ↓
n8n Webhook
   ↓
Filtro (ignora grupos/proprias)
   ↓
Extracao de variaveis
   ↓
CRM: Busca/Cria contato e deal
   ↓
Processa tipo (text/audio/image/doc)
   ↓
Buffer Redis (agrupa mensagens)
   ↓
Agente IA (Claude/OpenAI)
   ↓
Humanizador (divide resposta)
   ↓
WPPConnect send-message (resposta)
   ↓
LagostaCRM webhook (persistencia)
```

---

## Entregaveis Esperados

1. **Novo arquivo JSON do workflow n8n** em `.context/integrations/n8n/[Coronel Picanha] Agente WPPConnect.json`

2. **Instrucoes de configuracao** para:
   - Importar workflow no n8n
   - Configurar credenciais (WPPConnect, Redis, OpenAI, CRM)
   - Configurar webhooks no WPPConnect

3. **Comandos curl para teste** do fluxo completo

---

## Arquivos de Referencia

- Workflow atual (Chatwoot): `.context/integrations/n8n/[Coronel Picanha] Agente de atendimento.json`
- Plano de implementacao: `.context/integrations/wppconnect/IMPLEMENTATION_PLAN.md`
- Status atual: `.context/integrations/wppconnect/IMPLEMENTATION_STATUS.md`
- Schema SQL: `.context/integrations/wppconnect/schema.sql`
- Webhook route: `app/api/whatsapp/webhook/route.ts`

---

## Observacoes Importantes

- O WPPConnect usa `THISISMYSECURETOKEN` como secret padrao
- Os webhooks do WPPConnect podem ser configurados via API ou env vars
- O n8n ja esta rodando e acessivel em https://coronel-n8n.lagostacriativa.com.br
- O workflow deve manter compatibilidade com a IA existente (OpenAI)
- O Redis do servidor pode ser usado para buffer e memoria do agente

---

## Credenciais Necessarias no n8n

1. **WPPConnect API** (HTTP Header Auth)
   - Header: `Authorization`
   - Value: `Bearer $2b$10$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C`

2. **LagostaCRM API** (HTTP Header Auth)
   - Header: `x-api-key`
   - Value: (usar a key existente do Coronel CRM)

3. **Redis** (para buffer e memoria)
   - Host: `redis` (nome do container no mesmo network)
   - Port: `6379`

4. **OpenAI** (para IA)
   - API Key: (usar a key existente)
