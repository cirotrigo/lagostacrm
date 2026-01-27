# Prompt: Feature Import-XLSX — Completa

Esta feature está **COMPLETA** (v1.0.0). Use este documento como referência para manutenção futura.

---

## Nomenclatura

| Termo | Significado |
|-------|-------------|
| **JucãoCRM** | Produto/feature (`CLIENT_ID=jucaocrm`) |
| **SosPet** | Cliente/organização que usa o produto |
| **Jucao** | Repositório de origem do código |
| **LagostaCRM** | Codebase base |

---

## Status da Feature

✅ **v1.0.0 - Feature Completa**

| Phase | Nome | Status |
|-------|------|--------|
| 1 | Migração de Dados & Setup | ✅ Completa |
| 2 | Extração do Parser | ✅ Completa |
| 3 | Integração N8N | ✅ Completa |
| 4 | UI no SosPet & Testes | ✅ Completa |

---

## Arquitetura

### Fluxo de Importação

```
┌─────────────────────────────────────────────────────────┐
│  Arquivo XLSX                                            │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────┐     < 500 produtos     ┌────────────┐  │
│  │   Browser   │ ─────────────────────► │  Direto    │  │
│  │  (Parse)    │                        │ (Supabase) │  │
│  └─────────────┘                        └────────────┘  │
│       │                                                  │
│       │ >= 500 produtos                                  │
│       ▼                                                  │
│  ┌─────────────┐     POST /import      ┌────────────┐   │
│  │   Upload    │ ─────────────────────►│   API      │   │
│  └─────────────┘                        │ (Staging)  │   │
│                                         └─────┬──────┘   │
│                                               │          │
│       ┌───────────────────────────────────────┘          │
│       ▼                                                  │
│  ┌─────────────┐     POST /start       ┌────────────┐   │
│  │   Trigger   │ ─────────────────────►│    N8N     │   │
│  └─────────────┘                        │ (Process)  │   │
│                                         └─────┬──────┘   │
│                                               │          │
│       ┌───────────────────────────────────────┘          │
│       ▼                                                  │
│  ┌─────────────┐     Polling           ┌────────────┐   │
│  │  Progress   │ ◄─────────────────────│  Callback  │   │
│  │    Card     │                        │  (N8N)     │   │
│  └─────────────┘                        └────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Estrutura de Arquivos

```
clients/jucaocrm/features/import-xlsx/
├── README.md                             # Documentação completa
├── index.ts                              # Exports
├── types.ts                              # Tipos TypeScript
├── constants.ts                          # Mapeamento de colunas
├── parser/
│   ├── parseXlsx.ts                      # Parser XLSX
│   └── normalizers.ts                    # Normalização de dados
├── services/
│   ├── importProductsFromXlsx.ts         # Importação direta (< 500)
│   ├── importJobService.ts               # CRUD de jobs
│   ├── stagingService.ts                 # Operações staging
│   └── webhookService.ts                 # Webhooks N8N
└── ui/
    ├── ImportProductsButton.tsx          # Botão + Modal
    ├── ImportProgressCard.tsx            # Card de progresso
    └── ProductsToolbarExtension.tsx      # Extensão toolbar

app/api/clients/jucaocrm/import/
├── route.ts                              # POST/GET upload & list
├── [jobId]/
│   ├── route.ts                          # GET/DELETE job status
│   └── start/
│       └── route.ts                      # POST trigger N8N
└── callback/
    └── route.ts                          # POST N8N callback
```

---

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/clients/jucaocrm/import` | Upload e parse do arquivo XLSX |
| GET | `/api/clients/jucaocrm/import` | Lista jobs de importação |
| GET | `/api/clients/jucaocrm/import/[jobId]` | Status de um job específico |
| DELETE | `/api/clients/jucaocrm/import/[jobId]` | Cancela/deleta um job |
| POST | `/api/clients/jucaocrm/import/[jobId]/start` | Inicia processamento via N8N |
| POST | `/api/clients/jucaocrm/import/callback` | Callback do N8N |

---

## IDs e Referências

| Item | Valor |
|------|-------|
| **Produto** | JucãoCRM (`NEXT_PUBLIC_CLIENT_ID=jucaocrm`) |
| **Cliente (Org SosPet)** | `b859b986-4471-4354-bff4-07313a65c282` |
| **Org LagostaCRM** | `d156b55f-256f-4f40-a273-5f5da5a9e882` |
| **Branch** | `client/jucaocrm` |
| **Supabase Project** | `abddatrjqytwyusiblxy` |

---

## Variáveis de Ambiente

```bash
# N8N Integration
N8N_WEBHOOK_IMPORT_PRODUCTS=https://seu-n8n.com/webhook/import-products
N8N_WEBHOOK_SECRET=secret-compartilhado

# Client ID (obrigatório para ativar a feature)
NEXT_PUBLIC_CLIENT_ID=jucaocrm
```

---

## Próximos Passos (Futuro)

- [ ] Configurar workflow N8N de produção
- [ ] Testar com arquivo de 50k+ produtos
- [ ] Adicionar suporte a outros formatos (CSV)
- [ ] Implementar retry automático em caso de falha
