# Import XLSX Feature — JucãoCRM

Feature para importação de produtos via arquivos Excel (.xlsx).

## Status

🚧 **Em desenvolvimento** — Estrutura pronta, aguardando código do repositório origem.

## Estrutura

```
import-xlsx/
├── README.md                           # Este arquivo
├── index.ts                            # Entry point da feature
├── types.ts                            # Tipos TypeScript
├── parser/
│   └── parseXlsx.ts                    # Parser de arquivos XLSX
├── services/
│   └── importProductsFromXlsx.ts       # Serviço de importação
└── ui/
    ├── ImportProductsButton.tsx        # Botão + Modal de importação
    └── ProductsToolbarExtension.tsx    # Extensão da toolbar de produtos
```

## Como usar

### 1. O botão aparece automaticamente

Quando `NEXT_PUBLIC_CLIENT_ID=jucaocrm`, o sistema de extensões carrega automaticamente o botão de importação na página de produtos.

### 2. Importação manual (se necessário)

```tsx
import { ImportProductsButton } from '@/clients/jucaocrm/features/import-xlsx';

<ImportProductsButton
  onImportComplete={(result) => {
    console.log(`${result.imported} produtos importados!`);
    // Recarregar lista de produtos...
  }}
/>
```

### 3. Usando o parser diretamente

```tsx
import { parseXlsx, importProductsFromXlsx } from '@/clients/jucaocrm/features/import-xlsx';

// Parsear arquivo
const parseResult = await parseXlsx(file);

if (parseResult.success) {
  // Importar para o banco
  const importResult = await importProductsFromXlsx(parseResult.data);
}
```

## Integração com o Core

A feature se conecta ao core via **slot de extensão** (sem modificar código do core):

```tsx
// No ProductsCatalogManager (core), adicionar UMA linha:
import { ClientExtensionSlot } from '@/lib/client-extensions';

// Na toolbar:
<ClientExtensionSlot
  name="products-toolbar"
  props={{ onImportComplete: load, disabled: loading }}
/>
```

## Configuração

A feature é controlada pela config do cliente:

```typescript
// clients/jucaocrm/config/client.ts
export const JUCAO_CONFIG = {
  features: {
    xlsxImport: true,  // ← Habilita/desabilita
  },
};
```

## Formato do XLSX esperado

| Coluna      | Obrigatório | Descrição                |
|-------------|-------------|--------------------------|
| Nome        | ✅          | Nome do produto          |
| Preço       | ❌          | Preço unitário (R$)      |
| SKU         | ❌          | Código do produto        |
| Descrição   | ❌          | Descrição curta          |

> **Nota:** O mapeamento exato de colunas será definido após análise do repositório origem.

## TODO

- [ ] Implementar parser real com biblioteca `xlsx` ou `exceljs`
- [ ] Mapear colunas do formato original
- [ ] Adicionar validação de dados
- [ ] Preview com edição antes de importar
- [ ] Suporte a atualização de produtos existentes (por SKU)
- [ ] Exportação XLSX (futuro)

## Dependências necessárias

```bash
# Quando for implementar:
pnpm add xlsx
# ou
pnpm add exceljs
```

## Origem

Baseado em: https://github.com/cirotrigo/Jucao (a ser extraído)
