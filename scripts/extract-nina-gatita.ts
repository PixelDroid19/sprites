// Extrae los sprites de la Niña Gatita de la hoja de referencia:
//   npm run extract
// Escribe src/nina-gatita/sprites.generated.ts.
//
// La hoja NO es pixel art real: es una imagen de 1536x1024 donde cada
// "píxel" mide entre 4 y 5 px de pantalla y la rejilla no es uniforme (el
// paso cambia de un sprite a otro y dentro del mismo sprite). Escalar con un
// factor fijo mezclaría celdas vecinas, así que el script:
//   1. Mide la fuerza de borde entre cada par de columnas (y de filas).
//   2. Elige los cortes de la rejilla con programación dinámica: saltos de
//      4-5 px (3 y 6 se penalizan) que caigan sobre los bordes más fuertes.
//   3. Toma de cada celda el píxel más cercano a la mediana (en Lab) de su
//      interior, sin el borde antialiasado.
//   4. Lo cuantiza al color más cercano de la paleta (distancia en Lab).
//   5. Limpia: quita la sombra del suelo (se pinta por código) y las motas
//      sueltas.
//   6. Aplica un puñado de correcciones manuales documentadas en FIXES,
//      donde la referencia pinta detalle más pequeño que su propia rejilla.
//   7. Cierra el contorno de la silueta.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { format } from "prettier";
import {
  PALETTE,
  PALETTE_KEYS,
  type PaletteKey,
} from "../src/nina-gatita/palette";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REFERENCE = join(ROOT, "public/referencia/nina-gatita-referencia.webp");
const OUT = join(ROOT, "src/nina-gatita/sprites.generated.ts");

// Cajas de cada figura en la hoja (px de la imagen, bordes incluidos) y la
// etiqueta que la hoja le pone debajo. `faces` es hacia dónde mira de verdad.
const CELLS = {
  abajoIzquierda: {
    label: "Abajo-Izquierda",
    faces: "abajo-izquierda",
    box: [83, 184, 284, 432],
  },
  abajo: { label: "Abajo", faces: "abajo", box: [378, 184, 563, 432] },
  abajoDerecha: {
    label: "Abajo-Derecha",
    faces: "abajo-derecha",
    box: [649, 184, 841, 432],
  },
  izquierdaFila1: {
    label: "Izquierda",
    faces: "derecha",
    box: [915, 182, 1084, 432],
  },
  derecha: { label: "Derecha", faces: "derecha", box: [31, 517, 207, 782] },
  arribaIzquierda: {
    label: "Arriba-Izquierda",
    faces: "abajo-derecha",
    box: [267, 517, 445, 782],
  },
  arriba: { label: "Arriba", faces: "arriba", box: [503, 517, 689, 782] },
  arribaDerecha: {
    label: "Arriba-Derecha",
    faces: "arriba-derecha",
    box: [745, 517, 919, 782],
  },
  izquierda: {
    label: "Izquierda",
    faces: "izquierda",
    box: [963, 517, 1124, 782],
  },
} as const;

type CellId = keyof typeof CELLS;

// Burbuja con corazón del panel "Detalle (Zoom)". Está sobre el beige
// opaco del panel, así que ese color se trata como transparente.
// Las correcciones quitan el rosa de mezcla del borde del corazón.
const HEART_BUBBLE = {
  box: [1443, 150, 1506, 226],
  background: [225, 209, 190],
  fixes: [
    [8, 3, "r"],
    [9, 3, "r"],
    [9, 7, "w"],
  ] as [number, number, PaletteKey][],
} as const;

// Correcciones manuales [x, y, color] sobre la rejilla ya extraída, cada
// una revisada contra su celda en la hoja. Solo donde la referencia dibuja
// un detalle más pequeño que una celda y la mediana lo pierde o lo mezcla:
// pupilas y boca del gatito, brillos y franjas claras de los ojos.
const FIXES: Partial<Record<CellId, [number, number, PaletteKey | "."][]>> = {
  abajo: [
    // Ojos del gatito (2x2) y hocico en su sitio.
    [16, 10, "k"],
    [17, 10, "k"],
    [22, 9, "k"],
    [23, 9, "k"],
    [22, 10, "k"],
    [23, 10, "k"],
    [18, 10, "R"],
    [19, 10, "s"],
    [18, 11, "p"],
    [19, 11, "s"],
    // Ojos: franja clara de 1 px, pupila negra al lado, sin grises de mezcla.
    [14, 31, "k"],
    [14, 32, "k"],
    [14, 33, "k"],
    [14, 34, "k"],
    [13, 31, "G"],
    [13, 32, "G"],
    [17, 29, "k"],
    [30, 29, "k"],
    [30, 30, "k"],
    [30, 31, "G"],
    [30, 32, "G"],
    [31, 30, "d"],
    [25, 30, "S"],
    [25, 31, "s"],
    [25, 32, "s"],
    [25, 33, "s"],
    [25, 34, "s"],
    [25, 35, "s"],
    [25, 36, "s"],
    [18, 36, "s"],
  ],
  abajoIzquierda: [
    // Ojos y hocico del gatito.
    [9, 8, "k"],
    [10, 8, "k"],
    [14, 8, "k"],
    [15, 8, "k"],
    [10, 10, "S"],
    [11, 10, "S"],
    [12, 10, "s"],
    // Ojos.
    [9, 28, "k"],
    [10, 28, "k"],
    [9, 29, "G"],
    [9, 32, "w"],
    [23, 29, "G"],
    [23, 30, "G"],
    [20, 34, "s"],
  ],
  abajoDerecha: [
    // Ojos y hocico del gatito.
    [25, 9, "k"],
    [26, 9, "k"],
    [26, 10, "k"],
    [30, 8, "k"],
    [30, 9, "k"],
    [31, 9, "y"],
    [28, 10, "R"],
    [29, 10, "c"],
    [28, 11, "p"],
    [29, 11, "s"],
    [30, 11, "s"],
    [30, 12, "s"],
    // Brillos y franjas claras de los ojos.
    [18, 32, "G"],
    [19, 32, "k"],
    [21, 32, "w"],
    [22, 32, "k"],
    [29, 32, "w"],
    [30, 32, "k"],
    [32, 32, "G"],
    [33, 30, "k"],
  ],
  izquierdaFila1: [
    // Ojos y boca del gatito.
    [22, 9, "k"],
    [23, 9, "k"],
    [27, 9, "k"],
    [25, 10, "p"],
    [25, 11, "R"],
    [26, 11, "R"],
    [26, 12, "s"],
    // Ojo: la mezcla gris era pupila; mechón sin rosa.
    [22, 32, "k"],
    [22, 33, "k"],
    [22, 34, "i"],
    [22, 35, "h"],
    [26, 29, "h"],
    [26, 30, "h"],
  ],
  derecha: [
    // Ojo y boca del gatito.
    [23, 7, "k"],
    [23, 8, "k"],
    [25, 9, "R"],
    [26, 9, "p"],
    [26, 8, "p"],
    [24, 11, "c"],
    [14, 10, "k"],
  ],
  izquierda: [
    // Boca del gatito y hueco de la cola enroscada.
    [8, 9, "R"],
    [7, 9, "s"],
    [9, 11, "k"],
    [19, 5, "."],
    [20, 5, "."],
    [19, 6, "."],
    [20, 6, "."],
    [19, 7, "."],
    [20, 7, "."],
    // Ojo.
    [9, 29, "G"],
    [12, 32, "s"],
  ],
  arribaIzquierda: [
    // Ojos, boca y hueco de la cola del gatito.
    [21, 8, "k"],
    [22, 8, "k"],
    [22, 9, "k"],
    [25, 9, "R"],
    [24, 10, "p"],
    [26, 10, "s"],
    [16, 5, "."],
    [16, 6, "."],
    // Ojos y boca.
    [16, 29, "k"],
    [16, 30, "k"],
    [16, 31, "k"],
    [16, 32, "k"],
    [18, 27, "S"],
    [21, 35, "S"],
    [22, 35, "S"],
  ],
};

const PAD = 6;
const ALPHA_MIN = 140;
const KEY = [0, 255, 0];
const GAP_PENALTY: Record<number, number> = { 3: 150, 4: 0, 5: 0, 6: 150 };
const EDGE_CAP = 40;

type Lab = [number, number, number];

function toLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const dist = (a: Lab, b: Lab) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const PALETTE_LAB = PALETTE_KEYS.map((key) => {
  const hex = PALETTE[key].hex;
  return {
    key,
    lab: toLab(
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ),
  };
});

function nearestKey(lab: Lab): { key: PaletteKey; delta: number } {
  let best = PALETTE_LAB[0];
  let bestD = Infinity;
  for (const entry of PALETTE_LAB) {
    const d = dist(lab, entry.lab);
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return { key: best.key, delta: bestD };
}

interface Crop {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
  // Lab de cada píxel compuesto sobre verde clave (el fondo es transparente).
  lab: Lab[];
}

// `background`: color de un panel opaco que debe contar como transparente.
function cropOf(
  data: Uint8ClampedArray,
  imgW: number,
  box: readonly number[],
  background?: readonly number[],
): Crop {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0 + 1 + PAD * 2;
  const h = y1 - y0 + 1 + PAD * 2;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const lab: Lab[] = [];
  const bgLab =
    background && toLab(background[0], background[1], background[2]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const src = ((y0 - PAD + y) * imgW + (x0 - PAD + x)) * 4;
      const dst = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) rgba[dst + c] = data[src + c];
      if (
        bgLab &&
        dist(toLab(data[src], data[src + 1], data[src + 2]), bgLab) < 8
      )
        rgba[dst + 3] = 0;
      const a = rgba[dst + 3] / 255;
      lab.push(
        toLab(
          data[src] * a + KEY[0] * (1 - a),
          data[src + 1] * a + KEY[1] * (1 - a),
          data[src + 2] * a + KEY[2] * (1 - a),
        ),
      );
    }
  return { w, h, rgba, lab };
}

// Fuerza de borde entre la línea i y la i+1 (columnas o filas).
function edgeProfile(crop: Crop, axis: "x" | "y"): number[] {
  const n = axis === "x" ? crop.w : crop.h;
  const m = axis === "x" ? crop.h : crop.w;
  const out: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) {
      const a = axis === "x" ? j * crop.w + i : i * crop.w + j;
      const b = axis === "x" ? a + 1 : a + crop.w;
      sum += Math.min(EDGE_CAP, dist(crop.lab[a], crop.lab[b]));
    }
    out.push(sum);
  }
  const sorted = [...out].sort((p, q) => p - q);
  const median = sorted[Math.floor(sorted.length / 2)];
  return out.map((v) => v - median);
}

// Cortes de la rejilla: posiciones 0..n donde cada salto es 3-6 px y la
// suma de bordes (menos la penalización del salto) es máxima.
function gridCuts(edge: number[], n: number): number[] {
  const score = (p: number) => (p > 0 && p < n ? edge[p - 1] : 0);
  const best = new Array<number>(n + 1).fill(-Infinity);
  const prev = new Array<number>(n + 1).fill(-1);
  for (let s = 0; s <= 6; s++) best[s] = score(s);
  for (let p = 1; p <= n; p++)
    for (const gapKey of Object.keys(GAP_PENALTY)) {
      const gap = Number(gapKey);
      const q = p - gap;
      if (q < 0 || best[q] === -Infinity) continue;
      const v = best[q] + score(p) - GAP_PENALTY[gap];
      if (v > best[p]) {
        best[p] = v;
        prev[p] = q;
      }
    }
  let end = n;
  for (let p = n - 6; p <= n; p++) if (best[p] > best[end]) end = p;
  const cuts = [end];
  while (prev[cuts[cuts.length - 1]] >= 0)
    cuts.push(prev[cuts[cuts.length - 1]]);
  return cuts.reverse();
}

// Interior de la celda: el borde de 1 px suele estar antialiasado.
function cellInterior(
  crop: Crop,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  const ix0 = x1 - x0 >= 4 ? x0 + 1 : x0;
  const ix1 = x1 - x0 >= 4 ? x1 - 1 : x1;
  const iy0 = y1 - y0 >= 4 ? y0 + 1 : y0;
  const iy1 = y1 - y0 >= 4 ? y1 - 1 : y1;
  const idx: number[] = [];
  for (let y = iy0; y < iy1; y++)
    for (let x = ix0; x < ix1; x++) idx.push(y * crop.w + x);
  return idx;
}

// Color de la celda: el píxel real más cercano a la mediana (en Lab) del
// interior, cuantizado a la paleta. Null si ese píxel es fondo.
function sampleCell(crop: Crop, idx: number[]): PaletteKey | null {
  const median = [0, 1, 2].map((c) => {
    const v = idx.map((i) => crop.lab[i][c]).sort((p, q) => p - q);
    return v[Math.floor(v.length / 2)];
  }) as Lab;
  let pick = idx[0];
  let pickD = Infinity;
  for (const i of idx) {
    const d = dist(crop.lab[i], median);
    if (d < pickD) {
      pickD = d;
      pick = i;
    }
  }
  if (crop.rgba[pick * 4 + 3] < ALPHA_MIN) return null;
  const rgb = crop.rgba.slice(pick * 4, pick * 4 + 3);
  return nearestKey(toLab(rgb[0], rgb[1], rgb[2])).key;
}

type Grid = string[][];

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const inside = (g: Grid, x: number, y: number) =>
  y >= 0 && y < g.length && x >= 0 && x < g[0].length;

// La sombra ovalada del suelo es gris "G" pegada al fondo: se inunda desde
// el exterior. El gris encerrado por contorno (zapatillas, ojos) se queda.
function removeGroundShadow(g: Grid) {
  const queue: [number, number][] = [];
  g.forEach((row, y) =>
    row.forEach((ch, x) => ch === "." && queue.push([x, y])),
  );
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (inside(g, nx, ny) && g[ny][nx] === "G") {
        g[ny][nx] = ".";
        queue.push([nx, ny]);
      }
    }
  }
}

// Borra islas opacas de menos de 6 píxeles separadas de la figura.
function dropSpecks(g: Grid) {
  const seen = g.map((row) => row.map(() => false));
  const islands: [number, number][][] = [];
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === "." || seen[y][x]) return;
      const island: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        island.push([cx, cy]);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (inside(g, nx, ny) && g[ny][nx] !== "." && !seen[ny][nx]) {
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
      }
      islands.push(island);
    }),
  );
  islands.sort((a, b) => b.length - a.length);
  for (const island of islands.slice(1))
    if (island.length < 6) for (const [x, y] of island) g[y][x] = ".";
}

// Colores de detalle que nunca se tratan como mota: brillos y rubor.
const DETAIL = new Set("wPpSe");

// Un píxel sin ningún vecino de su color, rodeado por 5+ vecinos de un
// mismo color, es ruido del reescalado: toma el color dominante.
function despeckle(g: Grid): Grid {
  const out = g.map((row) => [...row]);
  for (let y = 1; y < g.length - 1; y++)
    for (let x = 1; x < g[0].length - 1; x++) {
      const ch = g[y][x];
      if (ch === "." || DETAIL.has(ch)) continue;
      const counts = new Map<string, number>();
      let alone = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = g[y + dy][x + dx];
          if (n === ch) alone = false;
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
      if (!alone) continue;
      const [top, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (count >= 5 && top !== ".") out[y][x] = top;
    }
  return out;
}

// Todo píxel de la silueta que toca el fondo pasa a contorno si no es ya
// un tono oscuro: el contorno queda cerrado y de 1 px.
const DARK = new Set("kKdiD");
function closeOutline(g: Grid): Grid {
  const out = g.map((row) => [...row]);
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === "." || DARK.has(ch)) return;
      const touchesBg = N4.some(
        ([dx, dy]) => !inside(g, x + dx, y + dy) || g[y + dy][x + dx] === ".",
      );
      if (touchesBg) out[y][x] = "k";
    }),
  );
  return out;
}

// Recorta el margen transparente; devuelve también el desplazamiento.
function trim(g: Grid): { grid: Grid; left: number; top: number } {
  const top = g.findIndex((row) => row.some((ch) => ch !== "."));
  const rows = g.filter((row) => row.some((ch) => ch !== "."));
  const cols = rows[0]
    .map((_, x) => x)
    .filter((x) => rows.some((row) => row[x] !== "."));
  return {
    grid: rows.map((row) => row.slice(cols[0], cols[cols.length - 1] + 1)),
    left: cols[0],
    top,
  };
}

interface Extracted {
  rows: string[];
  pitch: [number, number];
  meanDeltaE: number;
  // Cortes de la rejilla en px de la hoja, alineados con la celda (0,0)
  // del sprite recortado: sirven para revisar la extracción celda a celda.
  cuts: { xs: number[]; ys: number[] };
}

function extract(
  data: Uint8ClampedArray,
  imgW: number,
  box: readonly number[],
  fixes: [number, number, PaletteKey | "."][],
  background?: readonly number[],
): Extracted {
  const crop = cropOf(data, imgW, box, background);
  const cx = gridCuts(edgeProfile(crop, "x"), crop.w);
  const cy = gridCuts(edgeProfile(crop, "y"), crop.h);
  let grid: Grid = [];
  for (let j = 0; j < cy.length - 1; j++) {
    const row: string[] = [];
    for (let i = 0; i < cx.length - 1; i++)
      row.push(
        sampleCell(
          crop,
          cellInterior(crop, cx[i], cx[i + 1], cy[j], cy[j + 1]),
        ) ?? ".",
      );
    grid.push(row);
  }
  removeGroundShadow(grid);
  dropSpecks(grid);
  grid = despeckle(grid);
  const { grid: cut, left, top } = trim(grid);
  for (const [x, y, ch] of fixes) cut[y][x] = ch;
  // El contorno se cierra al final: una corrección que abre un hueco (la
  // cola enroscada del gatito) también recibe su borde oscuro.
  const trimmed = closeOutline(cut);

  // ΔE medio entre el color final de cada celda opaca y los píxeles reales
  // de su interior: mide la fidelidad del resultado, correcciones incluidas.
  let deltaSum = 0;
  let opaque = 0;
  trimmed.forEach((row, j) =>
    row.forEach((ch, i) => {
      if (ch === ".") return;
      const target = PALETTE_LAB.find((p) => p.key === ch)!.lab;
      const idx = cellInterior(
        crop,
        cx[i + left],
        cx[i + left + 1],
        cy[j + top],
        cy[j + top + 1],
      );
      deltaSum +=
        idx.reduce((sum, k) => sum + dist(crop.lab[k], target), 0) / idx.length;
      opaque++;
    }),
  );
  const pitch = (cuts: number[]) =>
    Number(((cuts[cuts.length - 1] - cuts[0]) / (cuts.length - 1)).toFixed(2));
  return {
    rows: trimmed.map((row) => row.join("")),
    pitch: [pitch(cx), pitch(cy)],
    meanDeltaE: Number((deltaSum / opaque).toFixed(2)),
    cuts: {
      xs: cx.slice(left).map((v) => v + box[0] - PAD),
      ys: cy.slice(top).map((v) => v + box[1] - PAD),
    },
  };
}

async function main() {
  const image = await loadImage(REFERENCE);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);

  const out: Record<string, unknown> = {};
  const debug: Record<string, Extracted["cuts"]> = {};
  const report = (id: string, e: Extracted) =>
    console.log(
      `${id.padEnd(16)} ${e.rows[0].length}x${e.rows.length}  paso ${e.pitch[0]}x${e.pitch[1]} px  ΔE medio ${e.meanDeltaE}`,
    );
  for (const [id, cell] of Object.entries(CELLS) as [
    CellId,
    (typeof CELLS)[CellId],
  ][]) {
    const e = extract(data, image.width, cell.box, FIXES[id] ?? []);
    out[id] = {
      label: cell.label,
      faces: cell.faces,
      box: cell.box,
      pitch: e.pitch,
      meanDeltaE: e.meanDeltaE,
      rows: e.rows,
    };
    debug[id] = e.cuts;
    report(id, e);
  }
  const bubble = extract(
    data,
    image.width,
    HEART_BUBBLE.box,
    HEART_BUBBLE.fixes,
    HEART_BUBBLE.background,
  );
  debug.heartBubble = bubble.cuts;
  report("heartBubble", bubble);

  const body = Object.entries(out)
    .map(([id, sprite]) => {
      const s = sprite as { rows: string[] } & Record<string, unknown>;
      const { rows, ...meta } = s;
      const metaTs = Object.entries(meta)
        .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`)
        .join("\n");
      return `  ${id}: {\n${metaTs}\n    rows: [\n${rows.map((r) => `      "${r}",`).join("\n")}\n    ],\n  },`;
    })
    .join("\n");

  const source = `// ARCHIVO GENERADO por scripts/extract-nina-gatita.ts: no editar a mano.
// Cada sprite es la rejilla lógica extraída de una figura de la hoja de
// referencia (public/referencia/nina-gatita-referencia.webp).
// meanDeltaE: ΔE CIE76 medio entre el color final de cada celda y los
// píxeles reales de su interior. Por debajo de ~2 no se distingue; los
// valores de 5-8 vienen sobre todo del antialiasado y los degradados que la
// hoja tiene dentro de cada "píxel".
import type { ReferenceSprite } from "./types";

export const REFERENCE_SPRITES = {
${body}
} as const satisfies Record<string, ReferenceSprite>;

// Burbuja con corazón del panel "Detalle (Zoom)" (ΔE medio ${bubble.meanDeltaE}).
export const HEART_BUBBLE: readonly string[] = [
${bubble.rows.map((r) => `  "${r}",`).join("\n")}
];
`;
  // Se formatea con Prettier para que regenerar no deje diferencias de estilo.
  writeFileSync(OUT, await format(source, { parser: "typescript" }));
  console.log(`escrito ${OUT}`);
  // EXTRACT_DEBUG=ruta.json vuelca los cortes de rejilla de cada sprite.
  if (process.env.EXTRACT_DEBUG) {
    writeFileSync(process.env.EXTRACT_DEBUG, JSON.stringify(debug));
    console.log(`cortes de rejilla en ${process.env.EXTRACT_DEBUG}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
