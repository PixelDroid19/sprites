// Correcciones de la niña sobre las rejillas extraídas. La hoja tiene
// errores que no se deben copiar; cada corrección es una regla explícita,
// no un retoque a mano píxel a píxel, para poder aplicarla a otras figuras:
//
//   1. removeKitten: el gatito deja de estar pintado en la cabeza (ahora es
//      un personaje aparte) y el pelo que tapaba se rehace en cúpula.
//   2. cleanUnderEyes: los grises, marrones y salmones mezclados bajo los
//      ojos se leían como un golpe; pasan a piel con un rubor simétrico.
//   3. smoothCrown y dryEyes: pelos sueltos de 1-2 px en la coronilla y
//      grises al pie del ojo (parecían lágrimas).
//   4. tailFromBack: en las vistas de espalda la cola salía por un lado del
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
  for (let changed = true; changed;) {
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
  for (let changed = true; changed;) {
    changed = false;
    for (let y = 0; y < limitY; y++)
      for (let x = a; x <= b; x++) {
        if (at(g, x, y) === EMPTY) continue;
        const n = N4.filter(
          ([dx, dy]) => at(g, x + dx, y + dy) !== EMPTY,
        ).length;
        if (
          n <= 1 ||
          (at(g, x - 1, y) === EMPTY && at(g, x + 1, y) === EMPTY)
        ) {
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
  for (const cells of islands.slice(1))
    for (const [x, y] of cells) g[y][x] = EMPTY;
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
export function removeKitten(
  rows: readonly string[],
  limitY = 20,
): KittenRemoval {
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
  const earTop = Math.min(
    ...Array.from({ length: b - a + 7 }, (_, i) => topOf(a - 3 + i)),
  );
  const apex = earTop + 2;
  const half = Math.max(1, (b - a) / 2);
  for (let x = a; x <= b; x++) {
    const t = (x - mid) / half;
    const want = Math.round(apex + 4 * t * t);
    for (let y = 0; y < want; y++)
      if (g[y][x] !== "p" && g[y][x] !== "P") g[y][x] = EMPTY;
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
      else if (
        (ch === "k" || ch === "K") &&
        N4.every(([dx, dy]) => at(g, x + dx, y + dy) !== EMPTY)
      )
        g[y][x] = "h";
    }
  // Antenas: columnas de 1 px de ancho y 2+ de alto que asoman sobre la
  // cabeza (restos del contorno del gatito). Se cortan hasta la base.
  for (let x = 0; x < g[0].length; x++) {
    const top = topOf(x);
    let y = top;
    const lonely = (yy: number) =>
      at(g, x, yy) !== EMPTY &&
      at(g, x - 1, yy) === EMPTY &&
      at(g, x + 1, yy) === EMPTY;
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
  return {
    rows: g.map((r) => r.join("")),
    seat: { x: seatX, y: seatY },
    span: [a, b],
  };
}

// Bajo cada ojo, lo que no es piel ni contorno se mezclaba en un moratón.
// Se limpia la franja de 2 filas bajo la caja del ojo (solo píxeles
// rodeados de piel, para no comerse el pelo del borde de la cara) y se
// pone un rubor de 2 px, igual en los dos ojos.
export function cleanUnderEyes(
  rows: readonly string[],
  eyes: readonly EyeAnchor[],
): string[] {
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
          for (let dx = -1; dx <= 1; dx++)
            if ((dx || dy) && skinish(at(g, x + dx, y + dy))) skin++;
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
      const inEye = eyes.some(
        (e) => x >= e.x0 && x <= e.x1 && y >= e.y0 && y <= e.y1,
      );
      const skinNeighbours = N4.filter(([dx, dy]) =>
        SKIN.has(at(g, x + dx, y + dy)),
      ).length;
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
  for (const [x, y, ch] of piece)
    if (x + dx >= 0 && x + dx < w) layer[y][x + dx] = ch;
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

// Coronilla sin picos: un grupo de 1-3 columnas que asoma 2+ px por encima
// de sus vecinas es un pelo suelto o un resto del gatito. Se baja quitando
// su píxel de arriba, hasta que no quede ninguno. Las orejas no se tocan:
// tienen rosa en sus 4 primeras filas.
export function smoothCrown(
  rows: readonly string[],
  limitY = 20,
  // Columnas que no se tocan (orejas ya dibujadas).
  protect: readonly [number, number][] = [],
): string[] {
  const g: Grid = rows.map((r) => [...r]);
  const w = g[0].length;
  const topOf = (x: number) => {
    if (x < 0 || x >= w) return g.length;
    const t = g.findIndex((row) => row[x] !== EMPTY);
    return t < 0 ? g.length : t;
  };
  const isEar = (x: number) => {
    if (protect.some(([a, b]) => x >= a && x <= b)) return true;
    const t = topOf(x);
    for (let y = t; y < t + 4 && y < g.length; y++)
      if (g[y][x] === "p" || g[y][x] === "P") return true;
    return false;
  };
  const DARK_TOP = new Set(["k", "K", "d", "D"]);
  for (let changed = true; changed;) {
    changed = false;
    for (let x = 0; x < w; x++)
      for (let wd = 1; wd <= 3; wd++) {
        const cols = Array.from({ length: wd }, (_, i) => x + i);
        if (cols.some((c) => c >= w || isEar(c))) continue;
        const tops = cols.map(topOf);
        const high = Math.min(...tops);
        const low = Math.max(...tops);
        if (high >= limitY) continue;
        const around = Math.min(topOf(x - 1), topOf(x + wd));
        // Pico de 1-3 columnas que asoma 2+ px sobre sus vecinas, o palito
        // oscuro de 1 px de ancho que asoma 1 px y mide 2 de alto.
        const stick =
          wd === 1 &&
          high <= around - 1 &&
          DARK_TOP.has(g[high][x]) &&
          DARK_TOP.has(g[high + 1]?.[x] ?? EMPTY) &&
          g[high][x - 1] === EMPTY &&
          g[high][x + 1] === EMPTY;
        if (low <= around - 2 || stick) {
          for (const c of cols) if (topOf(c) === high) g[high][c] = EMPTY;
          changed = true;
          break;
        }
      }
  }
  closeOutline(g);
  return g.map((r) => r.join(""));
}

// El gris que queda en la última fila de la caja del ojo se lee como una
// lágrima: pasa a piel.
export function dryEyes(
  rows: readonly string[],
  eyes: readonly EyeAnchor[],
): string[] {
  const g: Grid = rows.map((r) => [...r]);
  for (const e of eyes)
    for (let x = e.x0; x <= e.x1; x++) if (g[e.y1][x] === "G") g[e.y1][x] = "s";
  return g.map((r) => r.join(""));
}

// Vista simétrica a la que le falta una oreja (en la hoja la tapaba el
// gatito): se copia en espejo la otra, respecto al centro de la cabeza
// medido 2 filas por debajo de la oreja.
export function mirrorEar(
  rows: readonly string[],
  ear: { x0: number; y0: number; x1: number; y1: number },
): string[] {
  const g: Grid = rows.map((r) => [...r]);
  const probe = g[ear.y1 + 2];
  const left = probe.findIndex((ch) => ch !== EMPTY);
  const right =
    probe.length - 1 - [...probe].reverse().findIndex((ch) => ch !== EMPTY);
  const span = left + right;
  for (let y = ear.y0; y <= ear.y1; y++)
    for (let x = ear.x0; x <= ear.x1; x++) {
      const ch = rows[y][x];
      const mx = span - x;
      if (ch !== EMPTY && mx >= 0 && mx < g[0].length) g[y][mx] = ch;
    }
  closeOutline(g);
  return g.map((r) => r.join(""));
}

export interface EarBox {
  // Parte interior de la oreja (el rosa, o donde iría en las de espalda).
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  // Vista de espalda: la oreja se ve por detrás, sin rosa.
  back?: boolean;
}

// Orejas de gato: el rosa de cada oreja (componente de "p"/"P" por encima
// de `limitY`, 4+ px) marca dónde está.
export function findEars(rows: readonly string[], limitY = 24): EarBox[] {
  const seen = rows.map((r) => [...r].map(() => false));
  const ears: EarBox[] = [];
  const pink = (x: number, y: number) =>
    y < limitY && (rows[y]?.[x] === "p" || rows[y]?.[x] === "P");
  for (let y = 0; y < limitY; y++)
    for (let x = 0; x < rows[0].length; x++) {
      if (!pink(x, y) || seen[y][x]) continue;
      const stack = [[x, y]];
      seen[y][x] = true;
      const b = { x0: x, y0: y, x1: x, y1: y };
      let n = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        n++;
        b.x0 = Math.min(b.x0, cx);
        b.x1 = Math.max(b.x1, cx);
        b.y0 = Math.min(b.y0, cy);
        b.y1 = Math.max(b.y1, cy);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (pink(cx + dx, cy + dy) && !seen[cy + dy][cx + dx]) {
              seen[cy + dy][cx + dx] = true;
              stack.push([cx + dx, cy + dy]);
            }
      }
      if (n >= 4) ears.push(b);
    }
  return ears;
}

// Punta de oreja limpia sobre cada caja: se borran los muñones que había
// encima y se dibuja un triángulo de contorno 1 px, con la punta 1 px
// hacia fuera de la cabeza, pelaje en el borde (más claro en el lado de la
// luz, arriba-izquierda) y el rosa del interior continuando hacia arriba.
export function sharpenEars(
  rows: readonly string[],
  ears: readonly EarBox[],
  headCenterX: number,
): string[] {
  const g: Grid = rows.map((r) => [...r]);
  const w = g[0].length;
  const shapes = ears.map((e) => {
    const inner = e.x1 - e.x0 + 1;
    const width = Math.min(13, Math.max(11, inner + 5));
    const cx = (e.x0 + e.x1) / 2;
    const out = cx < headCenterX ? -1 : 1;
    const height = Math.round(width * 0.6);
    // La base queda 2 filas bajo el borde del rosa de la hoja: la oreja
    // nace del lateral de la cabeza, no se posa encima.
    const baseY = Math.min(e.y1, e.y0 + 2);
    return { e, width, cx, out, baseY, apexY: baseY - height };
  });
  // Primero se borran los muñones de todas las orejas y luego se dibujan:
  // así borrar una no se come la que ya estaba dibujada.
  for (const { width, cx, apexY } of shapes)
    for (let y = Math.max(0, apexY - 6); y < apexY; y++)
      for (let x = Math.floor(cx - width); x <= Math.ceil(cx + width); x++)
        if (x >= 0 && x < w) g[y][x] = EMPTY;
  // El rosa de la hoja que quedaba por debajo de la base (hundido en el
  // pelo) se leía como una mancha: pasa a pelo.
  for (const { e, baseY } of shapes)
    for (let y = baseY; y <= e.y1 + 1; y++)
      for (let x = e.x0 - 1; x <= e.x1 + 1; x++)
        if (x >= 0 && x < w && "pPSRir".includes(g[y]?.[x] ?? EMPTY))
          g[y][x] = y === baseY + 1 ? "D" : "B";
  // Las lejanas (de espalda) primero, para que la cercana quede delante.
  const order = [...shapes].sort(
    (p, q) => Number(!!q.e.back) - Number(!!p.e.back),
  );
  // Borde izquierdo y derecho de cada oreja por fila (para la coronilla).
  const spans = new Map<
    (typeof shapes)[number],
    Map<number, [number, number]>
  >();
  for (const shape of order) {
    const { e, width, cx, out, baseY, apexY } = shape;
    const span = new Map<number, [number, number]>();
    spans.set(shape, span);
    for (let y = apexY; y <= baseY; y++) {
      const f = (y - apexY) / (baseY - apexY);
      const shift = out * Math.round(1 - f);
      // La punta es 1 px; debajo ya se abre a 3 (sin palito de 2 filas).
      const half = y === apexY ? 0 : Math.max(1, (f * (width - 1)) / 2);
      const left = Math.round(cx - half) + shift;
      const right = Math.round(cx + half) + shift;
      span.set(y, [left, right]);
      for (let x = left; x <= right; x++) {
        if (x < 0 || x >= w) continue;
        const edge = x === left || x === right || y === apexY;
        const innerCol = x > left + 1 && x < right - 1 && y >= apexY + 2;
        g[y][x] = edge
          ? "k"
          : innerCol && !e.back
            ? y - apexY <= 2
              ? "p"
              : "P"
            : x - left < right - x
              ? "B"
              : "H";
      }
    }
  }
  if (shapes.length === 2) rebuildCrown(g, shapes, spans);
  // Perfil (una sola oreja, como en la referencia): nada asoma junto a
  // ella por encima de sus bordes.
  if (shapes.length === 1) {
    const one = shapes[0];
    const sp = spans.get(one)!;
    const toCenter = one.cx < headCenterX ? 1 : -1;
    clearBeside(g, one, sp, [-toCenter]);
    // Cúpula desde el borde interior de la oreja hasta el otro lado de la
    // cabeza (su borde medido 3 filas bajo la base de la oreja).
    const probe = g[one.baseY + 3];
    const far =
      toCenter > 0
        ? probe.length -
          1 -
          [...probe].reverse().findIndex((ch) => ch !== EMPTY)
        : probe.findIndex((ch) => ch !== EMPTY);
    const [l, r] = sp.get(one.baseY)!;
    const from = toCenter > 0 ? r + 1 : l - 1;
    domeBetween(
      g,
      Math.min(from, far),
      Math.max(from, far),
      one.apexY + 3,
      one.baseY + 1,
      [sp],
    );
  }
  dropIslands(g);
  closeOutline(g);
  return g.map((r) => r.join(""));
}

type EarShape = { apexY: number; baseY: number; cx: number };

// Silueta de la coronilla como en la referencia: las puntas de las orejas
// son lo más alto; entre ellas, una cúpula redondeada 3 px por debajo de
// las puntas; por fuera, el pelo no sobresale del borde exterior de cada
// oreja. Lo que asoma se borra y los huecos bajo la cúpula se rellenan.
function rebuildCrown(
  g: Grid,
  shapes: readonly EarShape[],
  spans: Map<EarShape, Map<number, [number, number]>>,
) {
  const w = g[0].length;
  const [a, b] = [...shapes].sort((p, q) => p.cx - q.cx);
  const sa = spans.get(a)!;
  const sb = spans.get(b)!;
  const inner0 = sa.get(a.baseY)![1] + 1;
  const inner1 = sb.get(b.baseY)![0] - 1;
  const top = Math.min(a.apexY, b.apexY) + 3;
  const edge = Math.max(a.apexY, b.apexY) + 5;
  domeBetween(g, inner0, inner1, top, edge, [sa, sb]);
  // Por fuera de cada oreja: nada por encima de su borde exterior.
  clearBeside(g, a, sa, [-1]);
  clearBeside(g, b, sb, [1]);
  for (let y = 0; y < Math.min(a.apexY, b.apexY); y++)
    for (let x = 0; x < w; x++) g[y][x] = EMPTY;
}

// Borra lo que asoma junto a una oreja (4 px hacia cada lado indicado) por
// encima de su base, para que su borde sea la silueta.
function clearBeside(
  g: Grid,
  shape: EarShape,
  span: Map<number, [number, number]>,
  sides: readonly number[],
) {
  const w = g[0].length;
  for (let y = 0; y < shape.baseY - 1; y++) {
    const [l, r] = span.get(Math.max(y, shape.apexY))!;
    for (const dir of sides)
      for (let k = 0; k < 4; k++) {
        const x = (dir < 0 ? l - 1 : r + 1) + dir * k;
        if (x >= 0 && x < w) g[y][x] = EMPTY;
      }
  }
}

// Cúpula de pelo entre dos columnas: la cima (`top`) en el centro y
// `edge` en los extremos. Se borra lo que sobresale (sin tocar orejas) y se
// rellena lo que falta con contorno, sombra, base y un brillo central.
function domeBetween(
  g: Grid,
  x0: number,
  x1: number,
  top: number,
  edge: number,
  ears: readonly Map<number, [number, number]>[],
) {
  const mid = (x0 + x1) / 2;
  const half = Math.max(1, (x1 - x0) / 2);
  const earAt = (x: number, y: number) =>
    ears.some((sp) => {
      const r = sp.get(y);
      return r !== undefined && x >= r[0] && x <= r[1];
    });
  for (let x = x0; x <= x1; x++) {
    const t = (x - mid) / half;
    const want = Math.round(top + (edge - top) * t * t);
    for (let y = 0; y < want; y++) if (!earAt(x, y)) g[y][x] = EMPTY;
    for (let y = want; y < g.length; y++) {
      if (earAt(x, y)) continue;
      const depth = y - want;
      const ch = g[y][x];
      // Bajo la cúpula, el contorno antiguo de la coronilla (hasta 5 filas)
      // queda dentro del pelo: pasa a pelo. Se para en el primer píxel de
      // pelo de verdad.
      const oldEdge = ch === EMPTY || (depth <= 5 && "kKdD".includes(ch));
      if (depth > 1 && !oldEdge) break;
      g[y][x] =
        depth === 0
          ? "k"
          : depth === 1
            ? "D"
            : Math.abs(t) < 0.4 && depth === 2
              ? "L"
              : ch === EMPTY || ch === "k" || ch === "K"
                ? "B"
                : "H";
    }
  }
}
