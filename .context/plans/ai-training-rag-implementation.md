# Plano de Implementação: Treinamento do Agente IA (RAG)

**Data:** 2026-02-14
**Status:** Aguardando Aprovação
**Autor:** Claude Code

---

## Sumário Executivo

Este documento detalha o plano de implementação para habilitar o treinamento da base de conhecimento do agente de atendimento via RAG (Retrieval-Augmented Generation) no CRM. O gestor poderá fazer upload de PDFs, adicionar textos e criar pares de Q&A. O conteúdo será processado (chunking + embeddings) e armazenado no Supabase com pgvector. O agente n8n consultará essa base automaticamente.

---

## 1. Análise do Estado Atual

### 1.1 Node RAG no n8n (Confirmado)

Analisei o workflow e confirmei:

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
- **Tabela esperada:** `documents`
- **Colunas esperadas:** `content`, `embedding`, `metadata`

### 1.2 Stack de IA Existente

| Componente | Localização | Uso |
|------------|-------------|-----|
| Chaves por usuário | `user_settings.ai_openai_key` | Chave individual |
| Chaves por org | `organization_settings.ai_openai_key` | Chave compartilhada |
| Toggle IA | `organization_settings.ai_enabled` | Liga/desliga IA |
| Settings UI | [AICenterSettings.tsx](features/settings/AICenterSettings.tsx) | Página atual |
| Upload pattern | [dealFiles.ts](lib/supabase/dealFiles.ts) | Modelo para Storage |

### 1.3 Decisão: Fonte da Chave OpenAI

Para embeddings, usarei a seguinte prioridade:
1. `organization_settings.ai_openai_key` (preferencial para custo compartilhado)
2. `user_settings.ai_openai_key` do usuário fazendo upload (fallback)
3. Se nenhuma existe → erro com link para `/settings/ai`

---

## 2. Estrutura de Arquivos a Criar

```
supabase/migrations/
└── 20260214000000_ai_training_rag.sql          # Migration pgvector + tabelas

app/api/ai-training/
├── documents/
│   ├── route.ts                                 # GET (listar) + POST (upload PDF)
│   └── [id]/
│       ├── route.ts                             # GET (detalhes) + DELETE
│       └── reprocess/
│           └── route.ts                         # POST (reprocessar)
├── process/
│   └── route.ts                                 # POST (processar documento - interno/async)
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

## 3. Migration SQL Detalhada

### 3.1 Extensão pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Nota:** O Supabase já suporta pgvector. Se por algum motivo a extensão não estiver disponível, será necessário habilitá-la no Dashboard > Database > Extensions.

### 3.2 Tabela: `ai_training_documents`

```sql
CREATE TABLE public.ai_training_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Tipo e conteúdo
    type TEXT NOT NULL CHECK (type IN ('pdf', 'text', 'qa', 'url')),
    title TEXT NOT NULL,
    content TEXT,                        -- texto original/extraído
    source_file_url TEXT,                -- URL no Storage (PDFs)
    source_file_name TEXT,               -- nome original do arquivo

    -- Q&A específico
    question TEXT,                       -- pergunta (type='qa')
    answer TEXT,                         -- resposta (type='qa')

    -- Metadados
    metadata JSONB DEFAULT '{}',

    -- Processamento
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'error')),
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    -- Timestamps
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Tabela: `ai_training_chunks`

```sql
CREATE TABLE public.ai_training_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.ai_training_documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Conteúdo e embedding
    content TEXT NOT NULL,
    embedding vector(1536),              -- OpenAI text-embedding-3-small

    -- Metadados (posição, página, etc)
    metadata JSONB DEFAULT '{}',
    token_count INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 VIEW: `documents` (Compatibilidade n8n)

```sql
CREATE OR REPLACE VIEW public.documents AS
SELECT
    id,
    content,
    embedding,
    metadata || jsonb_build_object(
        'organization_id', organization_id::text,
        'document_id', document_id::text
    ) AS metadata
FROM public.ai_training_chunks;
```

**Por que VIEW?** O node `vectorStoreSupabase` do n8n espera tabela `documents`. A VIEW mapeia `ai_training_chunks` para esse formato sem duplicar dados.

### 3.5 Índices

```sql
-- Busca vetorial (IVFFlat)
CREATE INDEX idx_atc_embedding ON public.ai_training_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Busca por organização
CREATE INDEX idx_atc_org ON public.ai_training_chunks(organization_id);
CREATE INDEX idx_atd_org ON public.ai_training_documents(organization_id);
CREATE INDEX idx_atd_org_status ON public.ai_training_documents(organization_id, status);
CREATE INDEX idx_atc_document ON public.ai_training_chunks(document_id);
```

### 3.6 RLS

```sql
ALTER TABLE public.ai_training_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users"
    ON public.ai_training_documents FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

ALTER TABLE public.ai_training_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users"
    ON public.ai_training_chunks FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
```

### 3.7 Function: `match_training_chunks`

```sql
CREATE OR REPLACE FUNCTION public.match_training_chunks(
    query_embedding vector(1536),
    match_count INT DEFAULT 5,
    filter_org_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.ai_training_chunks c
    WHERE (filter_org_id IS NULL OR c.organization_id = filter_org_id)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

---

## 4. API Routes - Detalhamento

### 4.1 POST `/api/ai-training/documents`

**Input:** `FormData` com arquivo PDF

**Fluxo:**
1. Validar autenticação e organização
2. Validar arquivo (tipo, tamanho max 10MB)
3. Inserir registro em `ai_training_documents` (status: `pending`)
4. Upload para Storage bucket `ai-training`
5. Disparar processamento assíncrono (pode ser síncrono para V1)
6. Retornar documento criado

### 4.2 POST `/api/ai-training/text`

**Input:** `{ title: string, content: string }`

**Fluxo:**
1. Validar autenticação
2. Inserir documento (type: `text`, status: `pending`)
3. Processar imediatamente (chunking + embeddings)
4. Atualizar status para `processed`

### 4.3 POST `/api/ai-training/qa`

**Input:** `{ question: string, answer: string }`

**Fluxo:**
1. Validar autenticação
2. Criar documento (type: `qa`)
3. Criar 1 chunk único com formato:
   ```
   Pergunta: {question}
   Resposta: {answer}
   ```
4. Gerar embedding para o chunk
5. Marcar como `processed`

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
3. Deletar documento (CASCADE remove chunks)

---

## 5. Lib de Processamento

### 5.1 `embeddings.ts`

```typescript
interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<EmbeddingResult[]> {
  // POST https://api.openai.com/v1/embeddings
  // model: "text-embedding-3-small"
  // Batch de até 2048 textos por request
}
```

### 5.2 `chunker.ts`

```typescript
interface ChunkOptions {
  maxTokens?: number;     // default 500
  overlapTokens?: number; // default 50
}

function chunkText(text: string, options?: ChunkOptions): string[] {
  // 1. Dividir por parágrafos (\n\n)
  // 2. Agrupar parágrafos até atingir maxTokens
  // 3. Manter overlap entre chunks
}
```

**Estimativa de tokens:** `text.length / 4` (aproximação para português)

### 5.3 `pdfExtractor.ts`

```typescript
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Usar pdf-parse (já é common em Node.js)
  // Retorna texto concatenado de todas as páginas
}
```

**Dependência a instalar:** `pdf-parse` (se não existir)

### 5.4 `processor.ts`

```typescript
async function processDocument(documentId: string): Promise<void> {
  // 1. Buscar documento
  // 2. Atualizar status → 'processing'
  // 3. Se PDF: download do Storage → extrair texto
  // 4. Se Q&A: formatar pergunta/resposta
  // 5. Fazer chunking
  // 6. Gerar embeddings em batch
  // 7. Inserir chunks no banco
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
function useTrainingDocuments() {
  return useQuery(['ai-training-documents'], fetchDocuments);
}

function useCreateDocument() {
  return useMutation(createDocument, {
    onSuccess: () => queryClient.invalidateQueries(['ai-training-documents'])
  });
}

function useDeleteDocument() {
  return useMutation(deleteDocument, {
    onSuccess: () => queryClient.invalidateQueries(['ai-training-documents'])
  });
}
```

---

## 7. Bucket de Storage

**Nome:** `ai-training`
**Público:** Não (requer autenticação)

Criar via Dashboard ou SQL:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-training', 'ai-training', false);
```

**Estrutura de arquivos:**
```
ai-training/
├── {organization_id}/
│   ├── {document_id}.pdf
│   └── ...
```

---

## 8. Ordem de Implementação

### Fase 1: Infraestrutura (Backend)
1. [ ] Criar migration SQL
2. [ ] Criar bucket no Supabase Storage
3. [ ] Criar `lib/ai-training/types.ts`
4. [ ] Criar `lib/ai-training/embeddings.ts`
5. [ ] Criar `lib/ai-training/chunker.ts`
6. [ ] Criar `lib/ai-training/pdfExtractor.ts`
7. [ ] Criar `lib/ai-training/processor.ts`

### Fase 2: API Routes
8. [ ] POST `/api/ai-training/qa`
9. [ ] POST `/api/ai-training/text`
10. [ ] POST `/api/ai-training/documents` (upload PDF)
11. [ ] GET `/api/ai-training/documents`
12. [ ] DELETE `/api/ai-training/documents/[id]`
13. [ ] GET `/api/ai-training/stats`

### Fase 3: Frontend
14. [ ] Criar `AITrainingSection.tsx`
15. [ ] Criar `TrainingStats.tsx`
16. [ ] Criar `QAEditor.tsx`
17. [ ] Criar `TextEditor.tsx`
18. [ ] Criar `DocumentUpload.tsx`
19. [ ] Criar `DocumentList.tsx`
20. [ ] Criar hooks (`useTrainingDocuments`, etc.)
21. [ ] Integrar em `AICenterSettings.tsx`

### Fase 4: Testes e Ajustes
22. [ ] Testar upload de PDF
23. [ ] Testar criação de Q&A
24. [ ] Testar criação de texto
25. [ ] Testar listagem e deleção
26. [ ] Verificar chunks no banco

---

## 9. Dependências NPM

| Pacote | Versão | Uso |
|--------|--------|-----|
| `pdf-parse` | ^1.1.1 | Extração de texto de PDFs |

**Verificar se já existe:** O projeto pode já ter uma dependência de PDF. Se não:
```bash
npm install pdf-parse
npm install -D @types/pdf-parse
```

---

## 10. Validações e Edge Cases

### 10.1 Sem Chave OpenAI Configurada

```typescript
// No processor.ts
const apiKey = orgSettings.ai_openai_key || userSettings.aiOpenaiKey;
if (!apiKey) {
  throw new Error('Chave OpenAI não configurada. Configure em Configurações > Central de I.A');
}
```

### 10.2 PDF Muito Grande

- **Limite:** 20MB
- **Validação:** No frontend (antes do upload) e no backend
- **Feedback:** Mensagem de erro clara

### 10.3 PDF Sem Texto (Imagem)

- PDFs escaneados sem OCR retornam texto vazio
- **Comportamento:** Marcar como erro com mensagem:
  > "Não foi possível extrair texto deste PDF. Verifique se não é uma imagem escaneada."

### 10.4 Erro de Rate Limit OpenAI

- Embeddings API tem rate limits
- **Comportamento:** Retry com backoff exponencial (3 tentativas)
- Se persistir, marcar documento como erro

---

## 11. Configuração do n8n (Pós-Implementação)

Após a implementação no CRM, o administrador deve:

1. **Ativar o node `treinamento`** no n8n:
   - Abrir workflow "[Coronel Picanha] Agente de atendimento"
   - Encontrar node "treinamento" (desabilitado)
   - Clicar no node → desabilitar o toggle "Disabled"

2. **Verificar tableName:**
   - Se o node aceita configurar a tabela, mudar para `ai_training_chunks`
   - Se não aceita, usar a VIEW `documents` (já criada na migration)

3. **Atualizar toolDescription:**
   ```
   Use esta ferramenta para consultar informações sobre o restaurante Coronel Picanha,
   incluindo cardápio, horários, regras de reserva, promoções e perguntas frequentes.
   ```

4. **Testar:**
   - Subir um documento de teste no CRM
   - Perguntar ao agente algo relacionado ao documento
   - Verificar se o RAG retorna o contexto correto

---

## 12. NÃO Fazer (Escopo Negativo)

| Item | Motivo |
|------|--------|
| Modificar workflow n8n | Configuração manual pelo admin |
| Nova tab no SettingsPage | Seção fica dentro de "Central de I.A" |
| Busca semântica no frontend | Busca é feita pelo n8n |
| Usar LangChain no backend | Chamadas diretas à OpenAI são mais simples |
| Sistema de prompts editáveis | Prompt do agente fica no n8n |
| Feedback loop (P2) | Implementar depois do core funcionar |

---

## 13. Checklist de Validação Final

### Migration e Banco
- [ ] Extensão `vector` habilitada
- [ ] Tabela `ai_training_documents` com RLS
- [ ] Tabela `ai_training_chunks` com index vetorial
- [ ] VIEW `documents` criada
- [ ] Function `match_training_chunks` criada
- [ ] Trigger `updated_at` funciona
- [ ] Bucket `ai-training` criado

### API
- [ ] POST documentos aceita FormData
- [ ] POST text aceita JSON
- [ ] POST qa aceita JSON
- [ ] GET lista documentos com stats
- [ ] DELETE remove doc + chunks + arquivo

### Processamento
- [ ] PDF extrai texto corretamente
- [ ] Chunking divide em ~500 tokens
- [ ] Embeddings geram 1536 dimensões
- [ ] Q&A vira 1 chunk único
- [ ] Status atualiza corretamente
- [ ] Erro sem chave OpenAI é claro

### Frontend
- [ ] Seção aparece em Central de I.A
- [ ] Stats exibem corretamente
- [ ] Upload PDF funciona
- [ ] Q&A funciona
- [ ] Texto livre funciona
- [ ] Lista mostra status
- [ ] Delete funciona

### Qualidade
- [ ] `npm run typecheck` passa
- [ ] `npm run lint` sem warnings novos
- [ ] Componentes existentes não quebraram

---

## 14. Decisões do Gestor (Confirmadas)

| Decisão | Valor |
|---------|-------|
| **Tamanho máximo de PDF** | 20MB |
| **Processamento** | Assíncrono (background) |
| **Prioridade chave OpenAI** | Organização primeiro, depois usuário |
| **Limite de documentos** | Sem limite |

---

## 15. Detalhes do Processamento Assíncrono

### Fluxo

```
1. Upload → Salva documento (status: 'pending') → Retorna imediatamente
2. Background job processa:
   - status: 'pending' → 'processing'
   - Extrai texto (se PDF)
   - Chunking + Embeddings
   - status: 'processing' → 'processed' (ou 'error')
3. Frontend faz polling ou usa realtime para atualizar status
```

### Implementação

**Opção escolhida:** Processamento em API Route separada com `fetch` fire-and-forget

```typescript
// Em POST /api/ai-training/documents
// Após salvar documento:
fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai-training/process`, {
  method: 'POST',
  body: JSON.stringify({ documentId }),
  headers: { 'Content-Type': 'application/json' }
}).catch(() => {}); // Fire and forget

return NextResponse.json({ document, message: 'Processando em background...' });
```

**Nova rota:** `POST /api/ai-training/process`
- Rota interna que processa um documento
- Não exposta ao frontend diretamente
- Atualiza status no banco conforme progresso

**Frontend:**
- Polling a cada 3 segundos na lista de documentos
- Ou usar Supabase Realtime para updates instantâneos

---

**Status: APROVADO - Pronto para implementação**
