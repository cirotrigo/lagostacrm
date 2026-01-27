# JucãoCRM — Client Extension

Este diretório contém customizações específicas para o cliente **JucãoCRM**.

## Estrutura

```
clients/jucaocrm/
├── README.md          # Este arquivo
├── features/          # Features exclusivas do JucãoCRM
│   └── .gitkeep
├── config/            # Configurações específicas do cliente
│   └── client.ts      # Definição do cliente
└── index.ts           # Entry point das customizações
```

## Features Planejadas

- [ ] Importação de produtos via XLSX (baseado em https://github.com/cirotrigo/Jucao)
- [ ] Customizações de UI específicas
- [ ] Integrações exclusivas

## Como usar

Este módulo é carregado condicionalmente via `CLIENT_ID=jucaocrm`.

### Ambiente de Desenvolvimento

```bash
# No .env.local
CLIENT_ID=jucaocrm
```

### Verificar cliente ativo

```typescript
import { getClientId, isClient } from '@/lib/client';

if (isClient('jucaocrm')) {
  // Código específico do JucãoCRM
}
```

## Branch de Trabalho

- **Branch**: `client/jucaocrm`
- **Origem**: Fork de `main` (nossocrm upstream)
- **Produção**: Vercel deployment específico

## Regras

1. Features aqui são EXCLUSIVAS do JucãoCRM
2. Não misturar com código do LagostaCRM
3. Manter compatibilidade com core (main)
