import assert from "node:assert/strict";
import { test } from "node:test";
import { CANONICAL_SITE_ORIGIN, configuredSiteOrigin, httpsOrigin, pageMetadata, vercelConfig } from "./vercel-config.mjs";

const api = "https://backend.example.com";
const site = "https://thedonsplace.com";
test("only public HTTPS origins are accepted; missing backend fails explicitly", () => {
  for (const value of [undefined, "", "http://backend.example.com", "https://user:password@example.com", "https://test.replit.dev", "https://localhost", "https://127.0.0.1", "https://example.com/api", "https://example.com/?key=value"]) {
    assert.throws(() => httpsOrigin(value, "REPLIT_API_ORIGIN"));
  }
  assert.equal(httpsOrigin(api + "/", "REPLIT_API_ORIGIN"), api);
  assert.equal(configuredSiteOrigin(undefined), CANONICAL_SITE_ORIGIN);
  assert.equal(configuredSiteOrigin("  "), CANONICAL_SITE_ORIGIN);
  assert.equal(configuredSiteOrigin(site), site);
  assert.throws(() => configuredSiteOrigin("http://thedonsplace.com"));
  assert.throws(() => vercelConfig(site, site));
});
test("API, multipart uploads and image URLs reach the same backend without a function", () => {
  const config = vercelConfig(api, site);
  const rule = config.routes.find(r => r.dest === api + "$1");
  for (const url of ["/api/health", "/api/admin/login", "/api/admin/apartments/123/photos", "/api/images/image.thumb.webp", "/api"]) {
    assert.equal(url.replace(new RegExp("^" + rule.src + "$"), rule.dest), api + url);
  }
  assert.equal(rule.methods, undefined, "All methods, including multipart POST and DELETE, are forwarded.");
  assert.equal(rule.transforms[0].args, "0");
});
test("admin stays private, www redirects, sitemap proxies and missing pages return 404", () => {
  const { routes } = vercelConfig(api, site);
  assert.equal(routes.find(r => r.src === "/admin(?:/.*)?").headers["Cache-Control"], "no-store");
  assert.equal(routes.find(r => r.src === "/admin/").dest, "/admin/index.html");
  assert.equal(routes.find(r => r.src === "/sitemap\\.xml").dest, api + "/api/sitemap.xml");
  const www = routes.find(r => r.has);
  assert.equal(www.has[0].value, "www.thedonsplace.com");
  assert.equal(www.headers.Location, site + "/$1");
  assert.equal(routes.at(-1).status, 404);
});
test("public pages receive canonical and Open Graph tags without changing their body", () => {
  const html = '<html><head><title>Apartments</title><meta name="description" content="Rooms"></head><body>Original website</body></html>';
  const result = pageMetadata(html, "apartments.html", site);
  assert.ok(result.includes('rel="canonical" href="https://thedonsplace.com/apartments.html"'));
  assert.ok(result.includes('property="og:title" content="Apartments"'));
  assert.ok(result.endsWith("<body>Original website</body></html>"));
  assert.ok(pageMetadata(html, "index.html", site).includes('rel="canonical" href="https://thedonsplace.com/"'));
});
