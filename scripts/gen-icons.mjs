import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

const baseSvg = (size, padding) => {
  const half = size / 2;
  const r = (size - padding * 2) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="55%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fde68a" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#fde68a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="spark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff7d6"/>
      <stop offset="55%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#glow)"/>
  ${sparkle(half, half, r * 0.7, "url(#spark)")}
  ${sparkle(half - r * 0.55, half + r * 0.4, r * 0.18, "#fde68a", 0.85)}
  ${sparkle(half + r * 0.5, half - r * 0.5, r * 0.13, "#fde68a", 0.9)}
</svg>`;
};

function sparkle(cx, cy, size, fill, opacity = 1) {
  const arm = size;
  const waist = size * 0.18;
  const path = `
    M ${cx} ${cy - arm}
    Q ${cx + waist} ${cy - waist}, ${cx + arm} ${cy}
    Q ${cx + waist} ${cy + waist}, ${cx} ${cy + arm}
    Q ${cx - waist} ${cy + waist}, ${cx - arm} ${cy}
    Q ${cx - waist} ${cy - waist}, ${cx} ${cy - arm}
    Z`;
  return `<path d="${path}" fill="${fill}" opacity="${opacity}"/>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const sources = [
    { name: "icon-192.png", size: 192, padding: 0 },
    { name: "icon-512.png", size: 512, padding: 0 },
    { name: "icon-maskable-512.png", size: 512, padding: 64 },
    { name: "apple-touch-icon.png", size: 180, padding: 0 },
    { name: "favicon-32.png", size: 32, padding: 0 },
  ];

  for (const s of sources) {
    const svg = Buffer.from(baseSvg(s.size, s.padding));
    await sharp(svg).png().toFile(path.join(publicDir, s.name));
    console.log("wrote", s.name);
  }

  // Also write the source SVG for reference.
  await writeFile(
    path.join(publicDir, "icon-source.svg"),
    baseSvg(512, 0),
    "utf8",
  );
  console.log("wrote icon-source.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
