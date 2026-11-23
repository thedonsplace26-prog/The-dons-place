import express from "express";
import helmet from "helmet";
import compression from "compression";
import path from "node:path";
import { readFile } from "node:fs/promises";

const app = express();
app.set("trust proxy", "loopback, linklocal, uniquelocal");
app.disable("x-powered-by");
const root = path.resolve(import.meta.dirname, "dist/public");
app.use((req, res, next) => {
  if (req.get("X-Forwarded-Proto") === "http") {
    if (!process.env.SITE_URL) { res.status(503).send("The site URL has not been configured."); return; }
    res.redirect(308, `${new URL(process.env.SITE_URL).origin}${req.originalUrl}`);
    return;
  }
  // www is redirected only once the preferred primary domain is configured.
  if (process.env.SITE_URL) {
    const primary = new URL(process.env.SITE_URL);
    if (req.hostname === `www.${primary.hostname}`) { res.redirect(308, primary.origin + req.originalUrl); return; }
  }
  next();
});
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"], imgSrc: ["'self'", "data:", "blob:"],
    frameSrc: ["https://www.google.com", "https://maps.google.com"],
    connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"]
  } }
}));
app.use(compression());
app.use("/admin", (_req, res, next) => { res.set({ "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" }); next(); });
app.get("/sitemap.xml", (_req, res) => { res.redirect(307, "/api/sitemap.xml"); });
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /admin\nDisallow: /api/admin\n" + (process.env.SITE_URL ? `Sitemap: ${new URL(process.env.SITE_URL).origin}/sitemap.xml\n` : ""));
});
for (const dir of ["assets", "css", "js"]) app.use(`/${dir}`, express.static(path.join(root, dir), { maxAge: dir === "assets" ? "30d" : "1d" }));
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
for (const page of ["", "index.html", "apartments.html", "apartment.html", "gallery.html", "contact.html", "terms.html"]) {
  app.get(`/${page}`, async (req, res, next) => {
    try {
      let html = await readFile(path.join(root, page || "index.html"), "utf8");
      const title = /<title>(.*?)<\/title>/.exec(html)?.[1] || "The Don's Place";
      const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || "";
      const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : null;
      const slug = typeof req.query.slug === "string" && /^[a-z0-9-]{1,200}$/.test(req.query.slug) ? req.query.slug : "";
      const canonicalPath = page === "index.html" ? "/" : req.path;
      const canonical = origin ? origin + canonicalPath + (page === "apartment.html" && slug ? `?slug=${slug}` : "") : "";
      const tags = `<meta property="og:type" content="website"><meta property="og:site_name" content="The Don's Place"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">` +
        (canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(origin + "/assets/logo.png")}">` : "");
      html = html.replace("</head>", tags + "</head>");
      res.set("Cache-Control", "no-cache").type("html").send(html);
    } catch (error) { next(error); }
  });
}
app.use(express.static(root, { extensions: ["html"], setHeaders(res, file) { if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache"); } }));
app.use((_req, res) => { res.status(404).sendFile(path.join(root, "404.html")); });
app.use((_error, _req, res, _next) => { res.status(500).type("text/plain").send("The page could not be loaded. Please try again."); });
const port = Number(process.env.PORT);
if (!port) throw new Error("PORT is required.");
app.listen(port, "0.0.0.0");
