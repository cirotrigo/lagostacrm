# Plano de Implementação - Mensageria WPPConnect

> **Objetivo**: Implementar sistema de mensageria integrado ao LagostaCRM usando WPPConnect Server, substituindo a dependência do Chatwoot para comunicação direta com WhatsApp.

---

## 1. Visão Geral da Arquitetura

### Arquitetura Atual (Chatwoot)
```
WhatsApp ──► Chatwoot ──► n8n ──► LagostaCRM API
                              ◄──
```

### Arquitetura Proposta (WPPConnect)
```
                    ┌─────────────────────────────────────┐
                    │           LagostaCRM                │
                    │  ┌─────────────────────────────┐   │
WhatsApp ◄─────────►│  │   WPPConnect Server        │   │
                    │  │   (Docker Container)       │   │
                    │  └──────────┬──────────────────┘   │
                    │             │ Webhooks             │
                    │             ▼                      │
                    │  ┌──────────────────────────────┐   │
                    │  │         n8n                  │   │
                    │  │   (Orquestração/IA)          │   │
                    │  └──────────┬───────────────────┘   │
                    │             │ API Calls            │
                    │             ▼                      │
                    │  ┌──────────────────────────────┐   │
                    │  │    Supabase (Backend)       │   │
                    │  │  - Conversas                │   │
                    │  │  - Mensagens                │   │
                    │  │  - Labels/Tags Sync         │   │
                    │  └──────────────────────────────┘   │
                    └─────────────────────────────────────┘
```

### Benefícios da Nova Arquitetura
- **Controle total**: Mensagens armazenadas no próprio banco
- **Menos dependências**: Remove Chatwoot como intermediário
- **Custo reduzido**: WPPConnect é gratuito e open-source
- **Sincronização de labels**: Etiquetas WhatsApp ↔ Tags CRM
- **Histórico completo**: Todas as conversas no CRM

---

## 2. Componentes a Implementar

### 2.1 Infraestrutura (DevOps)

| Componente | Tecnologia | Hospedagem |
|------------|------------|------------|
| WPPConnect Server | Node.js + Puppeteer | Hetzner CPX22 (AMD x64) |
| Redis | Cache de sessões | Mesmo servidor |
| n8n | Orquestração | Mesmo servidor (migrado do CAX21) |

> **⚠️ Importante**: Não usar servidores ARM (CAX) - Puppeteer/Chromium não tem suporte oficial para ARM64. A imagem Docker `wppconnect/server-cli` é apenas amd64.

**Servidor recomendado: Hetzner CPX22**
- 4GB RAM
- 2 vCPU AMD
- 80GB SSD
- ~€6,49/mês

> **Nota**: Sessões são persistidas via volumes Docker (`tokens/`, `userDataDir/`). MongoDB não é necessário.

### 2.2 Backend (Supabase + Next.js API Routes + n8n)

A arquitetura centraliza toda lógica de orquestração no n8n, eliminando Edge Functions.

| Componente | Responsável | Função |
|------------|-------------|--------|
| Next.js API Routes (`/api/whatsapp/*`) | Backend | Proxy para WPPConnect (sessão/envio) e leitura no Supabase |
| n8n Webhook Receiver (`POST /webhook/wppconnect`) | n8n | Receber TODOS os eventos do WPPConnect |
| n8n Workflows | n8n | Orquestração, IA, labels, CRM e persistência no Supabase |

**Justificativa**: n8n é o orquestrador padrão do projeto, com visual debug e domínio técnico do time. Edge Functions seriam duplicação desnecessária.

#### Fluxo de Recebimento
```
WhatsApp → WPPConnect Server (webhook) → n8n → Supabase
```

#### Fluxo de Envio
```
Frontend → Next.js API Route → n8n → WPPConnect API → WhatsApp
```

#### Fluxo de Sessão (QR Code / Status)
```
Frontend → Next.js API Route → WPPConnect API (direto)
```

#### Novas Tabelas (ver schema.sql)
- `whatsapp_sessions` - Sessões conectadas
- `whatsapp_conversations` - Conversas
- `whatsapp_messages` - Mensagens
- `whatsapp_label_sync` - Mapeamento labels ↔ tags
- `whatsapp_conversation_labels` - Labels aplicadas
- `whatsapp_webhook_events` - Log de eventos
- `whatsapp_message_templates` - Templates de mensagem

### 2.3 Frontend (Next.js)

#### Novos Componentes

```
features/
└── messaging/
    ├── components/
    │   ├── WhatsAppSessionManager.tsx   # QR Code e status da sessão
    │   ├── ConversationList.tsx         # Lista de conversas
    │   ├── ConversationView.tsx         # Visualização de chat
    │   ├── MessageComposer.tsx          # Envio de mensagens
    │   ├── MessageBubble.tsx            # Balão de mensagem
    │   ├── LabelSyncManager.tsx         # Sincronização de etiquetas
    │   └── MediaPreview.tsx             # Preview de mídia
    ├── hooks/
    │   ├── useWhatsAppSession.ts
    │   ├── useConversations.ts
    │   ├── useMessages.ts
    │   └── useLabelSync.ts
    └── types/
        └── messaging.ts
```

#### Páginas

| Rota | Descrição |
|------|-----------|
| `/settings/whatsapp` | Configuração de sessão WhatsApp |
| `/inbox` | Central de mensagens |
| `/inbox/[conversationId]` | Visualização de conversa |

#### Realtime (Supabase)

Subscriptions necessárias para UX em tempo real:

| Evento | Tabela | Uso |
|--------|--------|-----|
| `INSERT` | `whatsapp_messages` | Novas mensagens em tempo real |
| `UPDATE` | `whatsapp_messages` | Status de entrega/leitura |
| `UPDATE` | `whatsapp_conversations` | Reordenar inbox |
| `UPDATE` | `whatsapp_sessions` | Status de conexão |

**Exemplo de hook:**

```typescript
useEffect(() => {
  const channel = supabase
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      payload => setMessages(prev => [...prev, payload.new])
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [conversationId]);
```

> **Importante**: Testar RLS + Realtime juntos para garantir isolamento por organização.

### 2.4 Integração n8n

#### Fluxos Necessários

1. **Webhook Receiver** - Recebe eventos do WPPConnect
2. **Message Router** - Roteia mensagens para IA ou humano
3. **AI Agent** - Processa mensagens com IA
4. **Label Sync** - Sincroniza etiquetas bidirecionalmente
5. **Deal Updater** - Atualiza deals baseado em conversas
6. **Health Check** - Reconexão automática de sessão

---

## 3. Fluxo de Dados

### 3.1 Recebimento de Mensagem

```
1. WhatsApp → WPPConnect Server (webhook: onMessage)
2. WPPConnect → n8n (HTTP POST)
3. n8n verifica se conversa existe no CRM
   ├── SIM → Adiciona mensagem à conversa
   └── NÃO → Cria contato + conversa + deal
4. n8n verifica labels do chat no WhatsApp
   └── Sincroniza com tags do deal no CRM
5. n8n roteia para IA ou humano (baseado em ai_enabled da conversa)
6. Resposta é enviada via WPPConnect
```

### 3.2 Envio de Mensagem do CRM

```
1. Usuário compõe mensagem no CRM
2. Frontend chama Next.js API Route `/api/whatsapp/send`
3. API Route envia para n8n
4. n8n chama WPPConnect Server API
5. WPPConnect envia para WhatsApp
6. Webhook de status (onAck) atualiza mensagem no CRM
```

### 3.3 Sincronização de Labels

> **Nota**: O evento `onChatLabel` do WhatsApp Web não é 100% confiável. Usamos webhook como trigger principal + polling como reconciliação.

#### WhatsApp → CRM (via webhook + polling)
```
Trigger: Webhook onChatLabel
1. WPPConnect detecta label adicionada
2. Webhook envia para n8n
3. n8n busca mapeamento em whatsapp_label_sync
4. n8n adiciona tag correspondente ao deal

Reconciliação: Polling a cada 5 minutos
1. Cron n8n dispara
2. GET /api/{session}/all-labels
3. Para cada label → listChats({ withLabels })
4. Compara com whatsapp_label_sync
5. Atualiza CRM se houver divergência
```

#### CRM → WhatsApp
```
1. Usuário adiciona tag ao deal
2. Webhook outbound dispara (database trigger ou n8n poll)
3. n8n busca mapeamento em whatsapp_label_sync
4. n8n chama WPPConnect API addOrRemoveLabels
```

#### CRM como Master

O CRM é a **fonte de verdade** para classificação de deals. Em caso de conflito bidirecional, a tag do CRM prevalece.

Valores de `sync_direction`:
- `to_wpp`: CRM → WhatsApp (recomendado para produção)
- `to_crm`: WhatsApp → CRM (polling)
- `both`: Bidirecional com CRM como master em conflitos
- `none`: Sincronização desativada

---

## 4. Configuração WPPConnect Server

### 4.1 Deploy via EasyPanel

O EasyPanel gerencia os containers com interface visual, SSL automático e proxy reverso integrado.

#### Serviços a criar no EasyPanel

| App | Imagem | Porta | Domínio |
|-----|--------|-------|---------|
| n8n | `n8nio/n8n:latest` | 5678 | `n8n.seudominio.com` |
| wppconnect | `wppconnect/server-cli:latest` | 21465 | `wpp.seudominio.com` |
| redis | `redis:alpine` | 6379 | (interno) |

#### Configuração do WPPConnect no EasyPanel

**Variáveis de Ambiente:**
```env
SECRET_KEY=sua-chave-secreta-32-caracteres
WEBHOOK_URL=https://n8n.seudominio.com/webhook/wppconnect/coronel-picanha
WEBHOOK_ALLUNREADMSG=true
WEBHOOK_ONMESSAGE=true
WEBHOOK_ONACK=true
WEBHOOK_ONCHATSTATE=true
WEBHOOK_ONPRESENCE=true
WEBHOOK_ONLABEL=true
```

**Volumes (Mounts):**
```
/usr/src/server-cli/tokens    → wppconnect_tokens
/usr/src/server-cli/userDataDir → wppconnect_userdata
```

> **⚠️ Path correto**: A imagem `wppconnect/server-cli` usa `/usr/src/server-cli/`, não `/usr/src/app/`.

#### Configuração do n8n no EasyPanel

**Variáveis de Ambiente:**
```env
N8N_HOST=n8n.seudominio.com
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://n8n.seudominio.com
GENERIC_TIMEZONE=America/Sao_Paulo
```

**Volumes:**
```
/home/node/.n8n → n8n_data
```

#### URLs de comunicação
- **n8n → WPPConnect**: `https://wpp.seudominio.com` (via domínio público)
- **WPPConnect → n8n**: `https://n8n.seudominio.com/webhook/wppconnect/coronel-picanha`
- **Vercel → WPPConnect**: `https://wpp.seudominio.com` (SSL pelo EasyPanel)

#### docker-compose.yml (Referência)

> Este arquivo serve como **referência** para configuração no EasyPanel, não é executado diretamente.

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - GENERIC_TIMEZONE=America/Sao_Paulo
    volumes:
      - n8n_data:/home/node/.n8n

  wppconnect:
    image: wppconnect/server-cli:latest
    container_name: wppconnect-server
    restart: unless-stopped
    ports:
      - "21465:21465"
    environment:
      - SECRET_KEY=${WPPCONNECT_SECRET_KEY}
      - WEBHOOK_URL=https://n8n.seudominio.com/webhook/wppconnect/coronel-picanha
      - WEBHOOK_ALLUNREADMSG=true
      - WEBHOOK_ONMESSAGE=true
      - WEBHOOK_ONACK=true
      - WEBHOOK_ONCHATSTATE=true
      - WEBHOOK_ONPRESENCE=true
      - WEBHOOK_ONLABEL=true
    volumes:
      - wppconnect_tokens:/usr/src/server-cli/tokens
      - wppconnect_userdata:/usr/src/server-cli/userDataDir
    depends_on:
      - redis

  redis:
    image: redis:alpine
    container_name: redis
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  n8n_data:
  wppconnect_tokens:
  wppconnect_userdata:
  redis_data:
```

### 4.2 Variáveis de Ambiente (.env)

```env
# WPPConnect Server
WPPCONNECT_HOST=https://seu-servidor.com
WPPCONNECT_SECRET_KEY=sua-chave-secreta-aqui
WPPCONNECT_SESSION_NAME=lagostacrm-main

# Webhooks
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/wppconnect

# LagostaCRM
LAGOSTACRM_URL=https://coronelpicanhacrm.vercel.app
LAGOSTACRM_API_KEY=sua-api-key
```

### 4.3 Reconexão Automática

Sessões WhatsApp podem desconectar por diversos motivos. É crítico implementar reconexão automática.

#### Requisitos

- Health check a cada **2 minutos**: `GET /api/{session}/status-session`
- Se status ≠ `CONNECTED`: `POST /api/{session}/start-session`
- Após **3 tentativas** consecutivas falhas (5 minutos offline): enviar alerta (Email ou Telegram)

> **Nota**: A flag `--startAllSession` do WPPConnect só funciona no restart do container, não reconecta sessões perdidas em runtime.

#### Fluxo n8n - Health Check

```
Cron (2 min)
  → HTTP GET /api/{session}/status-session
  → IF status = "CONNECTED" → noop
  → ELSE
      → POST /api/{session}/start-session
      → Wait 30s
      → HTTP GET status-session (recheck)
      → IF status != "CONNECTED" após 3 tentativas
          → Enviar alerta (Email/Telegram)
          → Atualizar whatsapp_sessions.status = 'error'
```

---

## 5. Endpoints WPPConnect Essenciais

### Gerenciamento de Sessão

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/{session}/start-session` | Inicia sessão (gera QR) |
| GET | `/api/{session}/status-session` | Status da sessão |
| POST | `/api/{session}/close-session` | Encerra sessão |
| GET | `/api/{session}/qrcode-session` | Obtém QR Code |

### Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/{session}/send-message` | Envia texto |
| POST | `/api/{session}/send-image` | Envia imagem |
| POST | `/api/{session}/send-file` | Envia arquivo |
| POST | `/api/{session}/send-audio` | Envia áudio |

### Labels (Etiquetas)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/{session}/all-labels` | Lista todas as labels |
| POST | `/api/{session}/add-new-label` | Cria nova label |
| POST | `/api/{session}/add-or-remove-labels` | Aplica/remove labels |
| GET | `/api/{session}/get-chat-labels/{chatId}` | Labels de um chat |

### Contatos e Chats

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/{session}/all-contacts` | Lista contatos |
| GET | `/api/{session}/all-chats` | Lista chats |
| GET | `/api/{session}/chat-messages/{chatId}` | Mensagens de um chat |

---

## 6. Estratégia de Mídia

### Storage

- **Serviço**: Supabase Storage
- **Bucket**: `whatsapp-media`
- **Organização**: `{org_id}/{conversation_id}/{arquivo}`

### Fluxo de Mídia Recebida

```
1. WPPConnect recebe mídia (autoDownload: true no webhook)
2. n8n faz download do arquivo
3. n8n faz upload para Supabase Storage
4. n8n salva URL pública em whatsapp_messages.media_url
```

### Configuração

```sql
-- Criar bucket (executar uma vez)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);
```

### Limites

- **Tamanho máximo**: 25MB por arquivo
- **Retenção**: 90 dias (configurável)
- **Upload**: Apenas via `service_role` (n8n)

---

## 7. Fases de Implementação

### Fase 0: Migração de Infraestrutura (1 dia)
- [ ] Criar servidor CPX22 na Hetzner (AMD x64, ~€6,49/mês)
- [ ] Instalar EasyPanel: `curl -sSL https://get.easypanel.io | sh`
- [ ] Acessar EasyPanel via `http://IP:3000` e criar conta admin
- [ ] Criar app "n8n" no EasyPanel com a configuração da seção 4.1
- [ ] Migrar dados do n8n do CAX21 (backup/restore do volume `/home/node/.n8n`)
- [ ] Configurar domínio `n8n.seudominio.com` no EasyPanel (SSL automático)
- [ ] Validar n8n funcionando no novo servidor
- [ ] Atualizar DNS para novo servidor
- [ ] Desligar CAX21 após validação

### Fase 1: Infraestrutura WPPConnect (1-2 dias)
- [ ] Criar app "redis" no EasyPanel (imagem `redis:alpine`)
- [ ] Criar app "wppconnect" no EasyPanel com configuração da seção 4.1
- [ ] Configurar volumes corretos (`/usr/src/server-cli/tokens` e `/userDataDir`)
- [ ] Configurar domínio `wpp.seudominio.com` (SSL automático)
- [ ] Testar API: `curl https://wpp.seudominio.com/api/health`
- [ ] Iniciar sessão e escanear QR Code

### Fase 2: Backend - Tabelas (1 dia)
- [ ] Criar migration com novas tabelas
- [ ] Criar índices necessários
- [ ] Configurar RLS (Row Level Security)
- [ ] Testar inserções básicas
- [ ] Criar bucket `whatsapp-media` no Supabase Storage

### Fase 3: Backend - API Routes (1-2 dias)
- [ ] Implementar `/api/whatsapp/session` (proxy para WPPConnect)
- [ ] Implementar `/api/whatsapp/send` (envia para n8n)
- [ ] Implementar `/api/whatsapp/conversations` (leitura do Supabase)
- [ ] Testar endpoints isoladamente

### Fase 4: n8n - Fluxos Base (2-3 dias)
- [ ] Criar fluxo de webhook receiver
- [ ] Criar fluxo de criação de contato/conversa
- [ ] Criar fluxo de envio de mensagens
- [ ] Integrar com IA existente

### Fase 4.5: Reconexão Automática e Monitoramento (1 dia)
- [ ] Criar fluxo de health check (cron 2min)
- [ ] Implementar lógica de reconexão
- [ ] Configurar alertas (Email/Telegram)
- [ ] Testar cenários de desconexão

### Fase 5: n8n - Sincronização de Labels (1-2 dias)
- [ ] Criar fluxo de sync WhatsApp → CRM (webhook + polling)
- [ ] Criar fluxo de sync CRM → WhatsApp
- [ ] Configurar mapeamento de labels
- [ ] Testar reconciliação

### Fase 6: Frontend - Configuração (2-3 dias)
- [ ] Criar página de configuração WhatsApp
- [ ] Implementar exibição de QR Code
- [ ] Implementar status de conexão
- [ ] Criar UI de mapeamento de labels

### Fase 7: Frontend - Inbox (5-7 dias)
- [ ] Criar lista de conversas com Realtime
- [ ] Criar visualização de chat
- [ ] Implementar envio de mensagens
- [ ] Implementar envio de mídia
- [ ] Integrar subscriptions do Supabase Realtime
- [ ] Testar RLS + Realtime juntos

### Fase 8: Testes e Ajustes (2-3 dias)
- [ ] Testes end-to-end
- [ ] Ajustes de performance
- [ ] Documentação de uso
- [ ] Treinamento

**Total estimado: 21-27 dias de desenvolvimento** (incluindo migração de infra)

---

## 8. Considerações de Segurança

### Autenticação
- Tokens JWT para comunicação entre serviços
- Secret key única por organização
- Rate limiting em endpoints públicos

### Dados Sensíveis
- Mensagens criptografadas em repouso (opcional)
- Logs sem conteúdo de mensagens em produção
- Backup automático de sessões

### Compliance
- Termos de uso do WhatsApp Business
- LGPD para dados de clientes
- Retenção de mensagens configurável

---

## 9. Migração do Chatwoot

### Estratégia de Transição
1. **Paralelo**: Manter Chatwoot funcionando durante implementação
2. **Gradual**: Migrar uma inbox por vez
3. **Fallback**: Chatwoot como backup temporário

### Dados a Migrar
- Histórico de conversas (opcional)
- Contatos já criados (já no CRM)
- Configurações de etiquetas

---

## 10. Monitoramento

### Métricas a Acompanhar
- Status de conexão da sessão
- Tempo de resposta de mensagens
- Taxa de entrega
- Erros de webhook

### Alertas Recomendados
- Sessão desconectada > 5 minutos
- Fila de mensagens > 100
- Taxa de erro > 5%

---

## Arquivos Relacionados

- [Fluxo n8n - Agente WPPConnect](./[Coronel%20Picanha]%20Agente%20WPPConnect.json)
- [Schema SQL Completo](./schema.sql)
- [Documentação WPPConnect](https://wppconnect.io/docs)

---

## Próximos Passos

1. **Aprovar** este plano de implementação
2. **Criar servidor** Hetzner CPX22 (AMD x64)
3. **Migrar n8n** do CAX21 para CPX22
4. **Criar branch** `feature/wppconnect-messaging`
5. **Iniciar** Fase 1 (Infraestrutura WPPConnect)
