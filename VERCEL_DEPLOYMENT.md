# Vercel website with a Replit backend

## Current setup

- Active Vercel project: **the-dons-place-4jfc**, in the **Don's place** team.
- Dashboard: https://vercel.com/don-s-place/the-dons-place-4jfc
- Production deployment: Ready; Git commit `4bb0e2459eb1b13ff075c72912df63e954fcc936`.
- Primary domain: `thedonsplace.com`; `www.thedonsplace.com` redirects to it.
- Both custom hostnames are added and verified in Vercel. The root has no redirect; `www` redirects to the root with HTTP 308.
- Published Replit backend: `https://apartment-haven.replit.app`. Its health, apartment, gallery and SEO endpoints returned HTTP 200.
- Vercel's `SITE_URL` and `REPLIT_API_ORIGIN` are configured on the active project for production and preview.
- Vercel initially linked the same GitHub repository to two projects. `the-dons-place-4jfc` owns the custom domains and is the production project. A second `the-dons-place` project also exists without the custom domains; it has been left untouched.
- Replit retains the existing backend, database, session store and photo bucket. Nothing is migrated or deleted.
- The agent did not edit DNS records.

## 1. Published Replit backend

Production's non-secret website settings are:

```text
SITE_URL=https://thedonsplace.com
TRUSTED_SITE_ORIGINS=https://the-dons-place.vercel.app
```

The backend must be publicly reachable for Vercel to call `/api`; the admin remains protected by login, secure sessions and CSRF tokens. A private deployment requires additional server-side access-token routing and is not covered by the current configuration. Never send such tokens to browser code.

The Replit backend is published at `https://apartment-haven.replit.app`; `/api/health` returns `{"ok":true}`.

## 2. Vercel production project

After the backend is published, set these **non-secret** Vercel build variables:

- `SITE_URL`: `https://thedonsplace.com` (configured for production and preview; if Vercel fails to inject it, the static build uses this same verified canonical-domain constant).
- `REPLIT_API_ORIGIN`: `https://apartment-haven.replit.app` (configured for production and preview; no `/api` path).

Do not use a `.replit.dev` workspace URL, the Vercel website's own URL, or a guessed `.replit.app` URL. The build deliberately fails if the backend setting is missing or is a development address. If Vercel fails to inject `SITE_URL`, the verified canonical domain is used as a fallback.

Do **not** copy `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`, bucket credentials or any other backend secrets to Vercel.

The active project is already connected to `thedonsplace26-prog/The-dons-place`. Its production branch is `main`. Keep:

| Setting | Value |
|---|---|
| Root directory | Repository root |
| Framework | Other / no framework |
| Build command | `node artifacts/the-dons-place/scripts/build-vercel.mjs` |
| Install command | `node --version` |
| Output directory | Leave the override unset; the build produces `.vercel/output` |
| Production branch | `main` |

This is intentionally a Node-built-in-only static build: the site's original plain HTML/CSS/JS is copied, public-page metadata is added, and Vercel Build Output API routing is generated. No package installation is required on Vercel.

Future pushes to `main` automatically start production deployments for the connected Vercel projects. For this domain, check that the **the-dons-place-4jfc** deployment reaches Ready.

## 3. Production checks

The active production deployment is ready on the verified custom domain. Confirmed:

- The six public pages, sitemap, robots file and branded 404 respond correctly.
- `/api/health`, apartments and gallery respond through Vercel's Replit backend rewrite.
- `/admin/` responds with `no-store` and `noindex`.
- `www` redirects to the root domain using HTTPS.
- Admin session cookies have Secure, HttpOnly and SameSite=Lax; untrusted browser origins are rejected.

Signed-in browser admin flows and photo uploads through the Vercel hostname remain additional checks; the API and persistent-storage upload tests passed directly against Replit.

Do not use `vite preview` as a production server. Replit's production web server remains unchanged.

## 4. Custom domain

Both `thedonsplace.com` and `www.thedonsplace.com` are assigned to the active project. Vercel reports the domain as verified.

The production site is live at `https://thedonsplace.com`; `https://www.thedonsplace.com` redirects to it. DNS records were not changed by the agent.

## Local checks

```sh
node --test artifacts/the-dons-place/scripts/vercel-config.test.mjs
pnpm --filter @workspace/api-server exec tsx --test src/lib/trustedOrigins.test.ts
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server exec tsx scripts/smoke.ts
```

Routing/configuration tests and live read-only production requests passed. Authenticated browser administration and multi-file upload through the Vercel domain remain untested.
