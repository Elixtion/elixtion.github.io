// Eleventy configuration for the Team Resistance (FRC 86) website.
// Day-to-day edits never touch this file: add a Markdown file or a line of
// data, and the layouts, menus, charts and listings update themselves.
import fs from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";

const BRAND_HOST = "https://brand.teamresistance.org/assets/logos/";
const LOGOS = ["logo-horizontal-dark", "logo-horizontal-light", "logo-vertical-dark", "brandmark-dark"];
const FIRST_YEAR = 1996;

// Awards that come with a blue banner. An award can override this with
// "banner": true or "banner": false in awards.json.
const BANNER_AWARDS = /\b(winner|chairman's|impact award|engineering inspiration|woodie flowers)/i;
const isBanner = (a) => a.banner ?? Boolean(a.win || BANNER_AWARDS.test(a.award || ""));

// Photos are resized and converted at build time (see the "images" transform).
// Remote photos are only fetched on the build server (CI) or with IMG_REMOTE=1.
const FETCH_REMOTE = process.env.CI === "true" || process.env.IMG_REMOTE === "1";
const DEFAULT_SIZES = "(min-width: 80rem) 77rem, 100vw";

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


  // ---------- Blue banners ----------
  // {{ awards | banners }} lists the banner awards, newest first.
  eleventyConfig.addFilter("banners", (awards) =>
    (awards || []).filter(isBanner).sort((a, b) => b.year - a.year)
  );
  // {{ award | bannerSvg | safe }} draws one banner. Text wraps to fit.
  const wrap = (text, max) => {
    const lines = [];
    for (const word of String(text).split(/\s+/)) {
      const last = lines[lines.length - 1];
      if (last && (last + " " + word).length <= max) lines[lines.length - 1] = last + " " + word;
      else lines.push(word);
    }
    return lines;
  };
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  eleventyConfig.addFilter("bannerSvg", (a) => {
    const award = wrap(a.award.toUpperCase(), 11);
    const event = wrap(a.event, 16);
    const fs1 = award.length > 3 ? 25 : 30;
    const lh1 = fs1 + 3;
    const mid = 212; // award text is centred on this line
    const awardTop = mid - ((award.length - 1) * lh1) / 2 + fs1 * 0.35;
    const eventTop = mid + ((award.length - 1) * lh1) / 2 + 58;
    const tspans = (lines, y0, lh) => lines.map((l, i) => `<tspan x="120" y="${(y0 + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join("");
    const label = `Blue banner: ${a.year} ${a.event}, ${a.award}`;
    const id = `bb${a.year}${a.award.length}${a.event.length}`;
    return `<svg class="bb" viewBox="0 0 240 380" role="img" aria-label="${esc(label)}">
<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#00549B"/><stop offset=".18" stop-color="#0A6DBF"/><stop offset=".5" stop-color="#0063AF"/><stop offset=".82" stop-color="#0A6DBF"/><stop offset="1" stop-color="#00549B"/></linearGradient></defs>
<rect class="bb__cloth" x="0" y="0" width="240" height="380" fill="url(#${id})"/>
<rect x="0" y="0" width="240" height="24" fill="#003F7A"/>
<circle cx="20" cy="12" r="5" fill="#C9CFD3" stroke="#0B0E0C" stroke-width="1.5"/><circle cx="220" cy="12" r="5" fill="#C9CFD3" stroke="#0B0E0C" stroke-width="1.5"/>
<rect x="12" y="36" width="216" height="332" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.5"/>
<g fill="#fff" text-anchor="middle" font-family="'Barlow Condensed', 'Arial Narrow', sans-serif">
<text x="120" y="64" font-size="11" font-weight="600" letter-spacing="2.2">FIRST ROBOTICS COMPETITION</text>
<text x="120" y="122" font-size="48" font-weight="800">${a.year}</text>
<rect x="94" y="138" width="52" height="2"/>
<text font-size="${fs1}" font-weight="800">${tspans(award, awardTop, lh1)}</text>
<text font-size="19" font-weight="600" fill-opacity=".92">${tspans(event, eventTop, 22)}</text>
</g></svg>`;
  });

  // ---------- Sponsors ----------
  // Groups sponsors by band (see _data/sponsorBands.json). Sponsors without a
  // band come last, in a group with no heading.
  eleventyConfig.addFilter("byBand", (sponsors, bands) => {
    const groups = (bands || []).map((b) => ({ ...b, sponsors: (sponsors || []).filter((s) => s.band === b.id) }));
    const known = new Set((bands || []).map((b) => b.id));
    const rest = (sponsors || []).filter((s) => !known.has(s.band));
    if (rest.length) groups.push({ id: "other", name: "", logo: 44, cell: "11rem", sponsors: rest });
    return groups.filter((g) => g.sponsors.length);
  });
  eleventyConfig.addFilter("bandOf", (bands, id) => (bands || []).find((b) => b.id === id) || { logo: 44, cell: "11rem" });

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
  <a class="frame gallery__link" href="${img.src}"><span class="frame__img"><img src="${img.src}" alt="${img.alt ?? ""}"${dims} data-sizes="(min-width: 80rem) 19rem, (min-width: 40rem) 45vw, 100vw" loading="lazy" decoding="async"></span></a>
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


  // ---------- Photo optimisation ----------
  // Every <img> on the site is resized to a few widths and served as WebP,
  // with the original format as a fallback. width/height are filled in so the
  // page never jumps while photos load. Add data-sizes="…" to an <img> when it
  // shows much smaller than full width. SVGs are left alone.
  const optimised = new Map();
  const optimise = (src) => {
    if (!src || src.startsWith("data:") || /\.svg(\?|#|$)/i.test(src)) return null;
    const remote = /^https?:\/\//i.test(src);
    if (remote && !FETCH_REMOTE) return null;
    const input = remote ? src : path.join("src", decodeURI(src));
    if (!remote && !fs.existsSync(input)) return null;
    if (!optimised.has(src)) {
      optimised.set(
        src,
        Image(input, {
          widths: [480, 960, 1600],
          formats: ["webp", "auto"],
          outputDir: "_site/img/",
          urlPath: "/img/",
          cacheOptions: { duration: "30d" },
          sharpJpegOptions: { quality: 78, progressive: true },
          sharpWebpOptions: { quality: 76 },
        })
          .then((m) => m || (console.warn(`[img] Could not fetch ${src}; using the original`), null))
          .catch((e) => {
            console.warn(`[img] Could not process ${src}: ${e.message}`);
            return null;
          })
      );
    }
    return optimised.get(src);
  };
  const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
  eleventyConfig.addTransform("images", async function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    const tags = [...new Set(content.match(/<img\b[^>]*>/g) || [])];
    let out = content;
    for (const tag of tags) {
      const src = attr(tag, "src");
      const sizes = attr(tag, "data-sizes") || DEFAULT_SIZES;
      const clean = tag.replace(/\sdata-sizes="[^"]*"/, "");
      const meta = await optimise(src);
      if (!meta) { out = out.split(tag).join(clean); continue; }
      const fallback = Object.entries(meta).find(([f]) => f !== "webp")?.[1] || meta.webp;
      const big = fallback[fallback.length - 1];
      let img = clean.replace(/\ssrc="[^"]*"/, ` src="${big.url}" srcset="${fallback.map((x) => x.srcset).join(", ")}" sizes="${sizes}"`);
      if (!/\swidth="/.test(img)) img = img.replace(/^<img/, `<img width="${big.width}" height="${big.height}"`);
      const webp = meta.webp && meta.webp !== fallback
        ? `<source type="image/webp" srcset="${meta.webp.map((x) => x.srcset).join(", ")}" sizes="${sizes}">` : "";
      out = out.split(tag).join(`<picture>${webp}${img}</picture>`);
      // Gallery links open the large version in the photo viewer.
      out = out.split(`href="${src}"`).join(`href="${(meta.webp || fallback).at(-1).url}"`);
    }
    return out;
  });

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
