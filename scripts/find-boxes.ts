// Localiza las figuras de una hoja de referencia: componentes conexas de
// píxeles que no son fondo (transparente o del color del panel).
//   npx tsx scripts/find-boxes.ts hoja.png [r,g,b del fondo] [área mínima]
// Imprime una caja [x0, y0, x1, y1] por figura, lista para el extractor.
import { createCanvas, loadImage } from "@napi-rs/canvas";

async function main() {
  const [file, bgArg, minArg] = process.argv.slice(2);
  if (!file) throw new Error("uso: find-boxes.ts hoja.png [r,g,b] [área]");
  const bg = bgArg?.split(",").map(Number);
  const minArea = Number(minArg ?? 2000);
  const img = await loadImage(file);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width: w, height: h } = ctx.getImageData(0, 0, img.width, img.height);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    // Transparente siempre es fondo; con --bg, también el color del panel.
    const isBg = a < 128 || (bg !== undefined && Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 40);
    solid[i] = isBg ? 0 : 1;
  }
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!solid[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let [x0, y0, x1, y1, area] = [w, h, 0, 0, 0];
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      area++;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const j = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
    }
    if (area >= minArea) console.log(JSON.stringify([x0, y0, x1, y1]), `área ${area}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
