# Vercel website with a Replit backend

## Current setup

- Vercel project: **the-dons-place**, in the **Don's place** team.
- Dashboard: https://vercel.com/don-s-place/the-dons-place
- Vercel-assigned hostname: `the-dons-place.vercel.app` (assigned by Vercel; no application deployment yet).
- Intended primary domain: `thedonsplace.com`; `www.thedonsplace.com` redirects to it.
- Both custom hostnames are added and verified in Vercel. The root has no redirect; `www` redirects to the root with HTTP 308.
- Published Replit backend: `https://apartment-haven.replit.app`. Its health, apartment, gallery and SEO endpoints returned HTTP 200.
- Vercel's `REPLIT_API_ORIGIN` is configured to that verified origin for production and preview.
- Replit retains the existing backend, database, session store and photo bucket. Nothing is migrated or deleted.
- Agent has not changed DNS records. Vercel still needs its GitHub repository connection and first application deployment.

## 1. Publish the Replit backend first

Open Replit **Publishing** and publish using the existing registered production services:

| Service | Build | Run |
|---|---|---|
| API | `pnpm --filter @workspace/api-server run build` | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Web, retained for the initial rollout | `pnpm --filter @workspace/the-dons-place run build` | `node artifacts/the-dons-place/server.mjs` |

Use the production secrets already configured in Replit. Check that the production database contains the required schema and initial data using the publishing/database flow. Do not overwrite an existing production database with development data on later releases.

Production's non-secret website settings are:

```text
SITE_URL=https://thedonsplace.com
TRUSTED_SITE_ORIGINS=https://the-dons-place.vercel.app
```

The backend must be publicly reachable for Vercel to call `/api`; the admin remains protected by login, secure sessions and CSRF tokens. A private deployment requires additional server-side access-token routing and is not covered by the current configuration. Never send such tokens to browser code.

The owner must click **Publish**. Obtain the real published HTTPS origin after publication (Agent uses deployment metadata, not the workspace URL). Verify `/api/health` returns `{"ok":true}`.

## 2. Configure Vercel

After the backend is published, set these **non-secret** Vercel build variables:

- `SITE_URL`: `https://thedonsplace.com` (already configured for production and preview).
- `REPLIT_API_ORIGIN`: `https://apartment-haven.replit.app` (configured for production and preview; no `/api` path).

Do not use a `.replit.dev` workspace URL, the Vercel website's own URL, or a guessed `.replit.app` URL. The build deliberately fails if the backend setting is missing or is a development address.

Do **not** copy `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`, bucket credentials or any other backend secrets to Vercel.

Push the prepared source to GitHub, then connect `thedonsplace26-prog/The-dons-place` to the existing Vercel project's **Settings → Git**. Authorize the Vercel GitHub app for this repository if required. Keep:

| Setting | Value |
|---|---|
| Root directory | Repository root |
| Framework | Other / no framework |
| Build command | `node artifacts/the-dons-place/scripts/build-vercel.mjs` |
| Install command | `node --version` |
| Output directory | Leave the override unset; the build produces `.vercel/output` |
| Production branch | `main` |

This is intentionally a Node-built-in-only static build: the site's original plain HTML/CSS/JS is copied, public-page metadata is added, and Vercel Build Output API routing is generated. No package installation is required on Vercel.

Deploy from Vercel's dashboard. Future Git pushes can automatically deploy once Git integration is connected.

## 3. Verify before changing DNS

Use Vercel's assigned hostname first. Check:

- All six public pages, prices, photos, WhatsApp links and branded 404s.
- `/api/health`, `/sitemap.xml`, `/robots.txt` and canonical metadata.
- `/admin/`: login, persistence after reload, apartment edits, upload real JPEG/PNG/WebP files, cover selection, reordering and safe deletion.
- API responses still arrive through the website's origin; session cookies are secure and HTTP-only, with no Domain attribute.
- Authenticated responses are not cached and admin pages are marked noindex.
- Untrusted browser origins are rejected. Arbitrary `*.vercel.app` previews are not trusted: authorize an exact additional hostname in `TRUSTED_SITE_ORIGINS` and republish Replit if one is needed.
- Multi-file uploads are sent to the external Replit origin, not a Vercel Function. Verify a representative multi-file batch end to end before launch.

Do not use `vite preview` as a production server. Replit's production web server remains unchanged for the initial rollout.

## 4. Connect the custom domain

After the above checks pass, add `thedonsplace.com` and `www.thedonsplace.com` in **Vercel → Project Settings → Domains**. Use the exact DNS instructions shown for this project.

- Root/apex: normally an A record with Vercel's displayed value.
- `www`: a CNAME with Vercel's project-specific target.
- Ownership verification: add the exact TXT record if Vercel requests one.

Preserve email MX records and unrelated TXT/CNAME records. Do not change nameservers unless you intentionally migrate every existing DNS record. Updating DNS can move traffic away from an existing site, so confirm the cutover first.

Wait for domain verification and HTTPS for both names, then verify the `www` → root redirect and repeat the core admin/upload checks on `https://thedonsplace.com`.

## Local checks

```sh
node --test artifacts/the-dons-place/scripts/vercel-config.test.mjs
pnpm --filter @workspace/api-server exec tsx --test src/lib/trustedOrigins.test.ts
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server exec tsx scripts/smoke.ts
```

Routing/configuration tests do not claim that a live Vercel-to-Replit deployment has been tested. That requires both services to be published.
