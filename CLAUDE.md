# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) then Vite production build
- `npm run lint` — ESLint over the repo
- `npm run preview` — preview the production build
- `npm test` — Vitest over the pure logic in `src/lib` (`npm run test:watch` while developing)
- `npm run backup` — export every table to `backups/` (needs `SUPABASE_SERVICE_ROLE_KEY`)
- `npm run icones` — regenerate favicons and logos in `public/` from the art in `brand/`

**Tests cover `src/lib` only** — money formatting and installment splitting, client tier and score, the in-memory cache. Those are pure functions, so they need no database and no DOM; [vitest.config.ts](vitest.config.ts) injects dummy Supabase env vars because `clientTier`/`clientScore` import the client module, which throws on import without them. Pages are untested: they mix Supabase calls, modals and layout, and testing them would need a much heavier setup. Anything involving a date deserves a test — see below.

**Dates: never `new Date('2026-09-04')` on a `DATE` column.** The standard parses a date-only string as UTC, which in Brasília is 21:00 the day before. This shipped as a real bug in two places: client classification treated an installment due *today* as one day late (and 30 days late as `CRITICO`, which is reserved for *more* than 30), and the Financeiro screen displayed every supplier due date one day early. Compare these values as ISO strings (`data_vencimento < todayLocalISO()`, as `Credit.tsx` and `Historico.tsx` do), or parse with `parseISO` from date-fns / the local `dataLocal` helper in `clientTier.ts`. Full timestamps (`created_at`, `data_venda`) are unaffected.

**CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, tests and build on every push and pull request. Lint runs with `--max-warnings 3`, a ratchet that only ever moves down — it started at 45 while the inherited `any` debt was paid off, and the 3 that remain are `react-hooks/exhaustive-deps` on the fetch-on-mount effects in Credit, Financial and Settings. `@typescript-eslint/no-explicit-any` is an error again, so a new `any` fails the build. CI catches type errors, lint regressions, broken builds and broken logic in `src/lib` — it cannot catch layout bugs, which still need a real look at the screen.

**Reading an error inside `catch`.** TypeScript types it `unknown`; use `mensagemDeErro` / `codigoDeErro` from [src/lib/erro.ts](src/lib/erro.ts) rather than `catch (e: any)`. Note that `e instanceof Error` is the wrong check here: a Supabase `PostgrestError` is a plain object, so that test would throw away the very message worth showing. Postgres failures are identified by `code` (`23503` is a foreign-key violation, which is how Inventory tells "product already sold" from a generic error), never by matching the message text.

**Backups are manual and they are the only safety net.** The Supabase free plan takes no backups at all, so the crediário exists in exactly one place until someone runs `npm run backup`. The script aborts rather than writing a partial file: it compares each table against the row count the server reports, refuses a key that is not `service_role` (with RLS on, a lesser key returns fewer rows and no error), and refuses a `service_role` key belonging to a different project. `backups/` is gitignored — the files carry client CPF and phone numbers.

Requires env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [src/lib/supabase.ts](src/lib/supabase.ts)) — the client throws at import time if either is missing, so `npm run dev` will fail fast without a `.env`.

## Architecture

Single-page React 19 + TypeScript + Vite app for a jewelry store ("Rubia Joias"). UI language and domain vocabulary are **Portuguese** (clientes, vendas, crediário, parcelas, fornecedores). Preserve Portuguese identifiers and user-facing copy when editing.

### Data layer: Supabase is the backend

There is no custom API server. All persistence, auth, and business logic goes through `@supabase/supabase-js` via the singleton in [src/lib/supabase.ts](src/lib/supabase.ts). Pages call `supabase.from('<table>')...` directly — there is no repository/service abstraction layer. When adding a feature, expect to:

1. Add/modify a table in [schema.sql](schema.sql) (canonical schema) and ship a matching `migration_*.sql` file at the repo root (this is the project's migration convention — numbered/dated SQL files applied manually in the Supabase dashboard).
2. Query it directly from the relevant page component.

Core domain tables (see [schema.sql](schema.sql)): `clientes`, `fornecedores`, `produtos`, `vendas` + `itens_venda`, `contas_pagar` + `parcelas_pagar`. A `parcelas_venda` table exists via migration for crediário (installment sales). A `gerar_parcelas` PL/pgSQL function generates monthly installments for purchase orders.

There is one Supabase Edge Function at [supabase/functions/send-whatsapp-reminder/](supabase/functions/send-whatsapp-reminder/) for WhatsApp reminders — see [SETUP_WHATSAPP_REMINDERS.md](SETUP_WHATSAPP_REMINDERS.md) for deployment.

### Routing and auth

[src/App.tsx](src/App.tsx) defines all routes. Two public routes (`/login`, `/catalogo`); everything else is wrapped in `<ProtectedRoute><Layout/></ProtectedRoute>` and renders as nested routes inside [src/components/Layout.tsx](src/components/Layout.tsx) (shared nav shell).

Auth lives entirely in [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx):
- Wraps `supabase.auth` (email/password, signup, reset).
- Has a **demo mode** bypass: `loginAsDemo()` stores `demoMode=true` in `localStorage` and injects a fake `User` object without hitting Supabase. Any code that branches on auth should account for this synthetic user (id `demo-user`).
- `App.tsx` has a `DISABLE_AUTH` kill switch constant for local dev — leave it `false` unless intentionally bypassing.

### Page structure

Each top-level feature is a single large page component in [src/pages/](src/pages/) that owns its own state, Supabase queries, modals, and forms (Sales, Inventory, Credit, and Financial are each 600–900+ lines). There is minimal component extraction — shared primitives live only in [src/components/](src/components/) (`Layout`, `ProtectedRoute`, `SaleReceipt`). When modifying a feature, expect to work within one big file rather than hunting across many small ones; when adding something genuinely reusable (e.g., receipt rendering), follow the `SaleReceipt.tsx` pattern of a focused shared component.

Feature map:
- `Dashboard.tsx` — KPIs/overview
- `Sales.tsx` — POS flow, cart, checkout, receipt
- `Inventory.tsx` (`estoque`) — products, stock, cost/traceability
- `Clients.tsx` — customer CRUD
- `Credit.tsx` (`crediario`) — installment sales / fiado
- `Financial.tsx` — `contas_pagar` / parcelas
- `ExpirationDates.tsx` (`vencimentos`) — due dates, monthly tabs
- `Catalog.tsx` (`/catalogo`, **public**) — customer-facing product catalog filtered by `show_in_catalog`
- `Settings.tsx`, `Login.tsx`

### Styling and UI libs

Tailwind CSS (see [tailwind.config.js](tailwind.config.js)), `lucide-react` for icons, `date-fns` for dates, `qrcode.react` + `@yudiel/react-qr-scanner` for product QR codes, `html2canvas` for receipt image export. No component library (Radix/shadcn/etc.) — styles are inline Tailwind.

### Deployment

Deployed to Vercel as a SPA. [vercel.json](vercel.json) rewrites all paths to `index.html` so client-side routes work on refresh.

## Supplementary docs

Setup/troubleshooting notes (Portuguese) live at the repo root: [SETUP_WHATSAPP_REMINDERS.md](SETUP_WHATSAPP_REMINDERS.md), [STORAGE_SETUP.md](STORAGE_SETUP.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [TROUBLESHOOTING_CONNECTION.md](TROUBLESHOOTING_CONNECTION.md), [SOLUCAO_TELEFONE.md](SOLUCAO_TELEFONE.md), [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md). Consult these before debugging Supabase Storage, WhatsApp edge function, or connection issues.
