# Prompt: Continuar Implementação Import-XLSX

Use este prompt para continuar a implementação da feature import-xlsx em uma nova conversa.

---

## Contexto Obrigatório

Antes de começar, leia os seguintes arquivos:

1. `.context/AI_GUARDRAILS.md` - Regras obrigatórias para trabalhar neste repositório
2. `.context/plans/import-xlsx-jucaocrm.md` - Plano completo da feature

---

## Prompt para Nova Conversa

```
Estou continuando a implementação da feature import-xlsx para o SosPet.

**LEIA PRIMEIRO:**
- `.context/AI_GUARDRAILS.md` (regras obrigatórias, branch safety)
- `.context/plans/import-xlsx-jucaocrm.md` (plano completo)

**Status atual:**
- Branch: `client/jucaocrm`
- Phase 1 (Migração & Setup): ✅ COMPLETA
  - 3.971 produtos migrados para SosPet
  - Tabelas import_jobs e import_staging criadas
  - Dependência xlsx@0.18.5 instalada
  - Variáveis de ambiente configuradas

**Próxima fase: Phase 2 - Extração do Parser**

Tarefas pendentes:
- [ ] 2.1 Criar `constants.ts` com mapeamento de colunas
- [ ] 2.2 Criar `parseXlsx.ts` funcional (extrair do Jucao)
- [ ] 2.3 Criar `normalizers.ts` para limpeza de dados
- [ ] 2.4 Adicionar testes unitários

**Repositório fonte do parser:**
`/Users/cirotrigo/Documents/Jucao/src/lib/imports/xlsx.ts`

**Destino:**
`clients/jucaocrm/features/import-xlsx/parser/`

Por favor, continue com a Phase 2 seguindo o plano documentado.
```

---

## IDs Importantes

| Item | Valor |
|------|-------|
| Organization SosPet | `b859b986-4471-4354-bff4-07313a65c282` |
| Organization LagostaCRM | `d156b55f-256f-4f40-a273-5f5da5a9e882` |
| Branch de trabalho | `client/jucaocrm` |
| Supabase Project | `abddatrjqytwyusiblxy` |

---

## Arquivos da Feature

```
clients/jucaocrm/features/import-xlsx/
├── README.md
├── index.ts
├── types.ts
├── parser/
│   └── parseXlsx.ts (placeholder - precisa implementar)
├── services/
│   └── importProductsFromXlsx.ts (placeholder)
└── ui/
    ├── ImportProductsButton.tsx
    └── ProductsToolbarExtension.tsx
```

---

## Commit Anterior

```
665f571 feat(jucaocrm): add import-xlsx feature and product migration
```
