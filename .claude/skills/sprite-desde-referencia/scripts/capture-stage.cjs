// Captura el escenario en las 8 direcciones (con el gatito en la cabeza) y
// monta una tira ampliada centrada en la cabeza.
// Requisitos: `npx vite preview --port 4176` en marcha.
// Uso: node .claude/skills/sprite-desde-referencia/scripts/capture-stage.cjs out.png [url]
const path = require("node:path");
const fs = require("node:fs");
const root = process.cwd();
let pw;
try {
  pw = require(path.join(root, "node_modules/playwright"));
} catch {
  pw = require("/opt/node22/lib/node_modules/playwright");
}
const { createCanvas, loadImage } = require(
  path.join(root, "node_modules/@napi-rs/canvas"),
);
const out = process.argv[2] || "dirs.png";
const url = process.argv[3] || "http://localhost:4176/";
const DIRS = [
  ["ArrowDown"],
  ["ArrowDown", "ArrowLeft"],
  ["ArrowLeft"],
  ["ArrowUp", "ArrowLeft"],
  ["ArrowUp"],
  ["ArrowUp", "ArrowRight"],
  ["ArrowRight"],
  ["ArrowDown", "ArrowRight"],
];
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url, { waitUntil: "load" });
  const st = p.locator('section[aria-label="Niña Gatita: escenario"]');
  await st.scrollIntoViewIfNeeded();
  const cv = st.locator("canvas");
  await st.locator(".ng-screen-wrap").focus();
  const shots = [];
  for (const keys of DIRS) {
    for (const k of keys) await p.keyboard.down(k);
    await p.waitForTimeout(120);
    for (const k of keys) await p.keyboard.up(k);
    await p.waitForTimeout(900);
    shots.push(await cv.screenshot());
  }
  await b.close();
  // Recorte alrededor del gatito (primer amarillo desde arriba).
  const W = 180,
    H = 120,
    Z = 2;
  const strip = createCanvas(W * 4 * Z, H * 2 * Z);
  const sc = strip.getContext("2d");
  sc.imageSmoothingEnabled = false;
  for (let i = 0; i < shots.length; i++) {
    const img = await loadImage(shots[i]);
    const t = createCanvas(img.width, img.height);
    const tc = t.getContext("2d");
    tc.drawImage(img, 0, 0);
    const d = tc.getImageData(0, 0, img.width, img.height).data;
    let minY = Infinity,
      sx = 0,
      n = 0;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const o = (y * img.width + x) * 4;
        if (d[o] > 220 && d[o + 1] > 150 && d[o + 1] < 200 && d[o + 2] < 120) {
          minY = Math.min(minY, y);
          sx += x;
          n++;
        }
      }
    const cx = n ? sx / n : img.width / 2;
    const cy = n ? minY : img.height / 3;
    sc.drawImage(
      t,
      cx - W / 2,
      cy - 10,
      W,
      H,
      (i % 4) * W * Z,
      Math.floor(i / 4) * H * Z,
      W * Z,
      H * Z,
    );
  }
  fs.writeFileSync(out, strip.toBuffer("image/png"));
  console.log(`escrito ${out}; errores de página: ${JSON.stringify(errors)}`);
  process.exit(errors.length ? 1 : 0);
})();
