// Draws the T-handle hex key cursors and renders them as 32px and 64px PNGs.
// Run with `npm run cursors` after changing a colour; the PNGs are committed.
import fs from "node:fs";
import sharp from "sharp";

const OUT = "src/assets/cursor";
const variants = {
  // Default cursor: green grip.
  "t-handle": { grip: "#4FCB1F", rib: "#2B7A10" },
  // Over links and buttons: gold grip.
  "t-handle-link": { grip: "#FFCD00", rib: "#A88700" },
};

const svg = ({ grip, rib }) => {
  const ribs = [...Array(7)].map((_, i) => `<path d="M${13.2 + i * 3} 18.2 v6.6" stroke="${rib}" stroke-width="1"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M2.6 2.6 L21.5 21.5" stroke="#0B0E0C" stroke-width="5.2" stroke-linecap="square"/>
  <path d="M2.6 2.6 L21.5 21.5" stroke="#B9C1C5" stroke-width="2.9"/>
  <path d="M3.4 2.4 L21.6 20.6" stroke="#F2F4F5" stroke-width=".9"/>
  <g transform="rotate(-45 21.5 21.5)">
    <rect x="8.5" y="17.2" width="26" height="8.6" rx="2.6" fill="${grip}" stroke="#0B0E0C" stroke-width="1.5"/>
    ${ribs}
    <path d="M9.3 18 h2.2 v7 h-2.2z M31.5 18 h2.2 v7 h-2.2z" fill="#22282A"/>
    <path d="M12 18.4 h19" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
  </g>
</svg>`;
};

for (const [name, colours] of Object.entries(variants)) {
  const src = svg(colours);
  fs.writeFileSync(`${OUT}/${name}.svg`, src);
  for (const px of [32, 64]) {
    await sharp(Buffer.from(src), { density: 72 * (px / 32) }).resize(px, px).png().toFile(`${OUT}/${name}-${px}.png`);
  }
}
console.log("Cursors written to", OUT);
