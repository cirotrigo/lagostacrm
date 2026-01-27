# Prompt: Continuar Implementação Import-XLSX

Use este prompt para continuar a implementação da feature import-xlsx em uma nova conversa.

---

## Nomenclatura

| Termo | Significado |
|-------|-------------|
| **JucãoCRM** | Produto/feature (`CLIENT_ID=jucaocrm`) |
| **SosPet** | Cliente/organização que usa o produto |
| **Jucao** | Repositório de origem do código |
| **LagostaCRM** | Codebase base |

---

## Contexto Obrigatório

Antes de começar, leia os seguintes arquivos:

1. `.context/AI_GUARDRAILS.md` - Regras obrigatórias para trabalhar neste repositório
2. `.context/plans/import-xlsx-jucaocrm.md` - Plano completo da feature (inclui regras de isolamento)

---

## Prompt para Nova Conversa

```
Estou continuando a implementação da feature import-xlsx do produto JucãoCRM (cliente SosPet).

**LEIA PRIMEIRO:**
- `.context/AI_GUARDRAILS.md` (regras obrigatórias, branch safety)
- `.context/plans/import-xlsx-jucaocrm.md` (plano completo)

**Status atual:**
- Branch: `client/jucaocrm`
- Phase 1 (Migração & Setup): ✅ COMPLETA
- Phase 2 (Extração do Parser): ✅ COMPLETA
- Phase 3 (Integração N8N): ✅ COMPLETA
  - `importJobService.ts` - CRUD de jobs de importação
  - `stagingService.ts` - Operações na tabela staging
  - `webhookService.ts` - Disparo de webhooks N8N
  - API routes isoladas em `/api/clients/jucaocrm/import/`
  - README atualizado com documentação do workflow N8N

**Próxima fase: Phase 4 - UI no SosPet & Testes**

Tarefas pendentes:
- [ ] 4.1 Atualizar `ImportProductsButton.tsx` com estado de polling
- [ ] 4.2 Criar `ImportProgressCard.tsx` com barra de progresso
- [ ] 4.3 Adicionar `ClientExtensionSlot` no ProductsCatalogManager
- [ ] 4.4 Testar com arquivo real (50k+ produtos)
- [ ] 4.5 Documentar formato esperado do XLSX

Por favor, continue com a Phase 4 seguindo o plano documentado.
```

---

## IDs e Referências

| Item | Valor |
|------|-------|
| **Produto** | JucãoCRM (`NEXT_PUBLIC_CLIENT_ID=jucaocrm`) |
| **Cliente (Org SosPet)** | `b859b986-4471-4354-bff4-07313a65c282` |
| **Org LagostaCRM** | `d156b55f-256f-4f40-a273-5f5da5a9e882` |
| **Branch** | `client/jucaocrm` |
| **Supabase Project** | `abddatrjqytwyusiblxy` |
| **Repo Origem (Jucao)** | `/Users/cirotrigo/Documents/Jucao` |

---

## Arquivos da Feature

```
clients/jucaocrm/features/import-xlsx/
├── README.md                             # ✅ Documentação completa
├── index.ts                              # ✅ Exports atualizados
├── types.ts                              # ✅ Tipos completos
├── constants.ts                          # ✅ Mapeamento de colunas
├── parser/
│   ├── parseXlsx.ts                      # ✅ Parser XLSX funcional
│   └── normalizers.ts                    # ✅ Funções de normalização
├── services/
│   ├── importProductsFromXlsx.ts         # ✅ Importação direta (fallback)
│   ├── importJobService.ts               # ✅ CRUD de jobs
│   ├── stagingService.ts                 # ✅ Operações staging
│   └── webhookService.ts                 # ✅ Webhooks N8N
└── ui/
    ├── ImportProductsButton.tsx          # ✅ Funcional (sem N8N)
    └── ProductsToolbarExtension.tsx      # TODO Phase 4

app/api/clients/jucaocrm/import/
├── route.ts                              # ✅ POST/GET upload & list
├── [jobId]/
│   ├── route.ts                          # ✅ GET/DELETE job status
│   └── start/
│       └── route.ts                      # ✅ POST trigger N8N
└── callback/
    └── route.ts                          # ✅ POST N8N callback
```

---

## Commits Relevantes

```
665f571 feat(jucaocrm): add import-xlsx feature and product migration
05fde02 docs: clarify isolation rules and standardize nomenclature
```

**Nota:** Phase 3 foi implementada mas ainda não commitada. Verifique `git status` antes de continuar.
