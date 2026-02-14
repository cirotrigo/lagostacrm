# Plano de Implementação: Treinamento do Agente IA (RAG)

**Data:** 2026-02-14
**Status:** APROVADO (Revisado)
**Autor:** Claude Code
**Revisão:** v2 - Corrigido após revisão técnica

---

## Sumário Executivo

Este documento detalha o plano de implementação para habilitar o treinamento da base de conhecimento do agente de atendimento via RAG (Retrieval-Augmented Generation) no CRM. O gestor poderá fazer upload de PDFs, adicionar textos e criar pares de Q&A. O conteúdo será processado (chunking + embeddings) e armazenado no Supabase com pgvector. O agente n8n consultará essa base automaticamente.

---

## Decisões do Gestor (Confirmadas)

| Decisão | Valor |
|---------|-------|
| **Tamanho máximo de PDF** | 20MB |
| **Processamento** | Síncrono (V1) - simplificado após revisão |
| **Prioridade chave OpenAI** | Organização primeiro, depois usuário |
| **Limite de documentos** | Sem limite |

---

## 1. Análise do Estado Atual

### 1.1 Node RAG no n8n (Confirmado)

```json
{
  "name": "treinamento",
  "type": "@n8n/n8n-nodes-langchain.vectorStoreSupabase",
  "mode": "retrieve-as-tool",
  "tableName": "documents",
  "disabled": true
}
```

- **Embedding usado:** `@n8n/n8n-nodes-langchain.embeddingsOpenAi` (text-embedding-3-small, 1536 dims)
- **Tabela esperada:** `documents` (CRÍTICO: não mudar - bug #12906 n8n)
- **Function esperada:** `match_documents` (assinatura LangChain padrão)
- **Colunas esperadas:** `id`, `content`, `embedding`, `metadata`

### 1.2 Stack de IA Existente

| Componente | Localização | Uso |
|------------|-------------|-----|
| Chaves por usuário | `user_settings.ai_openai_key` | Chave individual |
| Chaves por org | `organization_settings.ai_openai_key` | Chave compartilhada |
| Toggle IA | `organization_settings.ai_enabled` | Liga/desliga IA |
| Settings UI | `features/settings/AICenterSettings.tsx` | Página atual |
| Upload pattern | `lib/supabase/dealFiles.ts` | Modelo para Storage |

### 1.3 Custo Estimado de Embeddings

- `text-embedding-3-small`: $0.02 / 1M tokens
- Cardápio típico (3000 palavras ≈ 4k tokens): ~$0.00008
- FAQ completo (50 pares Q&A ≈ 5k tokens): ~$0.0001
- **Custo total por restaurante: < $0.01**

---

## 2. Estrutura de Arquivos a Criar

```
supabase/migrations/
└── 20260217000000_ai_training_rag.sql          # Migration pgvector + tabelas

app/api/ai-training/
├── documents/
│   ├── route.ts                                 # GET (listar) + POST (upload PDF)
│   └── [id]/
│       ├── route.ts                             # GET (detalhes) + DELETE
│       └── reprocess/
│           └── route.ts                         # POST (reprocessar)
├── qa/
│   └── route.ts                                 # POST (criar par Q&A)
├── text/
│   └── route.ts                                 # POST (texto livre)
└── stats/
    └── route.ts                                 # GET (estatísticas)

lib/ai-training/
├── types.ts                                     # Interfaces TypeScript
├── embeddings.ts                                # OpenAI Embeddings API
├── chunker.ts                                   # Divisão em chunks
├── pdfExtractor.ts                              # Extração de texto de PDFs
└── processor.ts                                 # Orquestrador de processamento

features/ai-training/
├── AITrainingSection.tsx                        # Seção principal
├── components/
│   ├── DocumentList.tsx                         # Lista de documentos
│   ├── DocumentUpload.tsx                       # Drag-and-drop PDF
│   ├── QAEditor.tsx                             # Formulário Q&A
│   ├── TextEditor.tsx                           # Textarea texto livre
│   ├── TrainingStats.tsx                        # Cards de estatísticas
│   └── DocumentChunksPreview.tsx                # Modal debug chunks
└── hooks/
    ├── useTrainingDocuments.ts                  # CRUD documentos
    ├── useTrainingStats.ts                      # Estatísticas
    └── useProcessDocument.ts                    # Processamento
```

---

## 3. Migration SQL (CORRIGIDA)

### 3.1 Decisões Arquiteturais Pós-Revisão

| Item | Plano Original | Correção |
|------|----------------|----------|
| Chunks | Tabela `ai_training_chunks` + VIEW `documents` | Tabela real `documents` (compatibilidade n8n) |
| Function | `match_training_chunks` | `match_documents` (assinatura LangChain) |
| IVFFlat lists | 100 | 10 (adequado para < 10k rows) |
| RLS docs | Padrão A (aberto) | Padrão B (admin gerencia, membros leem) |
| Timestamp | `20260214000000` | `20260217000000` (após migrations existentes) |

### 3.2 SQL Completo

```sql
-- =============================================================================
-- AI Training / RAG - Base de Conhecimento do Agente
-- LagostaCRM
-- Migration: 20260217000000_ai_training_rag.sql
-- =============================================================================

-- 1. Extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. Tabela de metadados (gerenciada pelo CRM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_training_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    type TEXT NOT NULL CHECK (type IN ('pdf', 'text', 'qa')),
    title TEXT NOT NULL,
    content TEXT,
    source_file_url TEXT,
    source_file_name TEXT,

    question TEXT,
    answer TEXT,

    metadata JSONB DEFAULT '{}',

    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'error')),
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atd_org ON public.ai_training_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_atd_org_status ON public.ai_training_documents(organization_id, status);

ALTER TABLE public.ai_training_documents ENABLE ROW LEVEL SECURITY;

-- RLS Padrão B (admin gerencia, membros leem)
CREATE POLICY "Admins can manage training docs"
    ON public.ai_training_documents FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = ai_training_documents.organization_id
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = ai_training_documents.organization_id
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Members can view training docs"
    ON public.ai_training_documents FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = ai_training_documents.organization_id
        )
    );

-- Trigger updated_at
CREATE TRIGGER update_ai_training_docs_updated_at
    BEFORE UPDATE ON public.ai_training_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. Tabela `documents` — compatibilidade n8n (TABELA REAL, não VIEW)
-- O node vectorStoreSupabase SEMPRE usa tabela "documents" (bug #12906)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),

    -- FKs para rastreabilidade (não exigidas pelo n8n)
    training_doc_id UUID REFERENCES public.ai_training_documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index vetorial (lists=10 para < 10k rows)
CREATE INDEX IF NOT EXISTS idx_documents_embedding
    ON public.documents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_training_doc ON public.documents(training_doc_id);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON public.documents USING gin(metadata);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Padrão A (n8n acessa via service_role, frontend só lê)
CREATE POLICY "Enable all access for authenticated users"
    ON public.documents FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- =============================================================================
-- 4. Function match_documents — assinatura obrigatória para n8n/LangChain
-- =============================================================================
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_count int DEFAULT NULL,
    filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT
        id,
        content,
        metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE metadata @> filter
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_documents(vector, int, jsonb) TO anon, authenticated;

-- =============================================================================
-- 5. Storage bucket
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ai-training', 'ai-training', false, 20971520)  -- 20MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = 20971520;

-- Storage policies
CREATE POLICY "ai_training_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ai-training');

CREATE POLICY "ai_training_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'ai-training');

CREATE POLICY "ai_training_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'ai-training');
```

---

## 4. API Routes - Detalhamento

### 4.1 POST `/api/ai-training/documents`

**Input:** `FormData` com arquivo PDF

**Fluxo (Síncrono V1):**
1. Validar autenticação e organização
2. Validar arquivo (tipo PDF, tamanho max 20MB)
3. Inserir registro em `ai_training_documents` (status: `processing`)
4. Upload para Storage bucket `ai-training`
5. Download do PDF e extrair texto
6. Fazer chunking (~500 tokens, overlap 50)
7. Gerar embeddings em batch (OpenAI)
8. Inserir chunks na tabela `documents` com metadata incluindo `organization_id`
9. Atualizar documento: status='processed', chunk_count, total_tokens
10. Retornar documento processado

### 4.2 POST `/api/ai-training/text`

**Input:** `{ title: string, content: string }`

**Fluxo:**
1. Validar autenticação
2. Inserir documento (type: `text`, status: `processing`)
3. Fazer chunking
4. Gerar embeddings
5. Inserir chunks na tabela `documents`
6. Atualizar status para `processed`

### 4.3 POST `/api/ai-training/qa`

**Input:** `{ question: string, answer: string }`

**Fluxo:**
1. Validar autenticação
2. Criar documento (type: `qa`, status: `processing`)
3. Criar 1 chunk único com formato:
   ```
   Pergunta: {question}
   Resposta: {answer}
   ```
4. Gerar embedding para o chunk
5. Inserir na tabela `documents` com metadata:
   ```json
   {
     "organization_id": "uuid",
     "training_doc_id": "uuid",
     "doc_type": "qa",
     "title": "Pergunta sobre WiFi"
   }
   ```
6. Marcar como `processed`

### 4.4 GET `/api/ai-training/documents`

**Output:**
```typescript
{
  documents: Array<{
    id: string;
    type: 'pdf' | 'text' | 'qa';
    title: string;
    status: 'pending' | 'processing' | 'processed' | 'error';
    chunkCount: number;
    totalTokens: number;
    createdAt: string;
    errorMessage?: string;
  }>;
  stats: {
    totalDocuments: number;
    totalChunks: number;
    totalTokens: number;
  };
}
```

### 4.5 DELETE `/api/ai-training/documents/[id]`

**Fluxo:**
1. Buscar documento
2. Se tem `source_file_url`, deletar do Storage
3. Deletar documento (CASCADE remove chunks da tabela `documents`)

---

## 5. Lib de Processamento

### 5.1 `types.ts`

```typescript
export interface TrainingDocument {
  id: string;
  organizationId: string;
  type: 'pdf' | 'text' | 'qa';
  title: string;
  content: string | null;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  question: string | null;
  answer: string | null;
  status: 'pending' | 'processing' | 'processed' | 'error';
  errorMessage: string | null;
  chunkCount: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    organization_id: string;
    training_doc_id: string;
    doc_type: string;
    title: string;
    chunk_index: number;
  };
}
```

### 5.2 `embeddings.ts`

```typescript
interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<EmbeddingResult[]> {
  // POST https://api.openai.com/v1/embeddings
  // model: "text-embedding-3-small"
  // Batch de até 2048 textos por request
  // Retorna: array de { embedding: number[1536], tokenCount: number }
}
```

### 5.3 `chunker.ts`

```typescript
interface ChunkOptions {
  maxTokens?: number;     // default 500
  overlapTokens?: number; // default 50
}

export function chunkText(text: string, options?: ChunkOptions): string[] {
  // 1. Dividir por parágrafos (\n\n)
  // 2. Agrupar parágrafos até atingir maxTokens
  // 3. Manter overlap entre chunks
}

// Estimativa de tokens: text.length / 4 (aproximação para português)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

### 5.4 `pdfExtractor.ts`

```typescript
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Usar pdf-parse
  // Retorna texto concatenado de todas as páginas
}
```

### 5.5 `processor.ts`

```typescript
export async function processDocument(
  documentId: string,
  organizationId: string,
  apiKey: string
): Promise<void> {
  // 1. Buscar documento
  // 2. Atualizar status → 'processing'
  // 3. Se PDF: download do Storage → extrair texto
  // 4. Se Q&A: formatar pergunta/resposta
  // 5. Fazer chunking
  // 6. Gerar embeddings em batch
  // 7. Inserir chunks na tabela `documents` COM metadata:
  //    {
  //      organization_id: orgId,        // CRÍTICO para multi-tenancy
  //      training_doc_id: documentId,
  //      doc_type: document.type,
  //      title: document.title,
  //      chunk_index: i
  //    }
  // 8. Atualizar documento: status='processed', chunk_count, total_tokens
  // 9. Em caso de erro: status='error', error_message
}
```

---

## 6. Componentes Frontend

### 6.1 Integração em `AICenterSettings.tsx`

```tsx
// Adicionar import
import { AITrainingSection } from '@/features/ai-training/AITrainingSection';

// Após <AIFeaturesSection />
<div className="mt-8">
  <AITrainingSection />
</div>
```

### 6.2 Layout da Seção

```
┌─────────────────────────────────────────────────────────┐
│  🎓 Treinamento do Agente                               │
│  Base de conhecimento para o agente de atendimento      │
│                                                         │
│  ┌──────────┬──────────┬──────────┐                    │
│  │ 📄 12    │ 📦 148   │ 🔤 74.2k │                   │
│  │ Docs     │ Chunks   │ Tokens   │                    │
│  └──────────┴──────────┴──────────┘                    │
│                                                         │
│  ┌─── Adicionar Conteúdo ──────────────────────────┐   │
│  │ [📄 Upload PDF]  [💬 Q&A]  [📝 Texto]           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── Documentos ──────────────────────────────────┐   │
│  │ 📄 cardapio-2025.pdf       ✅ 32 chunks   [🗑️]  │   │
│  │ 💬 "Tem WiFi?"             ✅ 1 chunk     [🗑️]  │   │
│  │ 📝 Sobre o restaurante     ✅ 3 chunks    [🗑️]  │   │
│  │ 📄 menu-bebidas.pdf        ⏳ Processando...     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Componentes Detalhados

| Componente | Responsabilidade |
|------------|------------------|
| `AITrainingSection` | Container principal, gerencia estado global |
| `TrainingStats` | 3 cards com totais (docs, chunks, tokens) |
| `DocumentUpload` | Drag-and-drop + botão para PDFs |
| `QAEditor` | Modal/formulário para pergunta + resposta |
| `TextEditor` | Modal/formulário para título + textarea |
| `DocumentList` | Lista de documentos com status e ações |
| `DocumentChunksPreview` | Modal para ver chunks de um doc (debug) |

### 6.4 Hooks (React Query)

```typescript
// useTrainingDocuments.ts
export function useTrainingDocuments() {
  return useQuery(['ai-training-documents'], fetchDocuments, {
    refetchInterval: 3000, // Polling para atualizar status
  });
}

export function useCreateDocument() {
  return useMutation(createDocument, {
    onSuccess: () => queryClient.invalidateQueries(['ai-training-documents'])
  });
}

export function useDeleteDocument() {
  return useMutation(deleteDocument, {
    onSuccess: () => queryClient.invalidateQueries(['ai-training-documents'])
  });
}
```

---

## 7. Validações e Edge Cases

### 7.1 Sem Chave OpenAI Configurada

```typescript
// No processor.ts
const apiKey = orgSettings.ai_openai_key || userSettings.aiOpenaiKey;
if (!apiKey) {
  throw new Error('Chave OpenAI não configurada. Configure em Configurações > Central de I.A');
}
```

### 7.2 PDF Muito Grande

- **Limite:** 20MB
- **Validação:** No frontend (antes do upload) e no backend
- **Feedback:** Mensagem de erro clara

### 7.3 PDF Sem Texto (Imagem)

- PDFs escaneados sem OCR retornam texto vazio
- **Comportamento:** Marcar como erro com mensagem:
  > "Não foi possível extrair texto deste PDF. Verifique se não é uma imagem escaneada."

### 7.4 Erro de Rate Limit OpenAI

- Embeddings API tem rate limits
- **Comportamento:** Retry com backoff exponencial (3 tentativas)
- Se persistir, marcar documento como erro

### 7.5 Acesso Restrito

- Apenas admins podem criar/deletar documentos de treinamento
- Membros podem visualizar a lista (RLS Padrão B)
- Frontend deve esconder botões de ação para não-admins

---

## 8. Configuração do n8n (Pós-Implementação)

Após a implementação no CRM, o administrador deve:

1. **Ativar o node `treinamento`** no n8n:
   - Abrir workflow "[Coronel Picanha] Agente de atendimento"
   - Encontrar node "treinamento" (desabilitado)
   - Clicar no node → desabilitar o toggle "Disabled"

2. **Manter tableName como `documents`:**
   - NÃO mudar o Table Name (bug #12906 do n8n)
   - O node sempre usa a tabela `documents`

3. **Configurar metadata filter para multi-tenancy:**
   - No node, adicionar filter: `{"organization_id": "uuid-da-org"}`
   - Isso garante que cada restaurante só consulta seus próprios dados

4. **Atualizar toolDescription:**
   ```
   Use esta ferramenta para consultar informações sobre o restaurante,
   incluindo cardápio, horários, regras de reserva, promoções e perguntas frequentes.
   ```

5. **Testar:**
   - Subir um documento de teste no CRM
   - Perguntar ao agente algo relacionado ao documento
   - Verificar se o RAG retorna o contexto correto

---

## 9. Ordem de Implementação

### Fase 1: Infraestrutura (Backend)
1. [ ] Criar migration SQL `20260217000000_ai_training_rag.sql`
2. [ ] Rodar migration no Supabase
3. [ ] Verificar bucket `ai-training` criado
4. [ ] Criar `lib/ai-training/types.ts`
5. [ ] Criar `lib/ai-training/embeddings.ts`
6. [ ] Criar `lib/ai-training/chunker.ts`
7. [ ] Instalar e criar `lib/ai-training/pdfExtractor.ts`
8. [ ] Criar `lib/ai-training/processor.ts`

### Fase 2: API Routes
9. [ ] POST `/api/ai-training/qa`
10. [ ] POST `/api/ai-training/text`
11. [ ] POST `/api/ai-training/documents` (upload PDF)
12. [ ] GET `/api/ai-training/documents`
13. [ ] DELETE `/api/ai-training/documents/[id]`
14. [ ] GET `/api/ai-training/stats`

### Fase 3: Frontend
15. [ ] Criar `AITrainingSection.tsx`
16. [ ] Criar `TrainingStats.tsx`
17. [ ] Criar `QAEditor.tsx`
18. [ ] Criar `TextEditor.tsx`
19. [ ] Criar `DocumentUpload.tsx`
20. [ ] Criar `DocumentList.tsx`
21. [ ] Criar hooks (`useTrainingDocuments`, etc.)
22. [ ] Integrar em `AICenterSettings.tsx`

### Fase 4: Testes
23. [ ] Testar criação de Q&A
24. [ ] Testar criação de texto
25. [ ] Testar upload de PDF
26. [ ] Testar listagem e deleção
27. [ ] Verificar chunks na tabela `documents`
28. [ ] Testar `match_documents` manualmente no SQL

---

## 10. Dependências NPM

| Pacote | Versão | Uso |
|--------|--------|-----|
| `pdf-parse` | ^1.1.1 | Extração de texto de PDFs |

```bash
npm install pdf-parse
npm install -D @types/pdf-parse
```

---

## 11. NÃO Fazer (Escopo Negativo)

| Item | Motivo |
|------|--------|
| Modificar workflow n8n | Configuração manual pelo admin |
| Nova tab no SettingsPage | Seção fica dentro de "Central de I.A" |
| Busca semântica no frontend | Busca é feita pelo n8n |
| Usar LangChain no backend | Chamadas diretas à OpenAI são mais simples |
| Sistema de prompts editáveis | Prompt do agente fica no n8n |
| Feedback loop (P2) | Implementar depois do core funcionar |
| Tipo `url` (web scraping) | Reservado para P2 |

---

## 12. Checklist de Validação Final

### Banco de Dados
- [ ] `SELECT * FROM pg_extension WHERE extname = 'vector';` → existe
- [ ] `\d public.documents` → tabela real com `id`, `content`, `metadata`, `embedding`
- [ ] `\d public.ai_training_documents` → existe com RLS ativo
- [ ] `\df match_documents` → existe com assinatura `(vector, int, jsonb)`
- [ ] `\di idx_documents_embedding` → index ivfflat com lists=10
- [ ] Inserir chunk de teste e chamar `SELECT * FROM match_documents(...)` com sucesso
- [ ] Verificar bucket `ai-training` no Dashboard → Storage

### API
- [ ] POST `/api/ai-training/documents` aceita FormData
- [ ] POST `/api/ai-training/text` aceita JSON
- [ ] POST `/api/ai-training/qa` aceita JSON
- [ ] GET `/api/ai-training/documents` lista com stats
- [ ] DELETE remove doc + chunks + arquivo

### Processamento
- [ ] PDF extrai texto corretamente
- [ ] Chunking divide em ~500 tokens
- [ ] Embeddings geram 1536 dimensões
- [ ] Q&A vira 1 chunk único
- [ ] Status atualiza corretamente
- [ ] Metadata inclui `organization_id`
- [ ] Erro sem chave OpenAI é claro

### Frontend
- [ ] Seção aparece em Central de I.A
- [ ] Apenas admin vê botões de ação
- [ ] Stats exibem corretamente
- [ ] Upload PDF funciona
- [ ] Q&A funciona
- [ ] Texto livre funciona
- [ ] Lista mostra status
- [ ] Delete funciona

### Compatibilidade n8n (pós-implementação)
- [ ] Node `treinamento` ativado
- [ ] tableName mantido como `documents`
- [ ] metadata filter configurado com `organization_id`
- [ ] Teste: pergunta ao agente → RAG retorna contexto

### Qualidade
- [ ] `npm run typecheck` passa
- [ ] `npm run lint` sem warnings novos
- [ ] Componentes existentes não quebraram

---

## 13. Riscos de Sync Fork

### Contexto

O repositório `cirotrigo/lagostacrm` é fork de `thaleslaray/nossocrm`. A implementação fica na branch `project/lagostacrm`.

### Pontos de Atenção

| Item | Risco | Mitigação |
|------|-------|-----------|
| `AICenterSettings.tsx` | ALTO - único arquivo compartilhado modificado | Inserção mínima (1 import + 1 componente) |
| Tabela `documents` | BAIXO - nome genérico | Verificar upstream antes de sync |
| `lib/ai-training/*` | ZERO | Path exclusivo da branch |
| `features/ai-training/*` | ZERO | Path exclusivo da branch |
| `app/api/ai-training/*` | ZERO | Path exclusivo da branch |

### Checklist Pré-Sync Fork

- [ ] Verificar se upstream adicionou tabela `documents`
- [ ] Verificar se upstream adicionou function `match_documents`
- [ ] Verificar mudanças em `AICenterSettings.tsx`

---

**Status: APROVADO - Pronto para implementação**
