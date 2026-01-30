# LagostaCRM - Contexto do Projeto

> **Este arquivo fornece contexto essencial sobre o projeto para AI assistants.**
> Leia este arquivo para entender a arquitetura, decisões técnicas e escopo do projeto.

---

## Visão Geral

### O que é o LagostaCRM?
LagostaCRM é um **fork personalizado** do projeto [NossoCRM](https://github.com/thaleslaray/nossocrm), adaptado para necessidades específicas mantendo compatibilidade com o upstream.

### Estrutura de Repositórios
```
[UPSTREAM] thaleslaray/nossocrm
     │
     ▼ (fork)
[ORIGIN] cirotrigo/lagostacrm
     │
     ├── main (espelho do upstream - NÃO TOCAR)
     │
     └── project/lagostacrm (desenvolvimento)
```

### Objetivo do Fork
- Manter funcionalidades do NossoCRM original
- Adicionar personalizações específicas para LagostaCRM
- Receber atualizações do upstream sem conflitos
- Permitir múltiplas variantes (ex: `client/jucaocrm`)

---

## Stack Técnica

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI**: React com componentes customizados
- **Estilização**: Tailwind CSS
- **Estado**: React Context / useState

### Backend
- **API**: Next.js API Routes
- **Banco de Dados**: PostgreSQL (via Prisma ORM)
- **Autenticação**: [verificar implementação]

### Infraestrutura
- **Hospedagem**: Vercel
- **Production Branch**: `project/lagostacrm`
- **Banco de Dados**: [verificar provider]
- **Deploy**: Automático via Git push
  - Push em `project/lagostacrm` → **Produção**
  - Push em outras branches → Preview

---

## Estrutura de Pastas

```
lagostacrm/
├── .context/           # Documentação para AI (ESTE DIRETÓRIO)
│   ├── AI_GUARDRAILS.md
│   ├── PROJECT_CONTEXT.md
│   └── docs/
├── app/                # App Router (Next.js 14+)
│   ├── api/           # API Routes
│   └── (páginas)/     # Páginas da aplicação
├── components/         # Componentes React reutilizáveis
├── lib/               # Utilitários e configurações
├── prisma/            # Schema e migrations do banco
├── public/            # Assets estáticos
└── styles/            # Estilos globais
```

---

## Padrões de Código

### Nomenclatura
- **Componentes**: PascalCase (`UserCard.tsx`)
- **Hooks**: camelCase com prefixo use (`useDeals.ts`)
- **Utilitários**: camelCase (`formatCurrency.ts`)
- **Constantes**: UPPER_SNAKE_CASE (`API_ENDPOINTS`)

### Arquivos
- Componentes React: `.tsx`
- Utilitários TypeScript: `.ts`
- Estilos: Tailwind inline ou `.css` quando necessário

### Imports
Ordem preferida:
1. React/Next.js
2. Bibliotecas externas
3. Componentes internos
4. Utilitários/helpers
5. Tipos

---

## Funcionalidades Principais

### CRM Core
- Gestão de deals/negócios
- Pipeline de vendas
- Gestão de contatos
- Histórico de interações

### Personalizações LagostaCRM
[Documentar aqui as personalizações específicas]

---

## Variáveis de Ambiente

### Obrigatórias
```env
DATABASE_URL=           # Conexão PostgreSQL
NEXTAUTH_SECRET=        # Secret para autenticação
NEXTAUTH_URL=           # URL base da aplicação
```

### Opcionais
```env
# Adicionar conforme necessário
```

### Segurança
- **NUNCA** commitar arquivos `.env`
- Usar `.env.example` como template
- Variáveis sensíveis apenas via Vercel Dashboard

---

## Decisões Arquiteturais

### Por que fork ao invés de template?
- Permite receber atualizações do upstream
- Mantém histórico de mudanças do projeto original
- Facilita contribuições de volta ao upstream

### Por que branch `project/*` ao invés de `develop`?
- Permite múltiplas variantes do projeto
- Cada cliente pode ter sua branch (`client/*`)
- Branch `main` permanece limpa para sync

---

## Dependências Críticas

| Pacote | Versão | Uso |
|--------|--------|-----|
| next | 14.x | Framework principal |
| prisma | X.x | ORM do banco de dados |
| tailwindcss | X.x | Estilização |

---

## Links Úteis

- [Upstream NossoCRM](https://github.com/thaleslaray/nossocrm)
- [Documentação Next.js](https://nextjs.org/docs)
- [Documentação Prisma](https://www.prisma.io/docs)
- [Documentação Tailwind](https://tailwindcss.com/docs)

---

## Notas para AI Assistants

### Ao implementar funcionalidades:
1. Verificar se existe no upstream primeiro
2. Seguir padrões existentes no código
3. Preferir modificação a criação de novos arquivos
4. Manter compatibilidade com futuras atualizações upstream

### Ao resolver bugs:
1. Identificar se o bug é do upstream ou da personalização
2. Se for upstream, considerar PR para o projeto original
3. Se for personalização, documentar a correção

### Ao refatorar:
1. Manter retrocompatibilidade
2. Não alterar interfaces públicas sem necessidade
3. Documentar breaking changes
