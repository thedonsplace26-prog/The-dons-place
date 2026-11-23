# The Don's Place

Short let apartments by DAH Properties in Ajah, Lagos.

The public website preserves the uploaded HTML and **unchanged original CSS**. Guests never log in. All enquiries, bookings and payments happen on WhatsApp; this application does not accept payments or create bookings.

## Current status

- Working development preview: open the **The Don’s Place** app preview.
- Admin: open `/admin` on the same site. Use the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you set in Replit Secrets.
- Three **sample** apartments are seeded once. Replace their names, prices, text and photos before launch.
- **Photo storage is configured and tested:** real uploads, WebP conversion, thumbnails, cover/order changes and deletion from persistent App Storage passed. There is no filesystem upload fallback.
- **Not published yet.** No live production URL, custom-domain DNS values or HTTPS verification can be claimed yet.
- Preferred domain: **thedonsplace.com**, not confirmed available. Verify availability at a registrar before paying.

## Project structure

- `artifacts/the-dons-place/index.html` — original public homepage.
- `artifacts/the-dons-place/public/` — the other public HTML pages, original CSS, scripts, images and vanilla JavaScript admin.
- `artifacts/the-dons-place/server.mjs` — production Express static server, security headers, HTTPS and primary-host redirects, compression and branded 404.
- `artifacts/api-server/src/routes/` — public, authentication and admin API.
- `artifacts/api-server/src/middlewares/` — secure PostgreSQL sessions and CSRF protection.
- `artifacts/api-server/src/services/` — catalog, seed and persistent photo processing.
- `migrations/` — plain SQL development migrations.
- `lib/db/src/schema/` — matching schema definitions for the managed database publish flow.
- `lib/api-spec/openapi.yaml` — API contract.

The existing pnpm project is retained rather than replaced with a new npm layout. The generated web artifact hosts the unchanged static pages; React is not used to redesign them.

## Setup and environment

Use Node.js 20 or newer (this supplied environment uses Node.js 24) and pnpm 10.

```sh
pnpm install --frozen-lockfile
pnpm run migrate
```

For development in Replit, run the existing **API Server** and **The Don’s Place web** workflows. They supply `PORT` and `BASE_PATH`. Do not run a duplicate server or hardcode ports in the browser.

`.env.example` lists names only. Do not commit secrets or paste credentials into chat.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Replit-managed PostgreSQL connection; provisioned by Replit |
| `SESSION_SECRET` | Strong session-signing secret |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Initial administrator, used only if no admin exists |
| `NODE_ENV` | `production` in published services; managed workflow sets development locally |
| `SITE_URL` | Actual verified HTTPS primary site origin; initially use the published staging `.replit.app` URL, then the verified custom domain |
| `PORT` | Injected per service |
| `BASE_PATH` | `/` for the public site, injected by the artifact workflow |
| `PRIVATE_OBJECT_DIR` | Managed persistent bucket path from App Storage setup |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS` | Managed App Storage configuration |

### Photo storage configuration

The project's default App Storage bucket is configured. The API uses `PRIVATE_OBJECT_DIR` when supplied; otherwise it uses the `.private` prefix inside `DEFAULT_OBJECT_STORAGE_BUCKET_ID`. No bucket ID is hardcoded. The managed storage variables above must be available to the API in development and production. Do not enter a guessed bucket name or copy cloud credentials into source files. Restart the API after configuration changes.

Uploads are held in memory only while processing; their bytes go to persistent object storage. Genuine JPEG, PNG and WebP bytes are checked, decoded with a 40-megapixel limit, rotated, stripped of metadata and converted to WebP at up to 1600px, plus a 600px thumbnail. Maximum 5MB each and 20 photos per apartment. Stored URLs are same-origin `/api/images/...` routes.

Deletion is recorded durably in PostgreSQL with the listing/photo removal. Storage cleanup is attempted immediately and retried every minute while the API is running. Autoscale can suspend an idle instance, so retries resume when it wakes. A storage failure is reported explicitly instead of claiming that files were removed.

## Administrator guide

1. Visit `/admin` directly. It is not linked from the public site and is excluded from indexing.
2. Sign in with the credentials you saved in Secrets. Neither the site nor this README displays the password.
3. Choose **Add apartment**, or **Edit** next to an existing one.
4. Set the name, slug, whole-naira nightly price, blurb, description, highlights, amenities, display order, availability and featured status.
5. Save the apartment before adding photos. Upload multiple photos, edit their descriptions, select a cover, and use drag-and-drop or arrow controls to reorder.
6. Removing an apartment or photo requires confirmation. **Deletion is permanent** and removes associated stored photos.
7. Use **Gallery** for general building/shared-space photos.
8. Use **Settings** for WhatsApp, email, address, amenities and terms. Keep the business name **The Don's Place**, never “Lodge”.
9. Turn off **Sample data** after replacing the example content.

Price and availability edits are read from the database on the next public page load; reload any already-open public page to see the change. Public responses use a 60-second cache lifetime with mandatory revalidation (`no-cache`) to avoid showing stale prices.

### Change the admin password

In `/admin`, open **Account**, enter the current password and a new password of 12–72 characters (at most 72 UTF-8 bytes), confirm and save. Other active sessions are revoked.

Changing the bootstrap secrets after an administrator already exists does **not** overwrite the saved account or reset its password. Do not delete the admin record as a reset mechanism.

## Migrations and seeding

`pnpm run migrate` (or `npm run migrate`) runs the numbered SQL files once using a transaction, advisory lock and migration history. **It is development-only** and refuses to run in production.

Replit's managed **Publish** flow copies the development schema to production and presents any destructive change for confirmation. Do not add schema mutations to the production build command or startup. This is an intentional adjustment to the supplied `npm install && npm run migrate` deployment instruction: deploy-time DDL is not supported for the managed production database.

The API startup performs data-only initialization under a transaction and lock:

- Inserts missing settings without changing existing settings.
- Inserts sample apartments only once, and only if the catalog is empty.
- Creates the initial admin only if no admin exists.
- Never recreates sample apartments after an administrator deletes them.

No redeploy overwrites real apartment content, prices, photos, settings or passwords.

## Security

PostgreSQL-backed 8-hour sessions use `httpOnly`, `secure`, `sameSite=lax` cookies. CSRF tokens protect mutations including login; session IDs regenerate at login. Bcrypt uses cost 12. Login throttling allows five attempts per 15 minutes per IP, with an additional PostgreSQL counter shared across instances and generic errors. Queries bind all data values as parameters. Admin-entered content is escaped before rendering. No cross-origin API access is enabled.

Production uses Helmet, a same-origin script policy, Google Fonts and Maps allowlists, gzip, asset caching and branded 404 pages. Inline **styles** remain allowed because they are part of the original supplied markup; inline event handlers/scripts are not allowed.

## Publish and stage

1. Persistent photo upload/deletion checks now pass in development; complete the remaining mobile browser and staging checks before launch.
2. Open **Publishing**, choose **Autoscale**, and keep both registered services:
   - API: build `pnpm --filter @workspace/api-server run build`; run `node --enable-source-maps artifacts/api-server/dist/index.mjs`.
   - Web: build `pnpm --filter @workspace/the-dons-place run build`; run `node artifacts/the-dons-place/server.mjs`.
   - API health endpoint: `/api/health` returns `{"ok":true}`. `/api/healthz` is also supported.
3. Confirm production Secrets and persistent storage, and let Publish apply the managed database schema. Do not choose to overwrite existing production rows with development data on subsequent releases.
4. The owner must click **Publish**. Publishing has not been done automatically.
5. Obtain the actual `.replit.app` URL from Publishing. Set `SITE_URL` to that exact HTTPS origin, then republish.
6. Test the staged site and admin on that URL before changing DNS.
7. Check `/api/health`, all six public pages, `/admin`, photos, WhatsApp links, canonical URLs, `/sitemap.xml`, HTTPS and 404s.

## Domain and DNS

**thedonsplace.com** is the preferred domain, but availability is **not verified**. Check it with the registrar before buying. Alternatives are `thedonsplace.com.ng` and `thedonsplace.ng`; `.ng` may require extra registrant information.

After publishing:

1. Open **Publishing → Domains → Link a domain** and enter `thedonsplace.com`.
2. Replit displays the actual required **A** and **TXT** records. Copy them exactly.
3. At the registrar, open DNS management. Remove conflicting A/AAAA records for the same host only after checking that no other site depends on them.
4. Add the records Replit provides:

| Type | Host/name | Value |
|---|---|---|
| A | `@` (root, or the registrar's blank-root equivalent) | **Exact IP displayed by Replit for the root domain** |
| TXT | **Exact verification host displayed by Replit** | **Exact verification token displayed by Replit** |
| A | `www` | **Exact IP displayed when linking `www.thedonsplace.com` separately** |
| TXT | **Exact verification host displayed for `www`, if requested** | **Exact token for that hostname** |

These are a setup worksheet, **not invented DNS values**. Exact numeric/token values cannot be supplied before the deployment and domain link exist. If Replit displays a CNAME instead for a hostname, use its displayed record rather than creating an incompatible A record.

5. Link `www.thedonsplace.com` as a separate hostname in Replit, verify its DNS and TLS, and set the root as primary.
6. After the root domain is verified and HTTPS is active, set `SITE_URL=https://thedonsplace.com` and republish. The production web server permanently redirects the verified `www` host to this primary origin and forwards HTTP requests to HTTPS.
7. Verify redirects and certificates for **both** hostnames. DNS propagation can take minutes to **48 hours**. Do not switch DNS before staging passes.

Never point DNS at a development `.replit.dev` address.

## Daily backups and recovery

Use Replit's production database recovery features, not an in-app dump job:

- **Database → Production → Settings → Advanced → Point-in-time recovery**: verify the actual recovery window. PITR is enabled by default at production database creation, but can be disabled; inspect the pane rather than assuming a restore point exists.
- In the same settings, enable **Scheduled backups** for a daily production restore point, and use **View all backups** to inspect it. Scheduled backups are off by default and can skip while an idle database is archived.
- For a one-time data export outside Replit, run a `SELECT` for the required non-sensitive rows in the database SQL viewer and use its results download/export option if available. Do not export `admin_users` or `session`. A code ZIP does not contain the database.
- Restoring production discards writes after the selected restore point. Confirm the time before restoring. Development checkpoint rollback does not restore production.

Official guidance: https://docs.replit.com/features/data-and-storage/data-recovery

## Verification

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server exec tsx scripts/smoke.ts
pnpm --filter @workspace/api-server exec tsx scripts/photos-smoke.ts
```

The smoke scripts create and remove temporary admins and apartments; they do not read or change the owner's credentials. The photo checks upload real JPEG, PNG and WebP fixtures, verify stored and served WebP variants, exercise cover/order/alt changes and validation limits, and verify deletion from persistent storage. Temporary test records and objects are removed afterward. Run only against development with the workflows running.

See `VERIFICATION.md` for checks performed and checks still blocked. Browser interaction tests and Lighthouse have not been run for this initial build; there are no claimed Lighthouse scores.
