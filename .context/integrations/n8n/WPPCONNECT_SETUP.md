# Configuracao do Workflow n8n WPPConnect

Este documento descreve como configurar o workflow n8n para integracao com WPPConnect.

## Pre-requisitos

- n8n rodando em https://coronel-n8n.lagostacriativa.com.br
- WPPConnect Server rodando em https://coronel-wwp.lagostacriativa.com.br
- Redis acessivel no mesmo network Docker
- Sessao WhatsApp `lagostacrm` conectada no WPPConnect

---

## 1. Importar Workflow no n8n

1. Acesse https://coronel-n8n.lagostacriativa.com.br
2. Va em **Workflows** > **Import from File**
3. Selecione o arquivo `[Coronel Picanha] Agente WPPConnect.json`
4. Clique em **Import**

---

## 2. Criar Credenciais no n8n

### 2.1. WPPConnect API (HTTP Header Auth)

1. Va em **Settings** > **Credentials** > **Add Credential**
2. Selecione **HTTP Header Auth**
3. Configure:
   - **Name**: `WPPConnect API`
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer $2b$10$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C`
4. Salve

### 2.2. WPPConnect Secret (HTTP Header Auth)

1. Va em **Settings** > **Credentials** > **Add Credential**
2. Selecione **HTTP Header Auth**
3. Configure:
   - **Name**: `WPPConnect Secret`
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer THISISMYSECURETOKEN`
4. Salve

### 2.3. Coronel CRM (HTTP Header Auth)

1. Va em **Settings** > **Credentials** > **Add Credential**
2. Selecione **HTTP Header Auth**
3. Configure:
   - **Name**: `Coronel CRM`
   - **Header Name**: `x-api-key`
   - **Header Value**: `[SUA_API_KEY_DO_CRM]`
4. Salve

### 2.4. Redis

1. Va em **Settings** > **Credentials** > **Add Credential**
2. Selecione **Redis**
3. Configure:
   - **Name**: `WPPConnect Redis`
   - **Host**: `redis` (nome do container Docker)
   - **Port**: `6379`
   - **Password**: (deixe vazio se nao tiver)
4. Salve

### 2.5. OpenAI

1. Va em **Settings** > **Credentials** > **Add Credential**
2. Selecione **OpenAI**
3. Configure:
   - **Name**: `OpenAi account`
   - **API Key**: `[SUA_OPENAI_API_KEY]`
4. Salve

---

## 3. Vincular Credenciais aos Nodes

Apos criar as credenciais, abra o workflow e vincule cada credencial aos nodes correspondentes:

| Node | Credencial |
|------|------------|
| `Enviar_Resposta_WPPConnect` | WPPConnect API |
| `Persistir_Mensagem_CRM` | WPPConnect Secret |
| `push message buffer` | WPPConnect Redis |
| `get messages buffer` | WPPConnect Redis |
| `delete buffer` | WPPConnect Redis |
| `Memoria_Redis` | WPPConnect Redis |
| `Encontrar_Cliente_CRM` | Coronel CRM |
| `Criar_Contato_CRM` | Coronel CRM |
| `Criar_Deal_CRM` | Coronel CRM |
| `crm_*` (todas as tools) | Coronel CRM |
| `LLM_Agente` | OpenAi account |
| `LLM_Humanizador` | OpenAi account |
| `LLM_Imagem` | OpenAi account |
| `LLM_Doc` | OpenAi account |
| `Transcrever Audio` | OpenAi account |

---

## 4. Configurar Webhook no WPPConnect

### 4.1. Via API (Recomendado)

Execute o seguinte comando para configurar o webhook:

```bash
curl -X POST "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/webhook" \
  -H "Authorization: Bearer \$2b\$10\$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://coronel-n8n.lagostacriativa.com.br/webhook/wppconnect/coronel-picanha",
    "events": ["onmessage", "onack", "onstatechange"]
  }'
```

### 4.2. Via Variaveis de Ambiente (Alternativo)

Se estiver usando Docker Compose, adicione no arquivo `docker-compose.yml`:

```yaml
services:
  wppconnect:
    environment:
      - WEBHOOK_URL=https://coronel-n8n.lagostacriativa.com.br/webhook/wppconnect/coronel-picanha
      - WEBHOOK_EVENTS=onmessage,onack,onstatechange
```

E reinicie o container:

```bash
docker-compose restart wppconnect
```

---

## 5. Ativar Workflow

1. Abra o workflow no n8n
2. Clique no toggle **Active** no canto superior direito
3. O workflow comecara a receber mensagens

---

## 6. Testar Fluxo Completo

### 6.1. Simular Mensagem de Texto

```bash
curl -X POST "https://coronel-n8n.lagostacriativa.com.br/webhook/wppconnect/coronel-picanha" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "onmessage",
    "session": "lagostacrm",
    "data": {
      "id": "true_5527999999999@c.us_TEST123",
      "body": "Ola, gostaria de fazer uma reserva para 4 pessoas",
      "type": "chat",
      "from": "5527999999999@c.us",
      "to": "5527988888888@c.us",
      "author": "5527999999999@c.us",
      "isGroupMsg": false,
      "fromMe": false,
      "sender": {
        "id": "5527999999999@c.us",
        "name": "Joao Silva",
        "pushname": "Joao"
      },
      "timestamp": 1707580800
    }
  }'
```

### 6.2. Simular Audio (PTT)

```bash
curl -X POST "https://coronel-n8n.lagostacriativa.com.br/webhook/wppconnect/coronel-picanha" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "onmessage",
    "session": "lagostacrm",
    "data": {
      "id": "true_5527999999999@c.us_AUDIO123",
      "body": "",
      "type": "ptt",
      "from": "5527999999999@c.us",
      "to": "5527988888888@c.us",
      "isGroupMsg": false,
      "fromMe": false,
      "sender": {
        "id": "5527999999999@c.us",
        "pushname": "Joao"
      },
      "timestamp": 1707580900,
      "mediaUrl": "https://example.com/audio.ogg",
      "mimetype": "audio/ogg; codecs=opus"
    }
  }'
```

### 6.3. Verificar Status da Sessao WPPConnect

```bash
curl "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/status-session" \
  -H "Authorization: Bearer \$2b\$10\$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C"
```

### 6.4. Enviar Mensagem de Teste via WPPConnect

```bash
curl -X POST "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/send-message" \
  -H "Authorization: Bearer \$2b\$10\$QXgCMTHujdn.AdmTLH9w8.CyE6mVLTKXL50fMyJEtp50yGYYnJL4C" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5527999999999",
    "message": "Teste de envio via n8n"
  }'
```

---

## 7. Diferencas do Workflow Chatwoot

### Payload de Entrada

| Campo | Chatwoot | WPPConnect |
|-------|----------|------------|
| ClienteNome | `body.messages[0].sender.name` | `data.sender.pushname` |
| ClienteTelefone | `body.meta.sender.phone_number` | `data.from.replace('@c.us','')` |
| Mensagem | `body.messages[0].content` | `data.body` |
| MessageType | `body.messages[0].attachments[0].file_type` | `data.type` |
| URL-Arquivo | `body.messages[0].attachments[0].data_url` | `data.mediaUrl` |

### Tipos de Mensagem

| Tipo | Chatwoot | WPPConnect |
|------|----------|------------|
| Texto | `text` ou vazio | `chat` |
| Audio | `audio` | `ptt` |
| Imagem | `image` | `image` |
| Documento | `file` | `document` |

### Filtros

| Filtro | Chatwoot | WPPConnect |
|--------|----------|------------|
| Ignorar grupos | `identifier.contains('@g.us')` | `isGroupMsg === true` |
| Ignorar proprias | N/A | `fromMe === true` |
| Ignorar assignee | `meta.assignee.id !== empty` | N/A |
| Ignorar label | `labels.contains('atendimento-humano')` | N/A |

---

## 8. Troubleshooting

### Mensagens nao estao chegando

1. Verifique se o webhook esta configurado no WPPConnect:
   ```bash
   curl "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/webhook"
   ```

2. Verifique se a sessao esta conectada:
   ```bash
   curl "https://coronel-wwp.lagostacriativa.com.br/api/lagostacrm/status-session"
   ```

3. Verifique os logs do n8n para erros

### Respostas nao estao sendo enviadas

1. Verifique se a credencial WPPConnect API esta correta
2. Teste o envio manual com curl (secao 6.4)
3. Verifique os logs de execucao do workflow

### Redis nao conecta

1. Verifique se o container Redis esta no mesmo network
2. Use `redis` como hostname (nao `localhost`)
3. Verifique se a porta 6379 esta acessivel

---

## 9. Proximos Passos

1. Ativar o workflow no n8n
2. Configurar webhook no WPPConnect
3. Testar com mensagem real
4. Monitorar execucoes no n8n
5. Ajustar parametros se necessario (BufferDelay, etc.)
