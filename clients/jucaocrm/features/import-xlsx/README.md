# Import XLSX Feature — JucãoCRM

Feature para importação de produtos via arquivos Excel (.xlsx) com processamento assíncrono via N8N.

## Status

🟢 **Phase 3 Completa** — Services, API Routes e integração N8N implementados.

## Estrutura

```
import-xlsx/
├── README.md                           # Este arquivo
├── index.ts                            # Entry point da feature
├── types.ts                            # Tipos TypeScript
├── constants.ts                        # Mapeamento de colunas XLSX
├── parser/
│   ├── parseXlsx.ts                    # Parser de arquivos XLSX
│   └── normalizers.ts                  # Funções de normalização
├── services/
│   ├── importProductsFromXlsx.ts       # Importação direta (fallback)
│   ├── importJobService.ts             # CRUD de jobs de importação
│   ├── stagingService.ts               # Operações na tabela staging
│   └── webhookService.ts               # Disparo de webhooks N8N
└── ui/
    ├── ImportProductsButton.tsx        # Botão + Modal de importação
    └── ProductsToolbarExtension.tsx    # Extensão da toolbar de produtos
```

## API Endpoints

Todas as rotas estão em `/api/clients/jucaocrm/import/`:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/clients/jucaocrm/import` | Upload e parse do arquivo XLSX |
| GET | `/api/clients/jucaocrm/import` | Lista jobs de importação |
| GET | `/api/clients/jucaocrm/import/[jobId]` | Status de um job específico |
| DELETE | `/api/clients/jucaocrm/import/[jobId]` | Cancela/deleta um job |
| POST | `/api/clients/jucaocrm/import/[jobId]/start` | Inicia processamento via N8N |
| POST | `/api/clients/jucaocrm/import/callback` | Callback do N8N (progress/complete/error) |

## Fluxo de Importação

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 1: UPLOAD & PARSE (Browser → API)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Usuário seleciona arquivo .xlsx                                     │
│  2. POST /api/clients/jucaocrm/import com FormData                      │
│  3. API parseia arquivo com xlsx.js                                     │
│  4. Cria ImportJob (status: 'queued')                                   │
│  5. Insere rows em import_staging (batch de 1000)                       │
│  6. Retorna jobId para o browser                                        │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 2: TRIGGER N8N (Browser → API → N8N)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  7. POST /api/clients/jucaocrm/import/[jobId]/start                     │
│  8. API atualiza ImportJob.status → 'processing'                        │
│  9. API chama webhook N8N com { jobId, organizationId, callbackUrl }    │
│  10. N8N inicia workflow de processamento                               │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 3: PROCESSAMENTO (N8N)                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  11. N8N busca batch de 100 rows de import_staging (processed=false)    │
│  12. Para cada row:                                                     │
│      - Verifica se SKU existe em products                               │
│      - Se existe: UPDATE                                                │
│      - Se não: INSERT                                                   │
│      - Marca staging row como processed=true                            │
│  13. N8N chama callback com progresso                                   │
│  14. Repete até todas as rows processadas                               │
│  15. N8N chama callback com action='complete'                           │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 4: FEEDBACK (Browser)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  16. Browser faz polling GET /api/clients/jucaocrm/import/[jobId]       │
│  17. UI mostra barra de progresso (processedRows / totalRows)           │
│  18. Quando status == 'completed':                                      │
│      - Mostra resumo (created, updated, errors)                         │
│      - Dispara 'crm:products-updated'                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuração N8N

### Variáveis de Ambiente

```bash
# URL do webhook N8N para processamento
N8N_WEBHOOK_IMPORT_PRODUCTS=https://seu-n8n.com/webhook/import-products

# Secret compartilhado (opcional mas recomendado)
N8N_WEBHOOK_SECRET=seu-secret-seguro

# URL da aplicação (para callback)
NEXT_PUBLIC_APP_URL=https://seu-app.com
```

### Workflow N8N Recomendado

O workflow N8N deve:

1. **Webhook Trigger**: Receber `{ jobId, organizationId, callbackUrl }`

2. **Loop de Processamento**:
   ```javascript
   // Pseudo-código do workflow N8N

   // 1. Buscar batch de staging
   const batch = await supabase
     .from('import_staging')
     .select()
     .eq('job_id', jobId)
     .eq('processed', false)
     .limit(100);

   // 2. Processar cada item
   for (const row of batch) {
     try {
       // Verificar se SKU existe
       const existing = await supabase
         .from('products')
         .select('id')
         .eq('organization_id', organizationId)
         .eq('sku', row.sku)
         .single();

       if (existing) {
         // UPDATE
         await supabase.from('products').update({
           name: row.name,
           price: row.price,
           description: row.description,
         }).eq('id', existing.id);
         updatedCount++;
       } else {
         // INSERT
         await supabase.from('products').insert({
           organization_id: organizationId,
           name: row.name,
           price: row.price,
           sku: row.sku,
           description: row.description,
         });
         createdCount++;
       }

       // Marcar como processado
       await supabase.from('import_staging')
         .update({ processed: true })
         .eq('id', row.id);

     } catch (error) {
       // Marcar erro
       await supabase.from('import_staging')
         .update({ processed: true, error: error.message })
         .eq('id', row.id);
       errorCount++;
     }
   }

   // 3. Callback de progresso
   await fetch(callbackUrl, {
     method: 'POST',
     headers: { 'X-Webhook-Secret': secret },
     body: JSON.stringify({
       jobId,
       action: 'progress',
       progress: { processedRows, createdCount, updatedCount, errorCount }
     })
   });

   // 4. Se ainda há pendentes, loop novamente
   // 5. Se completo, callback final
   ```

3. **Callback de Conclusão**:
   ```javascript
   await fetch(callbackUrl, {
     method: 'POST',
     headers: { 'X-Webhook-Secret': secret },
     body: JSON.stringify({
       jobId,
       action: 'complete',
       progress: { /* totais finais */ }
     })
   });
   ```

## Uso Direto (sem N8N)

Para importações pequenas (< 1000 produtos), use o modo direto:

```tsx
import {
  parseXlsxToProducts,
  importProductsFromXlsx
} from '@/clients/jucaocrm/features/import-xlsx';

// Parsear arquivo
const parseResult = await parseXlsxToProducts(file);

if (parseResult.products.length > 0) {
  // Importar diretamente
  const result = await importProductsFromXlsx(parseResult.products, {
    onProgress: (progress) => console.log(`${progress.processedRows} processados`),
    onComplete: (result) => console.log(`${result.imported} importados`),
  });
}
```

## Formato do XLSX

### Headers Suportados

O parser detecta automaticamente colunas com os seguintes nomes (case-insensitive, com ou sem acentos):

| Campo | Headers Aceitos |
|-------|-----------------|
| SKU | `codigo`, `código`, `code`, `sku`, `ref`, `referencia` |
| Nome | `descricao`, `descrição`, `nome`, `name`, `produto` |
| Preço | `venda`, `preco`, `preço`, `price`, `valor` |
| Descrição | `obs`, `observacao`, `observação`, `notes`, `notas` |

### Fallback Posicional

Se os headers não forem detectados, o parser usa índices posicionais (baseado no formato do sistema origem):

| Índice | Campo |
|--------|-------|
| 0 | SKU (Código) |
| 3 | Nome (Descrição) |
| 13 | Preço (Venda) |

## Tabelas do Banco

### import_jobs

```sql
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'queued',  -- queued, processing, completed, failed
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
```

### import_staging

```sql
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
```

## Origem

Extraído e adaptado de: https://github.com/cirotrigo/Jucao
