import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { configuredSiteOrigin, httpsOrigin, pageMetadata, vercelConfig } from "./vercel-config.mjs";

// Only Node built-ins are used. The existing HTML, CSS and browser JS do not
// require the Replit/Vite development plugins or backend packages on Vercel.
// Vercel occasionally starts a build without applying project env vars. The
// user's verified canonical domain is stable; the backend origin remains
// mandatory because pointing API traffic at the wrong service is unsafe.
const site = configuredSiteOrigin(process.env.SITE_URL);
const config = vercelConfig(process.env.REPLIT_API_ORIGIN, site);
const artifact = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(artifact, "../..");
const output = path.join(root, ".vercel/output");
const files = path.join(output, "static");
await rm(output, { recursive: true, force: true });
await mkdir(files, { recursive: true });
await cp(path.join(artifact, "public"), files, { recursive: true });
await cp(path.join(artifact, "index.html"), path.join(files, "index.html"));
for (const page of ["index.html", "apartments.html", "apartment.html", "gallery.html", "contact.html", "terms.html"]) {
  const file = path.join(files, page);
  await writeFile(file, pageMetadata(await readFile(file, "utf8"), page, site));
}
await writeFile(path.join(files, "robots.txt"), `User-agent: *\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(path.join(output, "config.json"), JSON.stringify(config, null, 2) + "\n");
console.info("Prepared Vercel static output with same-origin Replit API routing. No server credentials were copied.");
