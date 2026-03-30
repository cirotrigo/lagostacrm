# Guia: Adicionar Novo Cliente ao LagostaCRM

## Arquitetura

O LagostaCRM usa **trunk-based development** com branch única `main`. Cada cliente é um deploy Vercel separado com `CLIENT_ID` diferente. O código é compartilhado; a personalização vem de:

1. **`clients/[id]/`** — Landing page, seeds, workflows (no código)
2. **`organization_settings`** — Branding, features (no banco de dados)
3. **`CLIENT_ID`** — Variável de ambiente no Vercel (identifica o cliente)

---

## Passo 1 — Código (10 min)

### 1.1 Criar diretório do cliente

```bash
mkdir -p clients/[id]/public-page clients/[id]/seeds clients/[id]/workflows
```

### 1.2 Criar `clients/[id]/config.ts`

```typescript
import type { ClientConfig } from '../types';

const config: ClientConfig = {
  id: '[id]',
  name: 'Nome do Cliente',
  shortName: 'Cliente',
  initial: 'C',
  description: 'Descrição curta',
  primaryColor: '#HEX_COR',
  hasPublicLanding: true,   // true = tem landing page, false = redirect /login
  hasDigitalMenu: true,     // true = tem cardápio digital
  metadata: {
    title: 'Nome — Tagline',
    description: 'Descrição para SEO',
  },
};

export default config;
```

### 1.3 Criar Landing Page (opcional)

Se `hasPublicLanding: true`, criar `clients/[id]/public-page/LandingPage.tsx`:

```typescript
'use client';

import { PublicLayout } from '@/components/public/PublicLayout';
// Importar componentes compartilhados ou criar novos aqui

export default function LandingPage({ featured = [] }: { featured?: any[] }) {
  return (
    <PublicLayout>
      {/* Conteúdo da landing page do cliente */}
    </PublicLayout>
  );
}
```

**Dica**: copie de `clients/emporiofonseca/public-page/LandingPage.tsx` e customize.

### 1.4 Registrar no resolver

Editar `clients/index.ts` — adicionar import do config e case no switch:

```typescript
// No topo, adicionar:
import novoClienteConfig from './[id]/config';

// No objeto configs:
const configs: Record<string, ClientConfig> = {
  // ... existentes
  [id]: novoClienteConfig,
};

// No switch do getClientPublicPage:
case '[id]': {
  const mod = await import('./[id]/public-page/LandingPage');
  return mod.default;
}
```

### 1.5 Adicionar ao ClientId type

Editar `lib/client.ts`:

```typescript
export type ClientId = 'jucaocrm' | 'lagostacrm' | 'coronelpicanha' | 'emporiofonseca' | '[id]' | 'default';
export const SUPPORTED_CLIENTS: ClientId[] = [..., '[id]', 'default'];
```

### 1.6 Adicionar fallback de branding

Editar `lib/branding.ts` — adicionar entrada no `BRAND_CONFIG`:

```typescript
[id]: {
  name: 'Nome do Cliente',
  shortName: 'Cliente',
  initial: 'C',
  description: 'Descrição',
  primaryColor: '#HEX',
},
```

### 1.7 Commit e push

```bash
git add clients/[id]/ lib/client.ts lib/branding.ts clients/index.ts
git commit -m "feat(client): add [nome do cliente] client configuration"
git push origin main
```

---

## Passo 2 — Vercel (5 min)

1. Criar novo projeto no Vercel
2. Conectar ao repositório `cirotrigo/lagostacrm`
3. Branch: **main**
4. Environment Variables (Production):

```
CLIENT_ID=[id]
NEXT_PUBLIC_CLIENT_ID=[id]
NEXT_PUBLIC_SUPABASE_URL=https://bmaacpemxgoiimttyvar.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]
INSTALLER_ENABLED=true
```

5. Deploy e acessar `/install`

---

## Passo 3 — Installer (5 min)

1. Acessar `https://[deploy].vercel.app/install`
2. Informar Supabase Access Token
3. Criar nova organização OU selecionar existente
4. Criar admin user (email + senha)
5. Após instalação, atualizar env no Vercel: `INSTALLER_ENABLED=false`

---

## Passo 4 — Configurar Branding no CRM (5 min)

1. Login no CRM como admin
2. Ir em **Configurações → Branding**
3. Definir: nome, cor primária, logo, descrição
4. Salvar

---

## Passo 5 — Configurar Board (10 min)

1. Ir em **Configurações → Boards**
2. Criar board com os stages adequados:
   - Para restaurante: Triagem, Reserva de Mesas, Planejamento de Eventos, Pedidos Retirada, Atendimento Humano, Confirmação
   - Para outro tipo: personalizar conforme necessidade
3. Anotar o `board_key` (usado no n8n)

---

## Passo 6 — Chatwoot (10 min)

1. No Chatwoot, criar inbox para o novo cliente (Instagram/WhatsApp)
2. Anotar o `inbox_id`
3. No CRM, ir em **Configurações → Integrações → WhatsApp**
4. Configurar: Chatwoot URL, API token, account_id, inbox_id
5. Salvar (cria registro em `messaging_channel_configs`)

---

## Passo 7 — n8n Workflow (30 min)

1. Duplicar workflow `[Emporio Fonseca] Agente de atendimento Sofia`
2. Renomear para `[Novo Cliente] Agente de atendimento`
3. Atualizar:
   - `Fluxo_Variaveis`: CRM-Host, CRM-BoardKey, CW-Host, CW-Account, inbox_id
   - `Agente de IA`: system prompt personalizado
   - Credenciais: criar nova "Header Auth" com X-Api-Key do novo CRM
   - `treinamento`: Supabase credential + organization_id no metadata filter
4. Ativar workflow

---

## Passo 8 — Conteúdo (30 min)

### Produtos/Cardápio
- Acessar CRM → **Produtos**
- Cadastrar itens com nome, preço, categoria e tags semânticas

### Base de Conhecimento
- Acessar CRM → **Treinamento**
- Cadastrar informações do negócio (horários, políticas, FAQ)
- Gerar embeddings: Console → `fetch('/api/knowledge/generate-embeddings', {method:'POST'})`

---

## Estrutura de Diretórios

```
clients/
  [id]/
    config.ts              # Configuração do cliente
    public-page/
      LandingPage.tsx      # Landing page (opcional)
      [componentes].tsx    # Componentes específicos
    seeds/
      seed_cardapio.sql    # Produtos iniciais (opcional)
      seed_knowledge.sql   # Knowledge base inicial (opcional)
    workflows/
      prompt_agente.md     # System prompt do agente IA
      tools_agente.md      # Documentação das tools
```

---

## Checklist Rápido

- [ ] `clients/[id]/config.ts` criado
- [ ] `clients/[id]/public-page/LandingPage.tsx` criado (se landing)
- [ ] `clients/index.ts` atualizado (config + switch)
- [ ] `lib/client.ts` — ClientId type + SUPPORTED_CLIENTS
- [ ] `lib/branding.ts` — BRAND_CONFIG fallback
- [ ] Vercel: projeto criado, `CLIENT_ID` configurado, branch `main`
- [ ] Installer: `/install` executado, admin criado
- [ ] Branding configurado no CRM
- [ ] Board criado com stages
- [ ] Chatwoot: inbox criado + `messaging_channel_configs`
- [ ] n8n: workflow duplicado e configurado
- [ ] Produtos cadastrados
- [ ] Knowledge base cadastrada + embeddings gerados
