---
status: completed
generated: 2026-01-27
updated: 2026-01-27
client: jucaocrm
feature: import-xlsx
source_repo: /Users/cirotrigo/Documents/Jucao
current_phase: complete
phases:
  - id: "phase-1"
    name: "Migração de Dados & Setup"
    prevc: "P"
    status: completed
  - id: "phase-2"
    name: "Extração do Parser"
    prevc: "E"
    status: completed
  - id: "phase-3"
    name: "Integração N8N"
    prevc: "E"
    status: completed
  - id: "phase-4"
    name: "UI no SosPet & Testes"
    prevc: "V"
    status: completed
---

# Plano: Importação XLSX para JucãoCRM

> Extrair funcionalidade de importação de produtos via XLSX do repositório Jucao e integrar ao **SosPet** como feature isolada (código vive no LagostaCRM, ativada por `CLIENT_ID=jucaocrm`), usando N8N para processamento de 50k+ produtos.

## Resumo Executivo

| Item | Valor |
|------|-------|
| **Produto** | JucãoCRM (`NEXT_PUBLIC_CLIENT_ID=jucaocrm`) |
| **Cliente/Org** | SosPet (`b859b986-4471-4354-bff4-07313a65c282`) |
| **Repo Origem** | Jucao (`/Users/cirotrigo/Documents/Jucao`) |
| **Feature** | Importação de Produtos via XLSX |
| **Volume** | ~4.000 produtos ativos (50k+ total) |
| **Processamento** | N8N (self-hosted) |
| **Staging** | Tabelas `import_jobs` e `import_staging` |
| **Branch** | `client/jucaocrm` |
| **Org LagostaCRM** | `d156b55f-256f-4f40-a273-5f5da5a9e882` (separada) |

## Arquitetura dos Projetos

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL DEPLOYMENTS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │   JUCAO     │   │   SOSPET    │   │ LAGOSTACRM  │               │
│  │  (antigo)   │   │   (novo)    │   │   (base)    │               │
│  │ jucao.app   │   │ sospet.app  │   │lagosta.app  │               │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘               │
│         │                 │                 │                       │
│         │    MIGRAÇÃO     │                 │                       │
│         └────────────────►│                 │                       │
│                           │                 │                       │
│  ┌────────────────────────┴─────────────────┴────────────────────┐ │
│  │              SUPABASE: abddatrjqytwyusiblxy                   │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐             │ │
│  │  │ org: SosPet         │  │ org: LagostaCRM     │             │ │
│  │  │ b859b986...         │  │ d156b55f...         │             │ │
│  │  └─────────────────────┘  └─────────────────────┘             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Glossário de Nomenclatura

| Termo | Significado |
|-------|-------------|
| **JucãoCRM** | Identificador do produto/feature (`CLIENT_ID=jucaocrm`) |
| **SosPet** | Cliente/organização que usa o produto (`org: b859b986...`) |
| **Jucao** | Repositório de origem (`/Users/cirotrigo/Documents/Jucao`) |
| **LagostaCRM** | Codebase base (fork de nossocrm) |

---

## Regras de Isolamento

### Código da Feature (PROIBIDO no core)

- **NÃO** copiar código de feature para `app/`, `services/`, `components/` globais
- **NÃO** alterar fluxos centrais de criação/edição de produtos
- **NÃO** criar imports diretos do core para `clients/jucaocrm/`
- **TODA** lógica de negócio deve viver em: `clients/jucaocrm/features/import-xlsx/`
- **ATIVAÇÃO** somente quando: `NEXT_PUBLIC_CLIENT_ID=jucaocrm`

### Infraestrutura Genérica (PERMITIDO em lib/)

Código de **infraestrutura reutilizável** pode existir em `lib/` desde que:
- Seja agnóstico a cliente (não mencione jucaocrm, sospet, etc.)
- Não contenha lógica de negócio específica
- Sirva como extensão point genérico

**Arquivos autorizados em lib/:**
| Arquivo | Propósito | Status |
|---------|-----------|--------|
| `lib/client-extensions.tsx` | Sistema de lazy-loading de extensões | ✅ Criado |

### Exceções Autorizadas no Core

> ⚠️ **REGRA**: Novas exceções requerem autorização explícita do owner.

| Local | Tipo | Descrição | Autorizado |
|-------|------|-----------|------------|
| `features/settings/components/ProductsCatalogManager.tsx` | `<ClientExtensionSlot>` | 1 slot na toolbar de produtos | ✅ Pendente implementação |

**Proibições:**
- ❌ Novos `ClientExtensionSlot` sem autorização
- ❌ Modificar componentes existentes além do slot autorizado
- ❌ Adicionar condicionais `if (clientId === 'jucaocrm')` no core

---

## Análise do Repositório Origem

### Arquivos Relevantes do Jucao

| Arquivo | Linhas | Propósito | Extrair? |
|---------|--------|-----------|----------|
| `src/lib/imports/xlsx.ts` | 332 | Parser principal XLSX | **SIM** |
| `src/lib/imports/constants.ts` | 12 | Headers e índices | **SIM** |
| `src/lib/imports/workflow-mapping.ts` | 194 | Mapeamento de grupos | PARCIAL |
| `src/lib/supabase-products.ts` | 140 | Tipo SupabaseProduct | REF |
| `src/app/api/imports/route.ts` | 180 | API de upload | ADAPTAR |
| `src/app/api/imports/[id]/start/route.ts` | 148 | Trigger N8N | ADAPTAR |

### Dependência Principal

```json
{
  "xlsx": "^0.18.5"
}
```

### Mapeamento de Dados

#### Estrutura XLSX Esperada (Jucao)

| Coluna | Header | Índice Posicional |
|--------|--------|-------------------|
| Código | `Código` | 0 |
| Descrição | `Descrição` | 3 |
| Estoque | `Estoque` | 6 |
| Grupo | `Grupo` | 9 |
| Preço | `Venda` | 13 |

#### Tipo Produto Jucao → LagostaCRM

```typescript
// Jucao (origem)
type SupabaseProduct = {
  codigo: string;      // → sku
  descricao: string;   // → name
  grupo?: string;      // → (não usado)
  preco: number;       // → price
  estoque: number;     // → (não usado)
  ativo: boolean;      // → active
}

// LagostaCRM (destino)
interface Product = {
  id: string;
  name: string;        // ← descricao
  price: number;       // ← preco
  sku?: string;        // ← codigo
  description?: string;
  active?: boolean;    // ← ativo
}
```

---

## Arquitetura da Solução

### Fluxo de Processamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 1: UPLOAD & PARSE (Browser + API)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Usuário seleciona arquivo .xlsx                                     │
│  2. Browser parseia com xlsx.js (client-side preview)                   │
│  3. Mostra preview dos primeiros 10 itens                               │
│  4. Usuário confirma importação                                         │
│  5. Upload do arquivo para Supabase Storage                             │
│  6. API cria ImportJob (status: 'queued')                               │
│  7. API insere rows em import_staging (batch de 1000)                   │
│  8. API retorna job_id para o browser                                   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 2: TRIGGER N8N (API)                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  9. API chama webhook N8N com { job_id, organization_id }               │
│  10. N8N inicia workflow de processamento                               │
│  11. ImportJob.status → 'processing'                                    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 3: PROCESSAMENTO (N8N)                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  12. N8N busca batch de 100 rows de import_staging (processed=false)    │
│  13. Para cada row:                                                     │
│      - Verifica se SKU existe em products                               │
│      - Se existe: UPDATE                                                │
│      - Se não: INSERT                                                   │
│      - Marca staging row como processed=true                            │
│  14. Atualiza ImportJob.processed_rows                                  │
│  15. Repete até processed_rows == total_rows                            │
│  16. ImportJob.status → 'completed'                                     │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 4: FEEDBACK (Browser)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  17. Browser faz polling a cada 3s em /api/import-jobs/[id]             │
│  18. UI mostra barra de progresso (processed_rows / total_rows)         │
│  19. Quando status == 'completed':                                      │
│      - Mostra resumo (created, updated, errors)                         │
│      - Dispara 'crm:products-updated'                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estrutura de Arquivos

```
clients/jucaocrm/features/import-xlsx/
├── index.ts                          # Exports
├── types.ts                          # ImportJob, ImportProgress, XlsxRow
├── constants.ts                      # Mapeamento de colunas
├── README.md                         # Documentação
├── parser/
│   ├── parseXlsx.ts                  # Parser extraído do Jucao
│   └── normalizers.ts                # Normalização de células/headers
├── services/
│   ├── importJobService.ts           # CRUD de ImportJob
│   ├── stagingService.ts             # Operações na tabela staging
│   └── webhookService.ts             # Disparo para N8N
└── ui/
    ├── ImportProductsButton.tsx      # Botão principal
    ├── ImportModal.tsx               # Modal de upload + preview
    ├── ImportProgressCard.tsx        # Card de progresso
    └── ProductsToolbarExtension.tsx  # Extensão da toolbar
```

---

## Migração de Dados Existentes

### Contexto

O usuário já tem **50k+ produtos processados** no banco do Jucao que precisam ser migrados para o LagostaCRM.

### Banco de Origem (Jucao/N8N)

```
Tabela: v_produtos (Supabase N8N)
Colunas: codigo, descricao, descricao_ia, grupo, marca, preco, estoque, ativo, imagem_url
```

### Banco de Destino (LagostaCRM)

```
Tabela: products
Colunas: id, organization_id, name, description, price, sku, active, created_at, updated_at
```

### Script de Migração

```sql
-- Executar no Supabase do LagostaCRM
-- Requer: CSV exportado do banco N8N importado como tabela temporária

-- 1. Criar tabela temporária para receber o CSV
CREATE TEMP TABLE n8n_produtos_import (
  codigo TEXT,
  descricao TEXT,
  descricao_ia TEXT,
  grupo TEXT,
  marca TEXT,
  preco NUMERIC,
  estoque INT,
  ativo BOOLEAN,
  imagem_url TEXT
);

-- 2. Importar CSV via Supabase Dashboard (Table Editor > Import)
-- Ou via COPY se tiver acesso direto

-- 3. Inserir produtos com UPSERT
INSERT INTO products (organization_id, name, description, price, sku, active)
SELECT
  'b859b986-4471-4354-bff4-07313a65c282'::uuid,
  descricao,
  descricao_ia,
  COALESCE(preco, 0),
  codigo,
  COALESCE(ativo, true)
FROM n8n_produtos_import
WHERE descricao IS NOT NULL AND descricao != ''
ON CONFLICT (organization_id, sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  active = EXCLUDED.active,
  updated_at = NOW();

-- 4. Verificar resultado
SELECT COUNT(*) as total_importado FROM products
WHERE organization_id = 'b859b986-4471-4354-bff4-07313a65c282';

-- 5. Limpar tabela temporária
DROP TABLE IF EXISTS n8n_produtos_import;
```

---

## Fases de Implementação

### Phase 1 — Migração de Dados & Setup

**Objetivo**: Migrar produtos existentes e preparar infraestrutura

**Arquivos Criados**:
- `scripts/migrate-products-from-jucao.ts` — Script de migração N8N → SosPet
- `supabase/migrations/20260127000000_import_xlsx_tables.sql` — Tabelas import_jobs e import_staging
- `supabase/migrations/20260127000001_fix_products_sku_constraint.sql` — Constraint UNIQUE para UPSERT

**Tarefas**:

- [x] **1.1** Script de migração criado
  - Conecta ao banco N8N e LagostaCRM via Supabase
  - Migra produtos com UPSERT (atualiza se SKU existir)
  - Suporta `--dry-run` e `--limit=N` para testes

- [x] **1.2** Criar tabelas no Supabase LagostaCRM ✅ (aplicada via `supabase db push`)
  ```sql
  -- import_jobs: rastreia jobs de importação
  CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'queued',
    file_name TEXT,
    file_url TEXT,
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    created_count INT DEFAULT 0,
    updated_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    last_error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- import_staging: dados parseados aguardando processamento
  CREATE TABLE import_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_index INT,
    sku TEXT,
    name TEXT NOT NULL,
    price NUMERIC DEFAULT 0,
    description TEXT,
    processed BOOLEAN DEFAULT false,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Índices para performance
  CREATE INDEX idx_import_jobs_org ON import_jobs(organization_id);
  CREATE INDEX idx_import_jobs_status ON import_jobs(status);
  CREATE INDEX idx_staging_job ON import_staging(job_id);
  CREATE INDEX idx_staging_unprocessed ON import_staging(job_id) WHERE processed = false;

  -- Índice único para SKU por organização (evita duplicatas)
  CREATE UNIQUE INDEX idx_products_org_sku ON products(organization_id, sku) WHERE sku IS NOT NULL;
  ```

- [x] **1.3** Importar produtos existentes para SosPet ✅ (3.971 produtos migrados)
  - Mapear `codigo` → `sku`
  - Mapear `descricao` → `name`
  - Mapear `descricao_ia` → `description`
  - Mapear `preco` → `price`
  - Mapear `ativo` → `active`

- [x] **1.4** Instalar dependência xlsx ✅
  ```bash
  npm install xlsx@^0.18.5
  ```

- [x] **1.5** Configurar variáveis de ambiente ✅ (adicionado em `.env` e `.env.example`)
  ```bash
  # .env.local
  N8N_WEBHOOK_IMPORT_PRODUCTS=https://seu-n8n.com/webhook/import-products
  N8N_WEBHOOK_SECRET=seu-secret-aqui
  ```

**Entregáveis**:
- Migrations SQL aplicadas
- Produtos migrados e verificados
- Dependência `xlsx` instalada

---

### Phase 2 — Extração do Parser

**Objetivo**: Extrair e adaptar o parser XLSX do Jucao

**Arquivos de Origem** (Jucao):
- `/Users/cirotrigo/Documents/Jucao/src/lib/imports/xlsx.ts`
- `/Users/cirotrigo/Documents/Jucao/src/lib/imports/constants.ts`

**Arquivos de Destino** (LagostaCRM):
- `clients/jucaocrm/features/import-xlsx/parser/parseXlsx.ts`
- `clients/jucaocrm/features/import-xlsx/parser/normalizers.ts`
- `clients/jucaocrm/features/import-xlsx/constants.ts`

**Tarefas**:

- [x] **2.1** Criar `constants.ts` com mapeamento de colunas
  ```typescript
  export const COLUMN_MAPPING = {
    name: ['descricao', 'descrição', 'nome', 'name', 'produto'],
    price: ['venda', 'preco', 'preço', 'price', 'valor'],
    sku: ['codigo', 'código', 'code', 'sku', 'ref'],
    description: ['obs', 'observacao', 'observação', 'notes'],
  };

  export const POSITIONAL_INDEXES = {
    sku: 0,
    name: 1,
    price: 4,
  };
  ```

- [x] **2.2** Criar `normalizers.ts`
  - Extrair `normalizeCell()` do Jucao
  - Extrair `normalizeHeaderLabel()` do Jucao
  - Adaptar para tipos do LagostaCRM

- [x] **2.3** Reescrever `parseXlsx.ts`
  - Extrair lógica de `parseImportXlsxBuffer()` do Jucao
  - Remover dependências de Google Sheets
  - Simplificar para retornar `XlsxProductRow[]`
  - Manter detecção inteligente de sheet
  - Manter fuzzy matching de headers

- [x] **2.4** Atualizar `types.ts`
  ```typescript
  export interface ImportJob {
    id: string;
    organizationId: string;
    userId?: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    fileName: string;
    fileUrl?: string;
    totalRows: number;
    processedRows: number;
    createdCount: number;
    updatedCount: number;
    errorCount: number;
    lastError?: string;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
  }

  export interface ImportStagingRow {
    id: string;
    jobId: string;
    rowIndex: number;
    sku?: string;
    name: string;
    price: number;
    description?: string;
    processed: boolean;
    error?: string;
  }
  ```

**Entregáveis**:
- Parser funcional que lê XLSX e retorna dados tipados
- Testes unitários do parser

---

### Phase 3 — Integração N8N

**Objetivo**: Configurar fluxo completo de processamento

**Tarefas**:

- [x] **3.1** Criar `services/importJobService.ts` ✅
  - CRUD completo de import_jobs
  - Métodos: create, getById, listByOrganization, updateStatus, updateProgress, complete, fail, delete

- [x] **3.2** Criar `services/stagingService.ts` ✅
  - Operações na tabela import_staging
  - Métodos: insertBatch, getUnprocessed, markProcessed, markError, getCounts, cleanup

- [x] **3.3** Criar `services/webhookService.ts` ✅
  - Disparo de webhooks para N8N
  - Métodos: triggerImport, isConfigured, getWebhookUrl, healthCheck

- [x] **3.4** Criar API routes ✅
  - `POST /api/clients/jucaocrm/import` - Upload + parse + staging
  - `GET /api/clients/jucaocrm/import` - Lista jobs
  - `GET /api/clients/jucaocrm/import/[jobId]` - Status do job
  - `DELETE /api/clients/jucaocrm/import/[jobId]` - Deleta job
  - `POST /api/clients/jucaocrm/import/[jobId]/start` - Trigger N8N
  - `POST /api/clients/jucaocrm/import/callback` - Callback do N8N

- [x] **3.5** Documentar workflow N8N ✅
  - README atualizado com fluxo completo
  - Pseudo-código do workflow N8N
  - Estrutura de callback documentada

**Entregáveis**:
- ✅ Services funcionais
- ✅ API routes isoladas
- ✅ Documentação do workflow N8N

---

### Phase 4 — UI no SosPet & Testes

**Objetivo**: Interface de usuário no SosPet e validação final

> **Nota**: A UI é implementada no codebase LagostaCRM (`clients/jucaocrm/`) mas só aparece no deploy do **SosPet** (quando `NEXT_PUBLIC_CLIENT_ID=jucaocrm`).

**Tarefas**:

- [x] **4.1** Atualizar `ImportProductsButton.tsx` ✅
  - Suporte a dois modos: direto (< 500 produtos) e assíncrono (>= 500 produtos)
  - Polling de status a cada 2 segundos
  - Indicadores visuais do modo de importação

- [x] **4.2** Criar `ImportProgressCard.tsx` ✅
  - Barra de progresso animada
  - Contadores (criados, atualizados, erros)
  - Estados: processando, completo, falha

- [x] **4.3** Adicionar `ClientExtensionSlot` no core ✅
  ```tsx
  // features/settings/components/ProductsCatalogManager.tsx
  import { ClientExtensionSlot } from '@/lib/client-extensions';

  // Na toolbar:
  <ClientExtensionSlot
    name="products-toolbar"
    props={{ onImportComplete: load, disabled: loading }}
  />
  ```

- [ ] **4.4** Testar com arquivo real
  - Pendente: requer N8N configurado e arquivo de teste
  - Upload de arquivo com 50k+ linhas
  - Verificar progresso em tempo real

- [x] **4.5** Documentar ✅
  - README da feature atualizado (Phase 3)
  - Variáveis de ambiente documentadas
  - Formato esperado do XLSX documentado

**Entregáveis**:
- ✅ UI funcional no SosPet com feedback de progresso
- ⏳ Testes end-to-end (pendente N8N)
- ✅ Documentação atualizada

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Timeout na API durante parse | Baixa | Alto | Parse no browser, só envia dados parseados |
| N8N indisponível | Baixa | Alto | Health check antes de trigger, retry automático |
| Memória insuficiente com 50k rows | Média | Médio | Processar em chunks de 5000 |
| Conflito de SKU duplicado | Alta | Baixo | UPSERT com ON CONFLICT |
| Mudança no core do LagostaCRM | Média | Baixo | Código 100% isolado, fail-safe |

---

## Variáveis de Ambiente

```bash
# N8N Integration
N8N_WEBHOOK_IMPORT_PRODUCTS=https://seu-n8n.com/webhook/import-products
N8N_WEBHOOK_SECRET=secret-compartilhado

# Supabase Storage (já configurado)
# NEXT_PUBLIC_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Client ID (já configurado)
# NEXT_PUBLIC_CLIENT_ID=jucaocrm
```

---

## Checklist Final

- [ ] Migrations aplicadas no Supabase
- [ ] Produtos existentes migrados
- [ ] Dependência `xlsx` instalada
- [ ] Parser funcional e testado
- [ ] Services de job/staging funcionando
- [ ] Workflow N8N adaptado
- [ ] UI com progresso em tempo real
- [ ] `ClientExtensionSlot` adicionado ao core
- [ ] Documentação atualizada
- [ ] Teste end-to-end com 50k+ produtos

---

## Referências

- **Repositório Origem**: `/Users/cirotrigo/Documents/Jucao`
- **Parser Original**: `src/lib/imports/xlsx.ts`
- **Destino**: `clients/jucaocrm/features/import-xlsx/`
- **Branch**: `client/jucaocrm`
