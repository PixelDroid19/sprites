// Recortes ampliados de la hoja (nearest-neighbour) de todas las figuras.
// Uso: npx tsx .claude/skills/sprite-desde-referencia/scripts/reference-zoom.ts out.png [escala] [alto]
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const [out = "zoom.png", s = "3", hh = "130"] = process.argv.slice(2);
const root = process.cwd();
const { createCanvas, loadImage } = await import(
  resolve(root, "node_modules/@napi-rs/canvas/index.js")
);
const { REFERENCE_SPRITES } = await import(
  resolve(root, "src/nina-gatita/sprites.generated.ts")
);
const { SPRITE_IDS } = await import(resolve(root, "src/nina-gatita/rig.ts"));
const ref = await loadImage(
  resolve(root, "public/referencia/nina-gatita-referencia.webp"),
);
const S = Number(s);
const W = 210;
const H = Number(hh);
const cols = 3;
const rows = Math.ceil(SPRITE_IDS.length / cols);
const cv = createCanvas(W * S * cols, H * S * rows);
const c = cv.getContext("2d");
c.imageSmoothingEnabled = false;
(SPRITE_IDS as string[]).forEach((id, i) => {
  const [x0, y0] = REFERENCE_SPRITES[id].box;
  c.drawImage(
    ref,
    x0 - 10,
    y0 - 15,
    W,
    H,
    (i % cols) * W * S,
    Math.floor(i / cols) * H * S,
    W * S,
    H * S,
  );
  c.fillStyle = "#000";
  c.font = "16px sans-serif";
  c.fillText(id, (i % cols) * W * S + 6, Math.floor(i / cols) * H * S + 18);
});
writeFileSync(out, cv.toBuffer("image/png"));
console.log(`escrito ${out}`);
