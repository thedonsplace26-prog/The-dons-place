import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedRequestOrigin, trustedSiteOrigins } from "./trustedOrigins";

const trusted = trustedSiteOrigins("https://thedonsplace.com", "https://preview.example.com");
test("configured Vercel origins work behind a different Replit Host", () => {
  assert.equal(allowedRequestOrigin("https://thedonsplace.com", "backend.example.com", trusted), true);
  assert.equal(allowedRequestOrigin("https://preview.example.com", "backend.example.com", trusted), true);
  assert.equal(allowedRequestOrigin("https://backend.example.com", "backend.example.com", trusted), true);
});
test("untrusted, malformed, insecure and lookalike origins are rejected", () => {
  for (const origin of ["null", "not a URL", "https://evil.example", "https://thedonsplace.com.evil.example", "http://thedonsplace.com", "https://thedonsplace.com:444", "https://evil.example@thedonsplace.com", "https://thedonsplace.com/path"]) {
    assert.equal(allowedRequestOrigin(origin, "backend.example.com", trusted), false, origin);
  }
});
test("invalid allowlist settings fail at startup instead of allowing all sites", () => {
  assert.equal(trustedSiteOrigins().size, 0);
  for (const value of ["*", "https://*.vercel.app", "http://thedonsplace.com", "https://user:password@example.com"]) {
    assert.throws(() => trustedSiteOrigins(value));
  }
});
