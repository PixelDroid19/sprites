// Correcciones de la niña sobre las rejillas extraídas. La hoja tiene
// errores que no se deben copiar; cada corrección es una regla explícita,
// no un retoque a mano píxel a píxel, para poder aplicarla a otras figuras:
//
//   1. removeKitten: el gatito deja de estar pintado en la cabeza (ahora es
//      un personaje aparte) y el pelo que tapaba se rehace en cúpula.
//   2. cleanUnderEyes: los grises, marrones y salmones mezclados bajo los
//      ojos se leían como un golpe; pasan a piel con un rubor simétrico.
//   3. tailFromBack: en las vistas de espalda la cola salía por un lado del
//      cuerpo; se recoloca para que nazca del centro de la espalda.
// Las rejillas conservan su tamaño: los anclajes medidos siguen valiendo.
import type { EyeAnchor, TailAnchor } from "./rig";

type Grid = string[][];

const EMPTY = ".";
export const KITTEN_COLORS = new Set(["o", "O", "y", "Y", "c"]);
const DARK = new Set(["k", "K", "d", "D", "i"]);
const SKIN = new Set(["s", "S", "P"]);
const BODY = new Set(["g", "r", "R", "s", "S", "P", "w", "p", "G"]);
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const at = (g: Grid, x: number, y: number) => g[y]?.[x] ?? EMPTY;

export function closeOutline(g: Grid) {
  const exposed: [number, number][] = [];
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === EMPTY || DARK.has(ch)) return;
      if (N4.some(([dx, dy]) => at(g, x + dx, y + dy) === EMPTY))
        exposed.push([x, y]);
    }),
  );
  for (const [x, y] of exposed) g[y][x] = "k";
}

// Contorno colgando tras borrar algo: píxeles oscuros sin ningún vecino
// (en 8 direcciones) que sea relleno. Se repite hasta que no quede ninguno.
function pruneDanglingOutline(g: Grid, limitY: number) {
  for (let changed = true; changed; ) {
    changed = false;
    g.forEach((row, y) =>
      row.forEach((ch, x) => {
        if (y >= limitY || (ch !== "k" && ch !== "K")) return;
        let fill = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const n = at(g, x + dx, y + dy);
            if ((dx || dy) && n !== EMPTY && !DARK.has(n)) fill++;
          }
        if (fill === 0) {
          row[x] = EMPTY;
          changed = true;
        }
      }),
    );
  }
}

// Pelos sueltos de 1 px de ancho que quedaban bajo el gatito: dentro de
// las columnas que ocupaba, se quita todo píxel con 1 o ningún vecino
// opaco en cruz, hasta que no quede ninguno.
function trimSpikes(g: Grid, a: number, b: number, limitY: number) {
  for (let changed = true; changed; ) {
    changed = false;
    for (let y = 0; y < limitY; y++)
      for (let x = a; x <= b; x++) {
        if (at(g, x, y) === EMPTY) continue;
        const n = N4.filter(([dx, dy]) => at(g, x + dx, y + dy) !== EMPTY).length;
        if (n <= 1 || (at(g, x - 1, y) === EMPTY && at(g, x + 1, y) === EMPTY)) {
          g[y][x] = EMPTY;
          changed = true;
        }
      }
  }
}

// Islas opacas pequeñas separadas de la figura (restos del gatito).
function dropIslands(g: Grid) {
  const seen = g.map((r) => r.map(() => false));
  const islands: [number, number][][] = [];
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === EMPTY || seen[y][x]) return;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        cells.push([cx, cy]);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (at(g, nx, ny) !== EMPTY && !seen[ny][nx]) {
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
      }
      islands.push(cells);
    }),
  );
  islands.sort((p, q) => q.length - p.length);
  for (const cells of islands.slice(1)) for (const [x, y] of cells) g[y][x] = EMPTY;
}

export interface KittenRemoval {
  rows: string[];
  // Punto donde se sentaba el gatito: centro de su base, sobre el pelo.
  seat: { x: number; y: number };
  // Columnas que ocupaba el gatito.
  span: [number, number];
}

// El gatito ocupa la parte alta de la figura: en cada columna con naranja
// (por encima de `limitY`, para no tocar los pendientes) se borra desde
// arriba hasta el último naranja y su contorno inferior. Luego se rehace la
// coronilla con una cúpula de pelo: contorno, sombra, base y un brillo.
export function removeKitten(rows: readonly string[], limitY = 20): KittenRemoval {
  const g: Grid = rows.map((r) => [...r]);
  const w = g[0].length;
  const bottom = new Array<number>(w).fill(-1);
  for (let y = 0; y < limitY; y++)
    for (let x = 0; x < w; x++) if (KITTEN_COLORS.has(g[y][x])) bottom[x] = y;
  const cols = bottom.map((b, x) => (b >= 0 ? x : -1)).filter((x) => x >= 0);
  const a = Math.min(...cols) - 1;
  const b = Math.max(...cols) + 1;
  // Base del gatito por columna, con las columnas de contorno laterales.
  for (let x = a; x <= b; x++) {
    const own = bottom[x];
    const side = Math.max(bottom[x - 1] ?? -1, bottom[x + 1] ?? -1);
    let end = own >= 0 ? own : side;
    if (end < 0) continue;
    // Incluye el contorno oscuro justo debajo del gatito.
    if (DARK.has(at(g, x, end + 1))) end++;
    for (let y = 0; y <= end; y++) {
      const ch = g[y][x];
      // Las orejas de la niña (rosa y su pelo exterior) no se tocan.
      if (ch === "p" || ch === "P") continue;
      if (own < 0 && ch !== "k" && ch !== "K") continue;
      g[y][x] = EMPTY;
    }
  }
  pruneDanglingOutline(g, limitY);
  trimSpikes(g, a, b, limitY);
  dropIslands(g);

  // Cúpula sobre el hueco del gatito: la coronilla queda 2 px por debajo
  // de la punta más alta de las orejas y baja 2 px hacia los lados. Todo lo
  // que sobresale por encima (restos del gatito) se borra, salvo el rosa de
  // las orejas, y todo hueco por debajo se rellena de pelo con su rampa.
  const topOf = (x: number) => {
    const t = g.findIndex((row) => row[x] !== EMPTY);
    return t < 0 ? g.length : t;
  };
  const mid = Math.round((a + b) / 2);
  const earTop = Math.min(...Array.from({ length: b - a + 7 }, (_, i) => topOf(a - 3 + i)));
  const apex = earTop + 2;
  const half = Math.max(1, (b - a) / 2);
  for (let x = a; x <= b; x++) {
    const t = (x - mid) / half;
    const want = Math.round(apex + 2 * t * t);
    for (let y = 0; y < want; y++) if (g[y][x] !== "p" && g[y][x] !== "P") g[y][x] = EMPTY;
    for (let y = want; y < limitY; y++) {
      if (g[y][x] !== EMPTY && y > want + 1) break;
      const depth = y - want;
      const highlight = Math.abs(t) < 0.45 && depth === 2;
      if (g[y][x] === EMPTY || depth <= 1)
        g[y][x] = depth === 0 ? "k" : depth === 1 ? "D" : highlight ? "L" : "B";
    }
  }
  // Restos de la cara del gatito dentro del pelo pasan a pelo, y las líneas
  // de contorno que quedaron por dentro, a mechón oscuro.
  for (let y = 0; y < limitY; y++)
    for (let x = a; x <= b; x++) {
      const ch = g[y][x];
      if ("swReGSc".includes(ch)) g[y][x] = "B";
      else if ((ch === "k" || ch === "K") && N4.every(([dx, dy]) => at(g, x + dx, y + dy) !== EMPTY))
        g[y][x] = "h";
    }
  // Antenas: columnas de 1 px de ancho y 2+ de alto que asoman sobre la
  // cabeza (restos del contorno del gatito). Se cortan hasta la base.
  for (let x = 0; x < g[0].length; x++) {
    const top = topOf(x);
    let y = top;
    const lonely = (yy: number) =>
      at(g, x, yy) !== EMPTY && at(g, x - 1, yy) === EMPTY && at(g, x + 1, yy) === EMPTY;
    while (y < limitY && lonely(y)) y++;
    if (y - top >= 2) for (let yy = top; yy < y; yy++) g[yy][x] = EMPTY;
  }
  // Huecos que quedan dentro de la cabeza (entre la cúpula y el pelo).
  for (let y = apex; y < limitY; y++)
    for (let x = a; x <= b; x++)
      if (g[y][x] === EMPTY && topOf(x) < y) g[y][x] = "B";
  closeOutline(g);
  const seatX = mid;
  const seatY = g.findIndex((row) => row[seatX] !== EMPTY);
  return { rows: g.map((r) => r.join("")), seat: { x: seatX, y: seatY }, span: [a, b] };
}

// Bajo cada ojo, lo que no es piel ni contorno se mezclaba en un moratón.
// Se limpia la franja de 2 filas bajo la caja del ojo (solo píxeles
// rodeados de piel, para no comerse el pelo del borde de la cara) y se
// pone un rubor de 2 px, igual en los dos ojos.
export function cleanUnderEyes(rows: readonly string[], eyes: readonly EyeAnchor[]): string[] {
  const g: Grid = rows.map((r) => [...r]);
  const skinish = (ch: string) => SKIN.has(ch) || ch === "G";
  for (const e of eyes) {
    for (let y = e.y1 + 1; y <= e.y1 + 2; y++)
      for (let x = e.x0 - 1; x <= e.x1 + 1; x++) {
        const ch = at(g, x, y);
        if (ch === EMPTY || ch === "s" || ch === "P") continue;
        // El borde de la silueta es contorno: nunca se convierte en piel.
        if (N4.some(([dx, dy]) => at(g, x + dx, y + dy) === EMPTY)) continue;
        let skin = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && skinish(at(g, x + dx, y + dy))) skin++;
        if (skin >= 4) g[y][x] = "s";
      }
    // Rubor: 2 px bajo el lado exterior del ojo, si allí hay piel.
    const y = e.y1 + 2;
    const x0 = e.outer === "left" ? e.x0 : e.x1 - 1;
    for (const x of [x0, x0 + 1]) if (at(g, x, y) === "s") g[y][x] = "P";
  }
  // Grises sueltos en plena piel (restos de la esclerótica).
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch !== "G") return;
      const inEye = eyes.some((e) => x >= e.x0 && x <= e.x1 && y >= e.y0 && y <= e.y1);
      const skinNeighbours = N4.filter(([dx, dy]) => SKIN.has(at(g, x + dx, y + dy))).length;
      if (!inEye && skinNeighbours >= 2) row[x] = "s";
    }),
  );
  return g.map((r) => r.join(""));
}

export interface TailMove {
  // Figura sin la cola.
  rows: string[];
  // Capa del mismo tamaño con solo la cola, ya recolocada.
  layer: string[];
  tail: TailAnchor;
}

// Vistas de espalda: la cola se borra desde la punta hasta tocar el cuerpo
// (falda, jersey o piel) fila a fila, y pasa a una capa propia con la raíz
// en el centro de la espalda. La capa se pinta encima del cuerpo (se ve la
// espalda) y se balancea sin arrastrar píxeles de la falda.
export function tailFromBack(
  rows: readonly string[],
  tail: TailAnchor,
  centerX: number,
): TailMove {
  const g: Grid = rows.map((r) => [...r]);
  const w = g[0].length;
  const piece: [number, number, string][] = [];
  const dir = tail.root === "left" ? -1 : 1; // hacia el cuerpo
  for (let y = tail.y0; y <= tail.y1; y++) {
    let x = tail.root === "left" ? tail.x1 : tail.x0;
    while (x >= 0 && x < w && g[y][x] === EMPTY && x !== centerX) x += dir;
    while (x >= 0 && x < w && x !== centerX) {
      const ch = g[y][x];
      if (ch === EMPTY || BODY.has(ch)) break;
      piece.push([x, y, ch]);
      g[y][x] = EMPTY;
      x += dir;
    }
  }
  closeOutline(g);
  const rootX =
    tail.root === "left"
      ? Math.min(...piece.map(([x]) => x))
      : Math.max(...piece.map(([x]) => x));
  const dx = centerX - rootX;
  const layer: Grid = g.map((row) => row.map(() => EMPTY));
  for (const [x, y, ch] of piece) if (x + dx >= 0 && x + dx < w) layer[y][x + dx] = ch;
  closeOutline(layer);
  const xs = piece.map(([x]) => x + dx);
  const ys = piece.map(([, y]) => y);
  return {
    rows: g.map((r) => r.join("")),
    layer: layer.map((r) => r.join("")),
    tail: {
      x0: Math.max(0, Math.min(...xs)),
      y0: Math.min(...ys),
      x1: Math.min(w - 1, Math.max(...xs)),
      y1: Math.max(...ys),
      root: tail.root,
    },
  };
}
