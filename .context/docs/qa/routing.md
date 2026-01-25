---
slug: routing
category: architecture
generatedAt: 2026-01-25T00:04:10.459Z
relevantFiles:
  - app/api/admin
  - app/api/ai
  - app/api/chat
  - app/api/contacts
  - app/api/installer
  - app/api/invites
  - app/api/mcp
  - app/api/public
  - app/api/settings
  - app/api/setup-instance
---

# How does routing work?

## Routing

### Next.js App Router

Routes are defined by the folder structure in `app/`:

- `app/page.tsx` → `/`
- `app/about/page.tsx` → `/about`
- `app/blog/[slug]/page.tsx` → `/blog/:slug`

### Detected Route Files

- `app/api/settings/ai-prompts/[key]/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/admin/invites/[id]/route.ts`