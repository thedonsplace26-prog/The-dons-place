import { isIP } from "node:net";

export function httpsOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a complete HTTPS origin.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.includes("*") ||
      url.hostname.endsWith(".replit.dev") || isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error(`${name} must be a public HTTPS origin, not a development URL or a URL containing a path or credentials.`);
  }
  return url.origin;
}

export function vercelConfig(apiOrigin, siteOrigin) {
  const api = httpsOrigin(apiOrigin, "REPLIT_API_ORIGIN");
  const site = httpsOrigin(siteOrigin, "SITE_URL");
  if (api === site) throw new Error("REPLIT_API_ORIGIN must point to the Replit backend, not the Vercel website.");
  const primary = new URL(site);
  const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; frame-src https://www.google.com https://maps.google.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
  return {
    version: 3,
    routes: [
      { src: "/(.*)", headers: {
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": "max-age=31536000"
      }, continue: true },
      { src: "/(.*)", has: [{ type: "host", value: `www.${primary.hostname}` }], status: 308, headers: { Location: `${site}/$1` } },
      { src: "/admin(?:/.*)?", headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }, continue: true },
      // No Vercel Function handles these requests: multipart uploads stream to Replit.
      // Do not cache admin responses or override the backend's cookie headers.
      { src: "(/api(?:/.*)?)", dest: `${api}$1`, transforms: [
        { type: "request.headers", op: "set", target: { key: "x-vercel-enable-rewrite-caching" }, args: "0" }
      ] },
      { src: "/sitemap\\.xml", dest: `${api}/api/sitemap.xml` },
      { src: "/admin", status: 308, headers: { Location: "/admin/" } },
      { src: "/admin/", dest: "/admin/index.html" },
      { src: "/", dest: "/index.html" },
      { src: "/(?:index|apartments|apartment|gallery|contact|terms|404)\\.html", headers: { "Cache-Control": "public, max-age=0, must-revalidate" }, continue: true },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/404.html", status: 404 }
    ]
  };
}

const escapeHtml = value => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function pageMetadata(html, pathname, siteOrigin) {
  const site = httpsOrigin(siteOrigin, "SITE_URL");
  const title = /<title>(.*?)<\/title>/s.exec(html)?.[1] || "The Don's Place";
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || "";
  const canonical = site + (pathname === "index.html" ? "/" : `/${pathname}`);
  const tags = `<link rel="canonical" href="${escapeHtml(canonical)}">` +
    `<meta property="og:type" content="website"><meta property="og:site_name" content="The Don's Place">` +
    `<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">` +
    `<meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(site + "/assets/logo.png")}">`;
  return html.replace("</head>", tags + "</head>");
}
