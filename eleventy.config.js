// Eleventy configuration for the Team Resistance (FRC 86) website.
// Day-to-day edits never touch this file: add a Markdown file or a line of
// data, and the layouts, menus, charts and listings update themselves.
import fs from "node:fs";
import path from "node:path";

const BRAND_HOST = "https://brand.teamresistance.org/assets/logos/";
const LOGOS = ["logo-horizontal-dark", "logo-horizontal-light", "logo-vertical-dark", "brandmark-dark"];
const FIRST_YEAR = 1996;

export default function (eleventyConfig) {
  // Files starting with "_" (templates, drafts) never publish.
  eleventyConfig.ignores.add("src/**/_*.md");

  // ---------- Static files ----------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  const fontFiles = {
    barlow: ["latin-400-normal", "latin-600-normal"],
    "barlow-condensed": ["latin-600-normal", "latin-800-normal"],
  };
  for (const [family, variants] of Object.entries(fontFiles)) {
    for (const v of variants) {
      eleventyConfig.addPassthroughCopy({
        [`node_modules/@fontsource/${family}/files/${family}-${v}.woff2`]: `assets/fonts/${family}-${v}.woff2`,
      });
    }
  }

  // ---------- Brand logos ----------
  // Local copy if `npm run fetch-brand` has been run, otherwise the official files.
  eleventyConfig.addGlobalData("logos", () => {
    const out = {};
    for (const name of LOGOS) {
      const local = path.join("src/assets/logos", `${name}.svg`);
      out[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = fs.existsSync(local)
        ? `/assets/logos/${name}.svg`
        : `${BRAND_HOST}${name}.svg`;
    }
    return out;
  });

  // ---------- Collections ----------
  eleventyConfig.addCollection("seasons", (api) =>
    api.getFilteredByGlob("src/history/*.md").sort((a, b) => b.data.year - a.data.year)
  );
  eleventyConfig.addCollection("resources", (api) =>
    api
      .getFilteredByGlob("src/resources/*.md")
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99) || a.data.title.localeCompare(b.data.title))
  );
  eleventyConfig.addCollection("issues", (api) =>
    api.getFilteredByGlob("src/newsletter/issues/*.md").sort((a, b) => b.date - a.date)
  );

  // ---------- Filters ----------
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("byYear", (items, year) => (items || []).filter((a) => a.year === year));
  eleventyConfig.addFilter("where", (arr, key, val) => (arr || []).filter((x) => x[key] === val));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("skip", (arr, n) => (arr || []).slice(n));
  eleventyConfig.addFilter("last", (arr) => (arr || [])[arr.length - 1]);
  eleventyConfig.addFilter("seasonUrl", (seasons, year) => (seasons || []).find((s) => s.data.year === year)?.url || "");
  eleventyConfig.addFilter("isCurrent", (navUrl, pageUrl) =>
    navUrl === "/" ? pageUrl === "/" : pageUrl && pageUrl.startsWith(navUrl)
  );
  eleventyConfig.addFilter("letter", (i) => String.fromCharCode(65 + i)); // 0 -> A
  eleventyConfig.addFilter("seasonsSince", (year) => new Date().getFullYear() - FIRST_YEAR);

  // "More than [50 events] and [5 wins]" -> gold emphasis on the bracketed parts.
  eleventyConfig.addFilter("emphasize", (text) =>
    String(text || "").replace(/\[([^\]]+)\]/g, "<em>$1</em>")
  );

  // Sum "W-L-T" strings across a season's events.
  eleventyConfig.addFilter("recordTotal", (events) => {
    const t = [0, 0, 0];
    for (const e of events || []) {
      const parts = String(e.record || "").split("-").map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) parts.forEach((n, i) => (t[i] += n));
    }
    return t.some(Boolean) ? t.join("-") : null;
  });
  eleventyConfig.addFilter("bestRank", (events) => {
    const ranks = (events || []).map((e) => Number(e.rank)).filter(Number.isFinite);
    return ranks.length ? Math.min(...ranks) : null;
  });

  // Merge awards.json and championships.json into one row per season (newest first).
  const buildRecord = (awards, champs) => {
    const map = new Map();
    const row = (y) => {
      if (!map.has(y)) map.set(y, { year: y, awards: [], win: false, championship: null });
      return map.get(y);
    };
    for (const a of awards || []) {
      const r = row(a.year);
      r.awards.push(a);
      if (a.win) r.win = true;
    }
    for (const c of champs || []) row(c.year).championship = c;
    return [...map.values()].sort((a, b) => b.year - a.year);
  };
  eleventyConfig.addFilter("record", buildRecord);

  // ---------- Shortcodes ----------
  // Timeline chart of every award, event win and Championship appearance.
  // {% recordChart awards, championships %}
  eleventyConfig.addShortcode("recordChart", (awards, champs) => {
    const end = new Date().getFullYear();
    const span = end - FIRST_YEAR;
    const pos = (y) => (((y - FIRST_YEAR) / span) * 100).toFixed(3);
    const out = [];
    for (let y = FIRST_YEAR; y <= end; y++) {
      const major = (y - FIRST_YEAR) % 5 === 0 || y === end;
      out.push(`<i class="t${major ? " M" : ""}" style="left:${pos(y)}%"></i>`);
      if (major) out.push(`<span class="ty" style="left:${pos(y)}%">${y}</span>`);
    }
    for (const r of buildRecord(awards, champs)) {
      const ordered = [...r.awards].sort((a, b) => (b.win ? 1 : 0) - (a.win ? 1 : 0));
      ordered.forEach((a, k) =>
        out.push(`<b class="sq${a.win ? " w" : ""}" style="left:${pos(r.year)}%;bottom:${14 + k * 13}px"></b>`)
      );
      if (r.championship) out.push(`<em class="ch" style="left:${pos(r.year)}%"></em>`);
    }
    return `<div class="chart" aria-hidden="true">${out.join("")}</div>`;
  });

  // Photo gallery as numbered figures. {% gallery photos.build, "Build season photos" %}
  eleventyConfig.addShortcode("gallery", function (images, label = "Photo gallery") {
    if (!images || !images.length) return "";
    const items = images
      .map((img, i) => {
        if (img.alt === undefined) {
          console.warn(`[a11y] Missing alt text in gallery "${label}" on ${this.page.inputPath} (image ${i + 1})`);
        }
        const dims = img.w && img.h ? ` width="${img.w}" height="${img.h}" style="aspect-ratio:${img.w}/${img.h}"` : "";
        return `<li${img.tall ? ' class="is-tall"' : ""}><figure class="fig">
  <a class="frame gallery__link" href="${img.src}"><img src="${img.src}" alt="${img.alt ?? ""}"${dims} loading="lazy" decoding="async"></a>
  <figcaption><span class="fig-no" aria-hidden="true"></span><span>${img.caption || ""}</span></figcaption>
</figure></li>`;
      })
      .join("\n");
    return `<div class="gallery" data-gallery><ul class="gallery__grid" role="list" aria-label="${label}">\n${items}\n</ul></div>`;
  });

  // {% callout "Title" %}Markdown{% endcallout %} — drawn as a leader note.
  eleventyConfig.addPairedShortcode("callout", (content, title = "") => {
    const head = title ? `<p class="callout__title">${title}</p>` : "";
    return `<aside class="callout">${head}\n\n${content}\n\n</aside>`;
  });

  // {% button "Label", "/url/", "primary" %}
  eleventyConfig.addShortcode("button", (label, href, variant = "primary") =>
    `<a class="btn btn--${variant}" href="${href}">${label}</a>`
  );

  // ---------- Build-time accessibility guard ----------
  eleventyConfig.addTransform("a11y-img-alt", function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      const missing = content.match(/<img(?![^>]*\balt=)[^>]*>/g);
      if (missing) throw new Error(`[a11y] <img> without alt in ${this.page.inputPath}:\n${missing.join("\n")}`);
    }
    return content;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
}
