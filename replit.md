# The Don's Place

Short let apartment website for DAH Properties in Ajah, Lagos, with a private owner administration panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/the-dons-place` — preserved static public website and vanilla JavaScript admin; production Express static server.
- `artifacts/api-server` — apartment/settings/photo APIs and PostgreSQL-backed administrator authentication.
- `migrations` — numbered SQL development migrations; `lib/db/src/schema` mirrors them for Replit Publish.
- `lib/api-spec/openapi.yaml` — API contract. Regenerate clients and validation after changing it.
- `README.md` — operation, photo setup, admin guide, backup and custom-domain instructions.
- `VERIFICATION.md` — performed checks and explicit launch blockers.

## Architecture decisions

- Preserve the supplied public HTML layout and CSS. The owner explicitly said not to redesign the existing site.
- The owner explicitly requested local bcrypt/session authentication for admins. Customers do not have accounts.
- All booking and payment discussions happen on WhatsApp; do not add checkout or booking records.
- Keep this supplied pnpm layout rather than replacing the project. Production schema changes go through Replit Publish, not deploy-time migration scripts.

## Product

Public apartment list/details, gallery, contact and terms, plus private apartment, photo, pricing and settings management. Sample apartments must be replaced before launch.

## User preferences

- Business name is always **The Don's Place**, never add “Lodge”.
- Preferred domain is **thedonsplace.com**; availability has not been confirmed. Never invent DNS values or a published URL.

## Gotchas

- Photo uploads require provisioned App Storage; never substitute temporary local disk persistence.
- `pnpm run migrate` is development-only. Production startup initializes missing data only, never schema.
- Changing bootstrap admin secrets does not reset existing administrator credentials.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
