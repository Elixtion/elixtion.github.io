# Team Resistance, FRC Team 86 website

A static website built with [Eleventy](https://www.11ty.dev/), styled as a CAD drawing:
- **Grid and origin:** a dark viewport with a grid whose origin sits at each page's title.
- **Drawing parts:** dimension lines, numbered figures, and lettered detail views that zoom the grid as you scroll.
- **Title block:** a drawing title block as the footer.

Pages are Markdown files or small data files. Layouts, menus, charts and listings update themselves, so every new page matches the rest of the site.

## Quick start

```bash
npm install
npm run fetch-brand   # one time: downloads the official logos into src/assets/logos/
npm start             # dev server at http://localhost:8080 with live reload
npm run build         # production build to _site/
```

## Adding content

| To add… | Do this | It shows up automatically in… |
|---|---|---|
| **A robot season** | Copy `src/history/_TEMPLATE.md` to `src/history/2027-gamename.md` and fill it in | The Robots menu and `/history/`. On the home page it becomes the new robot in the 1996-vs-now comparison and the "latest robot" section, and the "N seasons" dimension updates. Also the older/newer links. |
| **An award** | Add a line to `src/_data/awards.json` (`"win": true` for event wins) | The record chart and table on the home and awards pages, and that year's season page. |
| **A FIRST Championship trip** | Add a line to `src/_data/championships.json` | The same places, marked with a green triangle. |
| **A sponsor** | Add an entry to `src/_data/sponsors.json` | The home page and the sponsors page. |
| **A resource page** | Add `src/resources/my-page.md` with `title`, `navLabel`, `order` and `lead` | The Resources menu, `/resources/` and the footer. |
| **A newsletter** | Add `src/newsletter/issues/2026-11-november.md` with `title`, `date`, `summary` and `pdf` | `/newsletter/` |
| **Any other page** | Add `src/my-page.md` with `layout: layouts/page.njk`, `title` and an optional `note` | Add it to `src/_data/nav.js` if it belongs in the menu. |

Home page copy is in `src/_data/site.js` (`intro`, `statement`, `lede` and `record`). In `record`, words in `[brackets]` are highlighted in gold.

Files whose names start with `_` never publish, so you can keep drafts and templates beside real pages.

### Inside Markdown

```njk
{% gallery photos.build, "Build season photos" %}   {# numbered figures with a photo viewer #}
{% callout "Heads up" %}Some **Markdown**.{% endcallout %}
{% recordChart awards, championships %}             {# the season timeline #}
```

Figures number themselves (Fig. 1, Fig. 2…) across each page. Gallery photos keep their own shape, so portrait photos show in full: give each photo `w` and `h` (its pixel size) and the layout reserves the right space before it loads. Add `tall: true` to a season's `hero` if the main photo is portrait.

### Robot illustrations

Each season can have a drawing of its robot: set `illustration: /assets/robots/2026.svg` in the season file. It appears beside the season title, on its card on `/history/`, and in the "recent robots" lineup on the home page. The drawings for 2023 to 2026 live in `src/assets/robots/`. To add one, copy an existing SVG and keep its `r-` class names, which the draw-on animation relies on.

### Motion

- **Grid:** scrolls slower than the page, which gives a parallax effect. The construction lines through the title fade out as soon as you scroll.
- **Drawing on:** dimension lines draw outward from the center, framed photos wipe in, the record chart stacks up in year order, and robot illustrations are outlined and then filled in.
- **Reduced motion:** all of it switches off for people who set "reduce motion," and without JavaScript everything shows normally.

## Components

All in `src/_includes/components/ui.njk`. Import them `with context`:

| Macro | What it draws |
|---|---|
| `pageHeader(title, note, noteLead, dimLabel)` | The big title (the CAD origin), a leader-line note and an optional dimension line |
| `dim(label)` | A dimension line with arrows |
| `detailHead(letter, title, id)` | A lettered detail bubble and heading. Put `data-zoom="2.5"` on the section to zoom the grid there. |
| `figure(src, alt, caption)` | A framed, auto-numbered figure |
| `seasonCard(season)` | A robot season card |
| `resultsTable(events, specs, caption, alliance)` | Robot specs and event results |
| `recordTable(rows, collapseAfter, linkUrl, linkLabel)` | The season-by-season record |
| `legend()` | The award / event win / Championship key |
| `sponsorGrid(sponsors, labelledby)` | The sponsor logo grid |
| `docList(documents)` | Downloadable documents |

**Long lists collapse.** `recordTable(rows, 5)` shows five seasons and folds the rest into a "Show N earlier seasons" control, which is a native `<details>` element. Use collapsing for summaries on overview pages. On a page the visitor chose for the details (like `/awards/` or a season page), leave out the number so everything shows.

## Settings to fill in

These are in `src/_data/site.js`:
- **`contactFormAction`:** your form service URL (Formspree, Basin, Netlify Forms…). Until it's set, the contact page shows a notice for admins.
- **`donateUrl`:** your PayPal/Venmo link. Donate links only appear once this is set.
- **`emails`:** contact addresses by topic.
- **YouTube** under `social`.

`src/_data/championships.json` lists only the five FIRST Championship years confirmed so far (1998, 2010, 2017, 2022, 2025). The team reports nine, so add the rest.

## Accessibility (WCAG 2.2 AA)

- **Structure:** a skip link, landmarks, one `h1` per page, logical headings, and `aria-current` in the navigation.
- **Menus:** disclosure buttons for the menus. Escape closes them and returns focus, and they still work without JavaScript.
- **Focus and contrast:** a visible gold focus ring, targets of at least 44 px, and text contrast of at least 7:1 on the dark background.
- **The CAD grid:** purely decorative. It is hidden from assistive technology and hidden in high-contrast mode. It doesn't zoom for people who set "reduce motion." The coordinate readout only appears with a mouse.
- **Charts:** the record chart is visual only, and the table below it carries the same information as text.
- **Photo viewer:** a native `<dialog>` with focus return, arrow keys and an announced "Photo X of Y."
- **Forms:** labels, `autocomplete`, and an error summary that takes focus.
- **Alt text:** the build fails if any `<img>` is missing an `alt` attribute.

Run the automated audit (axe-core, desktop and mobile, every page):

```bash
npx playwright install chromium   # first time only
npm run build && npm run test:a11y
```

Photo alt text was written from the old site's captions. Review it against the actual photos.

## Before launch

Photos, sponsor logos and PDFs still load from the current WordPress uploads folder. Copy them into `src/assets/img/` and `src/assets/docs/` and update the paths before you shut WordPress down. URLs match the current site (`/history/2026-rebuilt/`, `/fees/`, `/codeofconduct/`, …), so existing links keep working.

## Deploying

`_site/` is plain HTML, CSS and JS. Host it on GitHub Pages, Netlify, Cloudflare Pages or any static host. The build command is `npm run build` and the output folder is `_site`.
