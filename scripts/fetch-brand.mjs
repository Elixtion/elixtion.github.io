// Downloads the official Team Resistance logo files into src/assets/logos/
// so the site self-hosts them. Run once: `npm run fetch-brand`.
// The logos are used exactly as supplied — never edit, recolor or re-stack them
// (see https://brand.teamresistance.org/guidelines.html).
import fs from "node:fs/promises";

const BASE = "https://brand.teamresistance.org/assets/logos/";
const FILES = ["logo-horizontal-dark.svg", "logo-horizontal-light.svg", "logo-vertical-dark.svg", "brandmark-dark.svg"];
const OUT = new URL("../src/assets/logos/", import.meta.url);

await fs.mkdir(OUT, { recursive: true });
let ok = 0;
for (const f of FILES) {
  try {
    const res = await fetch(BASE + f);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fs.writeFile(new URL(f, OUT), Buffer.from(await res.arrayBuffer()));
    console.log(`✓ ${f}`);
    ok++;
  } catch (err) {
    console.warn(`✗ ${f}: ${err.message}. Download it manually from ${BASE}${f}`);
  }
}
console.log(`${ok}/${FILES.length} logos saved to src/assets/logos/`);
