# Prompt para Implementação: Feature de Treinamento / Base de Conhecimento

> Use este prompt em uma nova conversa do Claude Code para implementar a UI de base de conhecimento no CRM Empório Fonseca.

---

## Contexto

O projeto **CRM Empório Fonseca** (`/Users/cirotrigo/Documents/Empório Fonseca CMR`) é um fork do **LagostaCRM** (NossoCRM). É um CRM Next.js com Supabase.

O projeto **Studio Lagosta v2** (`/Users/cirotrigo/Documents/Studio-Lagosta-v2`) já possui uma feature completa de **Base de Conhecimento / Treinamento** que precisa ser portada para o CRM, adaptando de Prisma/Upstash para Supabase/pgvector.

### Stack do CRM (destino)
- Next.js 16 (App Router), React 19
- Supabase (PostgreSQL + pgvector)
- TanStack Query + Zustand
- Tailwind CSS v4, Radix UI
- TypeScript strict
- Imports via `@/` alias

### Stack do Studio Lagosta (fonte)
- Next.js (App Router)
- Prisma + PostgreSQL + Upstash Vector DB
- TanStack Query
- Tailwind CSS
- OpenAI embeddings (`text-embedding-3-small`, 1536 dimensões)

---

## Tarefa

Portar a feature de **Base de Conhecimento** do Studio Lagosta v2 para o CRM Empório Fonseca.

---

## A tabela `documents` já existe no Supabase

A migration `supabase/migrations/20260329_add_documents_table.sql` já foi aplicada:

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
) RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT);
```

Já existem ~13 entradas seed com info do restaurante (sem embeddings ainda).

O campo `metadata` JSONB armazena: `category`, `title`, `tags`, `status`, `organization_id`.

---

## Arquivos fonte no Studio Lagosta v2 (LEIA TODOS antes de implementar)

### Database Schema (Prisma → adaptar para Supabase)
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/prisma/schema.prisma`
  - Modelos: `KnowledgeBaseEntry` (title, content, category, status, tags, metadata, createdBy, updatedBy, expiresAt) e `KnowledgeChunk` (entryId, ordinal, content, tokens, vectorId)
  - Enum `KnowledgeCategory`: ESTABELECIMENTO_INFO, HORARIOS, CARDAPIO, DELIVERY, POLITICAS, TOM_DE_VOZ, CAMPANHAS, DIFERENCIAIS, FAQ

### Library Core (adaptar de Upstash Vector → pgvector/Supabase)
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/embeddings.ts` — OpenAI `text-embedding-3-small`, funções `generateEmbedding()` e `generateEmbeddings()`
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/vector-client.ts` — Upstash Vector client (substituir por Supabase RPC `match_documents`)
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/indexer.ts` — pipeline: `indexEntry()`, `indexFile()`, `reindexEntry()`, `updateEntry()`, `deleteEntry()`
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/chunking.ts` — `chunkText()` (600 tokens, overlap 100), `parseFileContent()` (TXT/Markdown)
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/search.ts` — busca semântica com score mínimo
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/training-pipeline.ts` — `processTrainingInput()`, intent detection + deduplicação
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/find-similar-entries.ts` — deduplicação por similaridade
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/classify-intent.ts` — classifica intent (QUERY, CREATE, UPDATE, REPLACE, DELETE)
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/classify-category.ts` — auto-classifica categoria
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/extract-knowledge-data.ts` — extrai título, conteúdo, tags
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/lib/knowledge/cache.ts` — invalidação de cache

### API Routes (adaptar de Prisma → Supabase)
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/app/api/knowledge/training/preview/route.ts` — POST preview de training
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/app/api/knowledge/confirm/route.ts` — POST confirmar operações
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/app/api/knowledge/[id]/route.ts` — GET/PUT/DELETE entry
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/app/api/admin/knowledge/route.ts` — GET lista admin
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/app/api/admin/knowledge/[id]/reindex/route.ts` — POST reindexar

### UI Pages
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/app/(protected)/knowledge/page.tsx` — Página principal (listar, criar, deletar, upload arquivo)

### Hooks
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/hooks/use-org-knowledge.ts` — `useOrgKnowledgeEntries()`, `useCreateOrgKnowledgeEntry()`, `useUploadOrgKnowledgeFile()`, `useDeleteOrgKnowledgeEntry()`

### Componentes
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/components/admin/knowledge/knowledge-list.tsx`
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/components/admin/knowledge/knowledge-form.tsx`
- `/Users/cirotrigo/Documents/Studio-Lagosta-v2/src/components/chat/knowledge-preview-card.tsx`

---

## Adaptações obrigatórias

| Componente | Studio Lagosta | CRM Empório |
|-----------|----------------|-------------|
| ORM | Prisma | Supabase client (`lib/supabase/`) |
| Vector DB | Upstash Vector (externo) | pgvector nativo (função `match_documents`) |
| Embeddings | `@ai-sdk/openai` `text-embedding-3-small` | Mesmo (manter) |
| Auth | Clerk/NextAuth | Supabase Auth (já existe) |
| Multi-tenant | `projectId` + `workspaceId` | `organization_id` (simplificado) |
| State | TanStack Query | TanStack Query (mesmo) |
| CSS | Tailwind | Tailwind v4 (mesmo padrão do CRM) |
| Chunking | Separado em `knowledge_chunks` | Usar campo `embedding` direto na tabela `documents` (simplificado) OU criar tabela `knowledge_chunks` se preferir granularidade |

---

## Decisão de schema

**Opção A (simplificada)**: Usar a tabela `documents` que já existe. Cada documento = 1 embedding. Metadados (title, category, tags, status) ficam no JSONB `metadata`. Sem tabela de chunks separada.

**Opção B (completa)**: Criar tabela `knowledge_base_entries` (metadados) + `knowledge_chunks` (chunks com embeddings). Mais fiel ao Studio Lagosta, suporta documentos longos.

Avaliar qual opção faz mais sentido considerando que os documentos do restaurante são relativamente curtos. A Opção A é mais simples e já funciona com o n8n vector store node.

---

## Categorias

```typescript
const KNOWLEDGE_CATEGORIES = [
  'ESTABELECIMENTO_INFO',
  'HORARIOS',
  'CARDAPIO',
  'POLITICAS',
  'CAMPANHAS',
  'FAQ',
  'DIFERENCIAIS',
  'TOM_DE_VOZ',
] as const;
```

---

## Funcionalidades esperadas na UI

- [ ] Página **"Treinamento"** acessível pelo menu lateral do CRM
- [ ] Listar entradas da base de conhecimento com filtro por categoria
- [ ] Criar nova entrada (texto livre ou upload TXT/MD)
- [ ] Editar entrada existente
- [ ] Excluir entrada (com confirmação)
- [ ] Auto-categorização via IA (opcional)
- [ ] Geração automática de embeddings via OpenAI ao salvar
- [ ] Busca por texto (ilike)
- [ ] Cards com: título, preview do conteúdo, categoria, tags, data de atualização
- [ ] Isolamento por `organization_id` (RLS já configurado)

---

## Variáveis de ambiente

```
OPENAI_API_KEY=<já existe>
NEXT_PUBLIC_SUPABASE_URL=<já existe>
SUPABASE_SERVICE_ROLE_KEY=<já existe>
```

Não precisa de Upstash — usar pgvector nativo do Supabase.

---

## Regras do projeto

- Ler `AGENTS.md` antes de começar
- Usar `@/` alias para imports
- Seguir padrões existentes (TypeScript strict, Tailwind v4, Radix UI)
- Usar TanStack Query para state (padrão do CRM)
- Usar clients Supabase existentes em `lib/supabase/`
- Componentes em `features/knowledge/` ou `components/knowledge/`
- API routes em `app/api/knowledge/`
- Não quebrar features existentes
- Manter isolamento por `organization_id`

---

## Entregáveis

1. Migration SQL adicional (se precisar alterar tabela `documents` ou criar `knowledge_chunks`)
2. `lib/knowledge/` — embeddings, chunking, indexação, busca semântica
3. `app/api/knowledge/` — API routes CRUD + reindex
4. `app/(protected)/knowledge/page.tsx` — UI de gestão (ou `treinamento/`)
5. Hooks TanStack Query (`hooks/use-knowledge.ts`)
6. Item **"Treinamento"** no menu lateral (componente `Layout` ou sidebar)
7. Script/endpoint para gerar embeddings dos documentos seed existentes
8. Testar: criar entrada, verificar embedding gerado, buscar por similaridade

---

## Referência: como o n8n usa a base

O workflow n8n do Empório Fonseca tem uma tool `treinamento` (Supabase Vector Store node) que:
- Tabela: `documents`
- Modo: `retrieve-as-tool`
- Metadata filter: `{"organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}`
- Embeddings: OpenAI 1536 dimensões

A UI deve ser compatível com esse formato — ao salvar uma entrada, o embedding deve ser armazenado no campo `embedding` da tabela `documents` e os metadados no campo `metadata` JSONB com pelo menos `organization_id` e `category`.
