export function trustedSiteOrigins(siteUrl?: string, additionalOrigins?: string): Set<string> {
  const origins = new Set<string>();
  for (const value of [siteUrl, ...(additionalOrigins || "").split(",")].filter((v): v is string => Boolean(v?.trim()))) {
    let url: URL;
    try { url = new URL(value.trim()); } catch { throw new Error("SITE_URL and TRUSTED_SITE_ORIGINS must contain complete HTTPS origins."); }
    if (url.protocol !== "https:" || url.hostname.includes("*") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("SITE_URL and TRUSTED_SITE_ORIGINS must contain HTTPS origins without paths or credentials.");
    }
    origins.add(url.origin);
  }
  return origins;
}

export function allowedRequestOrigin(origin: string, host: string | undefined, trusted: ReadonlySet<string>): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return false;
    // Vercel forwards the browser's Origin while Host points to Replit.
    // Trust only explicitly configured website origins, never X-Forwarded-Host.
    return trusted.has(url.origin) || url.host === host?.toLowerCase();
  } catch { return false; }
}
