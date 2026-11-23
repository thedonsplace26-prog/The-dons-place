# Initial verification

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

- **Photo storage provisioning failed twice** with an internal Replit service error. Upload-three-photos, thumbnail rendering, cover/reorder/delete with actual uploaded photos, and verifying storage removal after apartment deletion cannot pass until the bucket is provisioned.
- Browser-driven authenticated admin interactions were not tested. API smoke checks are not a substitute for testing the rendered signed-in UI.
- Mobile screenshot covers the first homepage viewport, not all pages or interactive menu/dialog states.
- Loading/error/empty render paths were implemented but have not been exercised in a browser.
- Lighthouse was **not run**; no Performance, Accessibility or SEO scores are claimed.
- Production HTTP/HTTPS redirects, security headers and branded 404 need staging verification after publishing. The development branded 404 returned HTTP 404.
- No publish has occurred. Production `.replit.app` URL, domain availability, registrar records, certificates, DNS propagation, canonical URLs and published sitemap are not verified.

## Required before launch

1. Provision persistent App Storage and restart the API.
2. Run real-photo upload, cover/order/delete and storage-cleanup tests.
3. Check signed-in admin UI and all six public pages at 375px, including error/empty states and WhatsApp messages.
4. Run a mobile Lighthouse audit on the staging published URL, aiming for scores above 85.
5. Replace all sample apartment content and photos.
6. Publish to staging, obtain the real URL and set `SITE_URL`.
7. Only after staging succeeds, buy/link the preferred available domain, apply actual Replit DNS records and confirm HTTPS.
