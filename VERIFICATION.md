# Initial verification

## Vercel production follow-up

The initial `SITE_URL` build error came from selecting the Vercel project linked to the custom domain: `the-donsplace.com` belonged to `the-dons-place-4jfc`, whose environment variable list was empty. The separately prepared `the-dons-place` project had the variables but did not own the custom domain. Vercel's current project environment was repaired; both exact origins are now present on the domain-linked project.

The build also now falls back to the verified canonical domain if Vercel omits `SITE_URL`. A new production build of `main` completed in Vercel with Ready state and the root, `www`, project preview aliases assigned.

Read-only production checks through `https://thedonsplace.com` passed: homepage and all five other public HTML pages; `/admin/` with `no-store` and `noindex`; `/api/health`, apartment and gallery APIs; sitemap, robots and branded 404; and `www` → root HTTPS 308 redirect.

The custom-domain admin session endpoint returned the expected secure, HTTP-only, SameSite=Lax session cookie. A mutation request with an untrusted origin was rejected with 403; a same-site request reached normal input validation. No administrator credentials were used.

Vercel rewrites public API requests to Replit. Real multi-file photo upload and authenticated admin UI operation through the production domain are not claimed as tested here.

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
- Signed-in admin browser workflows and authenticated photo upload through the Vercel domain have not been verified. The production API, session-cookie flags, origin rejection, public pages and `www` redirect were checked.

## Remaining quality checks

1. Check signed-in admin UI and photo uploads through `https://thedonsplace.com`, including apartment edits and multi-file uploads.
2. Run a mobile Lighthouse audit on the live site; no Performance, Accessibility or SEO scores are claimed yet.
3. Replace sample apartment content and photos if they are not final.
