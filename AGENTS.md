# AGENTS.md — CRM Empório (Empório Fonseca)

## Project Identity
- **Deploy**: `emporiofonseca` — Fork dedicated to Empório Fonseca
- **Vercel Project**: `https://vercel.com/cirotrigos-projects/emporio_fonseca`
- **URL**: `https://emporiofonseca.vercel.app`
- **CLIENT_ID**: `emporiofonseca` (default fallback in `lib/client.ts`)
- **Primary Color**: `#CAB371` (gold)
- **CRM Board Key**: `gestao-de-atendimento-emporio-forseca`

## Related Projects (same repo, different deploys)
- **Coronel Picanha**: `https://coronelpicanhacrm.vercel.app` (CLIENT_ID: `lagostacrm`)
- **Lagosta CRM**: `https://vercel.com/cirotrigos-projects/lagostacrm` (upstream)
- Changes in this fork must be **isolated** — do not break sync with upstream

## External Services
- **Chatwoot**: `https://chatwoot-coronel.lagostacriativa.com.br` (shared instance)
  - Inbox ID 3: `emporiofonseca.vix` (Instagram)
  - Inbox ID 1-2: Coronel Picanha (do not modify)
- **n8n**: `https://n8n-coronel.lagostacriativa.com.br` (shared instance)
  - Workflow: `[Emporio Fonseca] Agente de atendimento Sofia` (ID: `TvNXUETbiNy2mE5k`)
  - Webhook: `/webhook/atendimento/emporio_fonseca`
- **Supabase**: `bmaacpemxgoiimttyvar.supabase.co`

## Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint` (zero warnings enforced)
- **Typecheck**: `npm run typecheck`
- **Tests**: `npm test` (watch) | `npm run test:run` (single run) | `npx vitest path/to/file.test.ts` (single file)

## Architecture
- **Next.js 16 (App Router)**: routes in `app/`, protected routes under `app/(protected)/`
- **Supabase**: Auth + Postgres + RLS. Clients in `lib/supabase/` (client/server/service-role)
- **Proxy auth**: `proxy.ts` + `lib/supabase/middleware.ts` (not middleware.ts); excludes `/api/*`
- **State**: TanStack Query with facades in `context/`, queries in `lib/query/`
- **Cache**: Single Source of Truth pattern (see Cache Rules below)
- **AI**: SDK v6, chat via `/api/ai/chat`, tools in `lib/ai/tools.ts` (always filter by `organization_id`)

## Cache Rules (CRITICAL)
- **One cache per entity**: All operations (CRUD, Realtime, optimistic) use the SAME cache
- **Deals**: Always use `[...queryKeys.deals.lists(), 'view']` for all mutations
- **Other entities**: Use `queryKeys.{entity}.lists()` for mutations
- **NEVER use** `queryKeys.*.list({ filter })` for optimistic updates - those are separate caches
- **Prefer** `setQueryData` over `invalidateQueries` for instant UI updates

## Code Style
- TypeScript 5.x strict, React 19, Tailwind CSS v4, Radix UI primitives
- Shared components in `components/`, feature modules in `features/`
- Imports: use `@/` alias (e.g., `@/lib/utils`, `@/components/ui`)
- Naming: camelCase for variables/functions, PascalCase for components/types
- Tests: Vitest + happy-dom + React Testing Library; place `.test.ts(x)` files alongside source
## Multi-tenant / Multi-brand
- Client detection: `lib/client.ts` (reads `CLIENT_ID` env, falls back to `emporiofonseca`)
- Branding: `lib/branding.ts` (name, colors, description per client)
- Theme colors: `app/globals.css` (@theme block) + `tailwind.config.js`
- Supported clients: `jucaocrm`, `lagostacrm`, `emporiofonseca`, `default`

