// Automated accessibility audit (WCAG 2.2 A/AA rules via axe-core) for every
// built page, at desktop and mobile widths.
// Usage: npm run build && npm run test:a11y
// First run only: npx playwright install chromium
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || "_site");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png" };

const pages = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".html")) pages.push("/" + path.relative(ROOT, p).replace(/index\.html$/, "").replace(/\\/g, "/"));
  }
})(ROOT);

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
let failures = 0;
for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport });
  for (const url of pages.sort()) {
    const page = await ctx.newPage();
    await page.goto(base + url, { waitUntil: "load" });
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    const label = `${url} @${viewport.width}px`;
    if (violations.length) {
      failures += violations.length;
      console.log(`✗ ${label}`);
      for (const v of violations) console.log(`   [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})\n     ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n     ")}`);
    } else console.log(`✓ ${label}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} issue(s) found.` : `\nNo axe violations on ${pages.length} pages.`);
process.exit(failures ? 1 : 0);
