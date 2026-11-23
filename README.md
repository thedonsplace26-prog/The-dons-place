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
| `SITE_URL` | Canonical website origin: `https://thedonsplace.com` for the selected hybrid setup; this is not the backend URL |
| `TRUSTED_SITE_ORIGINS` | Replit API only: comma-separated exact HTTPS website origins allowed through the same-origin Vercel proxy; no wildcards |
| `REPLIT_API_ORIGIN` | Vercel build only: actual published Replit HTTPS origin, without `/api` or a trailing path |
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

The selected setup is **Vercel for the website, with the backend, PostgreSQL sessions and persistent photo storage on Replit**. Follow [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for the ordered rollout.

- Vercel builds the original static HTML/CSS/JS using `node artifacts/the-dons-place/scripts/build-vercel.mjs`. No backend packages, credentials or Vite development plugins are needed there.
- Vercel forwards `/api/*`, including authentication, multipart uploads and stored images, to the actual published Replit origin. Browser requests and cookies stay on the website's origin.
- The build fails explicitly until `SITE_URL` and `REPLIT_API_ORIGIN` are configured. A workspace `.replit.dev` address is never accepted as a production backend.
- Keep the existing registered Replit production services for the initial rollout. The owner must click **Publish**; no Replit deployment is started automatically.
- Test the Vercel-provided hostname, admin and uploads before changing the custom domain's DNS.

## Domain and DNS

The user supplied **thedonsplace.com** as their custom domain. Add the root domain and `www.thedonsplace.com` to **Vercel**, not Replit, after staging checks pass. Use the exact A/CNAME and any verification TXT records shown by Vercel for this project; do not guess their values.

Keep the current DNS provider and preserve all email MX/TXT records. Change only the website records after checking for an existing live site. Verify HTTPS for both hostnames and redirect `www` to the root domain.

`SITE_URL=https://thedonsplace.com` is the intended canonical origin. Replit's production `TRUSTED_SITE_ORIGINS` also allows the exact Vercel-provided hostname for testing before DNS cutover. This does not enable browser CORS or allow arbitrary preview sites.

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
