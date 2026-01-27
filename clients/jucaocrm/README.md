# JucãoCRM — Client Extension

Este diretório contém customizações específicas para o cliente **JucãoCRM**.

## Estrutura

```
clients/jucaocrm/
├── README.md                    # Este arquivo
├── index.ts                     # Entry point das customizações
├── config/
│   └── client.ts                # Configuração e feature flags
└── features/
    └── import-xlsx/             # Feature de importação XLSX
        ├── README.md
        ├── index.ts
        ├── types.ts
        ├── parser/
        │   └── parseXlsx.ts
        ├── services/
        │   └── importProductsFromXlsx.ts
        └── ui/
            ├── ImportProductsButton.tsx
            └── ProductsToolbarExtension.tsx
```

## Features

| Feature | Status | Descrição |
|---------|--------|-----------|
| `import-xlsx` | 🚧 Dev | Importação de produtos via XLSX |
| `custom-branding` | ⏳ Planejado | Branding customizado |

## Como Funciona

### 1. Sistema de Extensões

O código do cliente é **100% isolado** do core. A conexão acontece via `lib/client-extensions.tsx`:

```tsx
// No core, apenas UMA linha para habilitar extensões:
import { ClientExtensionSlot } from '@/lib/client-extensions';

<ClientExtensionSlot name="products-toolbar" props={{ ... }} />
```

### 2. Ativação por Ambiente

```bash
# .env ou .env.local
NEXT_PUBLIC_CLIENT_ID=jucaocrm
```

### 3. Feature Flags

```typescript
// clients/jucaocrm/config/client.ts
export const JUCAO_CONFIG = {
  features: {
    xlsxImport: true,      // ✅ Habilitada
    customBranding: false, // ❌ Desabilitada
  },
};
```

## Uso no Código

### Importar componentes do cliente

```typescript
import { ImportProductsButton, JUCAO_CONFIG } from '@/clients/jucaocrm';

// Verificar se feature está ativa
if (JUCAO_CONFIG.features.xlsxImport) {
  // ...
}
```

### Verificar cliente ativo (no core)

```typescript
import { isClient, isJucaoCRM } from '@/lib/client';

if (isJucaoCRM()) {
  // Código específico do JucãoCRM
}

// ou
if (isClient('jucaocrm')) {
  // ...
}
```

## Regras de Ouro

1. ❌ **Nunca** modificar código do core (`lib/`, `features/`, `app/`)
2. ❌ **Nunca** espalhar `if (CLIENT_ID === 'jucaocrm')` pelo código
3. ✅ **Sempre** usar o sistema de extensões (`ClientExtensionSlot`)
4. ✅ **Sempre** manter código isolado em `clients/jucaocrm/`
5. ✅ **Sempre** usar feature flags em vez de hardcode

## Branch de Trabalho

- **Branch**: `client/jucaocrm`
- **Base**: `main` (nossocrm core)
- **Deploy**: Vercel com `NEXT_PUBLIC_CLIENT_ID=jucaocrm`

## Origem das Features

- **import-xlsx**: Baseado em https://github.com/cirotrigo/Jucao
