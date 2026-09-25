// Propone una paleta para una hoja nueva: agrupa (k-means en Lab) los
// colores de las figuras y lista cada grupo con su color y su peso.
//   npx tsx scripts/derive-palette.ts hoja.png "[x0,y0,x1,y1];[...]" [k]
// Después se nombra cada color por función (contorno, base, sombra, luz…)
// y se descartan o fusionan los que solo son antialiasado.
import { createCanvas, loadImage } from "@napi-rs/canvas";

type Lab = [number, number, number];

function toLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const d2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

async function main() {
  const [file, boxesArg, kArg] = process.argv.slice(2);
  const k = Number(kArg ?? 24);
  const boxes = boxesArg.split(";").map((b) => JSON.parse(b) as number[]);
  const img = await loadImage(file);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const px: { rgb: number[]; lab: Lab }[] = [];
  for (const [x0, y0, x1, y1] of boxes) {
    const { data } = ctx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    // Una muestra de cada 3 px basta y evita sobrepesar los bordes.
    for (let i = 0; i < data.length; i += 12)
      if (data[i + 3] > 240) {
        const rgb = [data[i], data[i + 1], data[i + 2]];
        px.push({ rgb, lab: toLab(rgb[0], rgb[1], rgb[2]) });
      }
  }
  // k-means++ determinista (semilla fija).
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const centers: Lab[] = [px[Math.floor(rand() * px.length)].lab];
  while (centers.length < k) {
    const dist = px.map((p) => Math.min(...centers.map((ce) => d2(p.lab, ce))));
    let r = rand() * dist.reduce((a, b) => a + b, 0);
    let i = 0;
    while ((r -= dist[i]) > 0) i++;
    centers.push(px[i].lab);
  }
  let groups: number[] = [];
  for (let it = 0; it < 40; it++) {
    groups = px.map((p) => centers.reduce((best, ce, i) => (d2(p.lab, ce) < d2(p.lab, centers[best]) ? i : best), 0));
    centers.forEach((_, i) => {
      const members = px.filter((_, j) => groups[j] === i);
      if (members.length)
        centers[i] = [0, 1, 2].map((ch) => members.reduce((s, m) => s + m.lab[ch], 0) / members.length) as Lab;
    });
  }
  const out = centers
    .map((ce, i) => {
      const members = px.filter((_, j) => groups[j] === i).map((m) => m.rgb);
      const med = [0, 1, 2].map((ch) => members.map((m) => m[ch]).sort((a, b) => a - b)[Math.floor(members.length / 2)] ?? 0);
      return { L: ce[0], hex: "#" + med.map((v) => v.toString(16).padStart(2, "0")).join(""), n: members.length };
    })
    .sort((a, b) => a.L - b.L);
  for (const o of out) console.log(`${o.hex}  L=${o.L.toFixed(0).padStart(3)}  ${o.n} muestras`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
