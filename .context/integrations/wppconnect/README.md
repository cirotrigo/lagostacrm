# Integração WPPConnect - LagostaCRM

> Documentação da integração de mensageria WhatsApp usando WPPConnect Server.

## Arquivos nesta pasta

| Arquivo | Descrição |
|---------|-----------|
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Plano completo de implementação com fases, arquitetura e checklist |
| [schema.sql](./schema.sql) | Schema SQL com todas as tabelas necessárias para a integração |
| [n8n-wppconnect-base-flow.json](./n8n-wppconnect-base-flow.json) | Fluxo n8n base para importar e adaptar |

## Quick Start

### 1. Deploy do WPPConnect Server

```bash
# Usando Docker
docker run -d \
  --name wppconnect-server \
  -p 21465:21465 \
  -e SECRET_KEY=sua-chave-secreta \
  -e WEBHOOK_URL=https://seu-n8n.com/webhook/wppconnect/lagostacrm \
  wppconnect/server-cli:latest
```

### 2. Executar Migration

```bash
# No Supabase
supabase db push
# Ou execute o schema.sql manualmente
```

### 3. Importar Fluxo n8n

1. Abra o n8n
2. Vá em "Workflows" > "Import from File"
3. Selecione `n8n-wppconnect-base-flow.json`
4. Configure as credenciais
5. Ative o workflow

### 4. Conectar WhatsApp

```bash
# Iniciar sessão (retorna QR Code)
curl -X POST https://seu-wppconnect-server.com/api/lagostacrm-main/start-session \
  -H "Authorization: Bearer sua-chave-secreta"
```

## Recursos Implementados

- [x] Recebimento de mensagens
- [x] Envio de mensagens (texto)
- [x] Criação automática de contatos
- [x] Sincronização de labels ↔ tags
- [x] Status de entrega (ACK)
- [ ] Envio de mídia (imagem, áudio, documento)
- [ ] Interface no CRM (inbox)
- [ ] Templates de mensagem

## Links Úteis

- [Documentação WPPConnect](https://wppconnect.io/docs)
- [WPPConnect Server GitHub](https://github.com/wppconnect-team/wppconnect-server)
- [Swagger API](https://wppconnect.io/swagger/wppconnect-server/)
