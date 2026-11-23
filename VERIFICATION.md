# Initial verification

## Vercel/Replit hosting preparation

- Created the empty `the-dons-place` Vercel project in the user's team; no application deployment or DNS cutover has been performed.
- Seven routing/metadata/origin-policy tests passed.
- A complete local Vercel static-output build passed using a clearly isolated test backend origin. All six public pages, admin files, bundled assets and canonical/Open Graph metadata were present, and the supplied CSS was unchanged. The fixture build output was removed afterward.
- The Replit API TypeScript check and browser SEO script syntax check passed.
- After restarting the API and web workflows, development HTTP smoke checks passed, including valid same-host origins, rejection of untrusted and malformed origins, secure sessions, CSRF, apartment CRUD, password changes and five-attempt lockout.
- A 375px homepage screenshot showed the original layout with no browser errors.
- Required production secret names were checked for presence without reading their values. The intended canonical domain and exact Vercel hostname were configured as non-secret production origin settings.
- Live Vercel-to-Replit routing, proxied cookies, multipart batches, production database readiness, custom-domain DNS and HTTPS still require the backend and website to be published and tested. No claim of a live deployment is made.

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for the next steps. The deployment configuration is prepared locally; GitHub still needs the updated source before the Vercel project is connected and deployed.

## Photo-storage follow-up

The default App Storage bucket is now configured. The storage SDK compatibility issue was fixed, and the real-upload API checks and API TypeScript check passed.

All eight photo-check groups passed:

1. Uploads without authentication or with invalid CSRF tokens were rejected.
2. Three real JPEG, PNG and WebP images uploaded to persistent App Storage.
3. All six full/thumbnail WebP objects existed; served bytes matched stored bytes. Full images were capped at 1600px and thumbnails at 600px, including an image wider than 1600px.
4. Cover-first public ordering, saved sort order, alt-text edits and incomplete-order rejection worked.
5. Fake/corrupt files, files larger than 5MB, batches exceeding 20 files and uploads exceeding 20 apartment photos were rejected without changing saved photos.
6. Deleting the cover removed both stored variants and cleared the cover reference.
7. Deleting the apartment removed all remaining photo rows and stored variants, with no pending cleanup entries for the test images.
8. General gallery upload, public listing and persistent deletion worked.

All temporary test accounts, apartments and tracked image objects were removed. No owner credentials or existing apartment content were changed. These are HTTP/API and real-storage checks, not authenticated browser interaction tests.

Re-run with:

```sh
pnpm --filter @workspace/api-server exec tsx scripts/photos-smoke.ts
```

## Passed

- Full workspace TypeScript checks.
- Backend production bundle compiled.
- Public website production build compiled successfully.
- `/api/health` returned `200 {"ok":true}`.
- All six public HTML pages and `/admin` returned HTTP 200.
- Live public API returned the three seeded sample apartments and associated photos.
- The public CSS matched the supplied CSS byte-for-byte.
- Homepage screenshot at **375×812**: readable text, visible enquiry controls, no visible horizontal overflow in the captured viewport; browser console had no errors.
- Development API smoke checks: secure session creation, login, session identity, invalid CSRF rejection, unauthenticated admin rejection, apartment create/edit/delete, negative-price rejection, edited price visible publicly immediately, availability exclusion, empty photo-order validation, invalid cover rejection, settings round trip, incorrect-current-password rejection, password change, new-password login, old-password rejection and logout.
- Five-attempt wrong-password lockout: five failures returned 401 and the sixth login returned 429, even with the correct password.
- Admin login screenshot at **375×812**: inputs and sign-in control fit the viewport. The initial `/admin/me` request returned the expected 401 while signed out.

## Blocked / not verified

- Browser-driven authenticated admin interactions were not tested. API smoke checks are not a substitute for testing the rendered signed-in UI.
- Mobile screenshot covers the first homepage viewport, not all pages or interactive menu/dialog states.
- Loading/error/empty render paths were implemented but have not been exercised in a browser.
- Lighthouse was **not run**; no Performance, Accessibility or SEO scores are claimed.
- Production HTTP/HTTPS redirects, security headers and branded 404 need staging verification after publishing. The development branded 404 returned HTTP 404.
- No publish has occurred. Production `.replit.app` URL, domain availability, registrar records, certificates, DNS propagation, canonical URLs and published sitemap are not verified.

## Required before launch

1. Check signed-in admin UI and all six public pages at 375px, including error/empty states, upload controls and WhatsApp messages.
2. Run a mobile Lighthouse audit on the staging published URL, aiming for scores above 85.
3. Replace all sample apartment content and photos.
4. Publish to staging, obtain the real URL and set `SITE_URL`.
5. Only after staging succeeds, buy/link the preferred available domain, apply actual Replit DNS records and confirm HTTPS.
