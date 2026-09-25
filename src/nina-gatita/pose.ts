// Composición de fotogramas: a partir de la rejilla original y una pose se
// obtiene otra rejilla del mismo tamaño y la misma paleta. Todo son
// desplazamientos enteros de regiones ancladas; nada se rota ni se escala.
import { GIRL, inBox, type EyeAnchor, type Rig, type SpriteId } from "./rig";

export type EyeState = "open" | "closed" | "happy";
export type LiftedLeg = "none" | "left" | "right";

export interface Pose {
  // La cabeza baja 1 px (respiración, o retraso del pelo tras un paso).
  headDrop: boolean;
  // Todo lo que está sobre las piernas baja 1 px (paso, aterrizaje). Se
  // suma a headDrop: con los dos, la cabeza queda 2 px abajo.
  bodyDrop: boolean;
  // Pierna levantada 1 px (lado de la imagen).
  leg: LiftedLeg;
  // Desplazamiento vertical de la punta de la cola, en px con signo.
  tail: number;
  eyes: EyeState;
}

export const REST_POSE: Pose = {
  headDrop: false,
  bodyDrop: false,
  leg: "none",
  tail: 0,
  eyes: "open",
};

// Píxeles que sustituyen a un ojo concreto (el reto del parpadeo).
export type EyeOverride = (
  id: string,
  eyeIndex: number,
  rig: Rig,
) => string[] | null;

type Grid = string[][];

const EMPTY = ".";

const toGrid = (rows: readonly string[]): Grid => rows.map((row) => [...row]);

// Redondeo simétrico: -0.5 y +0.5 se mueven lo mismo en sentidos opuestos
// (Math.round(-0.5) daría 0 y el vaivén quedaría cojo).
const roundSym = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

const OUTLINE_SAFE = new Set(["k", "K", "d", "D", "i"]);
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// Tras mover una región, el relleno que queda al borde del fondo en un
// escalón pasa a contorno: la silueta nunca queda sin su línea oscura.
function closeOutline(g: Grid) {
  const exposed: [number, number][] = [];
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === EMPTY || OUTLINE_SAFE.has(ch)) return;
      if (N4.some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? EMPTY) === EMPTY))
        exposed.push([x, y]);
    }),
  );
  for (const [x, y] of exposed) g[y][x] = "k";
}

// Mueve los píxeles opacos que cumplen `select` a (x+dx(x,y), y+dy(x,y)).
// Primero se vacía el origen y luego se pinta el destino encima, así una
// región que baja tapa la fila de debajo en vez de dejar huecos.
function moveRegion(
  g: Grid,
  select: (x: number, y: number) => boolean,
  offset: (x: number, y: number) => [number, number],
) {
  const moved: [number, number, string][] = [];
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === EMPTY || !select(x, y)) return;
      const [dx, dy] = offset(x, y);
      moved.push([x + dx, y + dy, ch]);
      row[x] = EMPTY;
    }),
  );
  for (const [x, y, ch] of moved)
    if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

// Cola: cada columna (o fila, si la raíz está abajo) se mueve en
// proporción a su distancia a la raíz. Con amplitud 1 sale un escalón de
// 1 px limpio; la raíz nunca se mueve.
function swayTail(g: Grid, rig: Rig, amount: number) {
  if (!amount) return;
  const t = rig.tail;
  if (t.root === "bottom") {
    const rootY = t.y1 + 1;
    moveRegion(
      g,
      (x, y) => inBox(t, x, y),
      (_, y) => [roundSym((amount * (rootY - y)) / (rootY - t.y0)), 0],
    );
    return;
  }
  const len = t.x1 - t.x0 + 1;
  moveRegion(
    g,
    (x, y) => inBox(t, x, y),
    (x) => {
      const dist = t.root === "left" ? x - t.x0 + 1 : t.x1 - x + 1;
      return [0, roundSym((amount * dist) / len)];
    },
  );
}

// Pinta una capa encima (solo sus píxeles opacos).
function overlay(g: Grid, layer: Grid) {
  layer.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch !== EMPTY) g[y][x] = ch;
    }),
  );
}

// Ojo cerrado dibujado desde el anclaje: piel en toda la caja y una línea
// de párpado en el tercio inferior cuyo rabillo exterior cae 1 px.
export function closedEye(e: EyeAnchor): string[] {
  const w = e.x1 - e.x0 + 1;
  const h = e.y1 - e.y0 + 1;
  const rows = Array.from({ length: h }, () => Array<string>(w).fill(e.fill ?? "s"));
  const lid = h - 3;
  const outer = e.outer === "left" ? 0 : w - 1;
  for (let x = 0; x < w; x++) rows[x === outer ? lid + 1 : lid][x] = "k";
  // Sombra de piel bajo el párpado: da volumen al ojo cerrado.
  for (let x = 1; x < w - 1; x++) if (x !== outer) rows[lid + 1][x] = e.shade ?? "S";
  return rows.map((r) => r.join(""));
}

// Ojo feliz (^): arco con los extremos 1 px más bajos que el centro.
export function happyEye(e: EyeAnchor): string[] {
  const w = e.x1 - e.x0 + 1;
  const h = e.y1 - e.y0 + 1;
  const rows = Array.from({ length: h }, () => Array<string>(w).fill(e.fill ?? "s"));
  const top = h - 4;
  for (let x = 0; x < w; x++) {
    const edge = x === 0 || x === w - 1;
    rows[edge ? top + 1 : top][x] = "k";
  }
  return rows.map((r) => r.join(""));
}

function paintEyes(
  g: Grid,
  id: string,
  rig: Rig,
  pose: Pose,
  override?: EyeOverride,
) {
  if (pose.eyes === "open") return;
  rig.eyes.forEach((e, i) => {
    const custom = pose.eyes === "closed" ? override?.(id, i, rig) : null;
    const pixels =
      custom ?? (pose.eyes === "closed" ? closedEye(e) : happyEye(e));
    pixels.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        g[e.y0 + dy][e.x0 + dx] = ch;
      }),
    );
  });
}

function liftLeg(g: Grid, rig: Rig, leg: LiftedLeg) {
  if (leg === "none") return;
  const side = (x: number) =>
    leg === "left" ? x < rig.legSplitX : x >= rig.legSplitX;
  moveRegion(
    g,
    (x, y) => inBox(rig.legs, x, y) && side(x),
    () => [0, -1],
  );
}

function dropAbove(g: Grid, rowLimit: number) {
  moveRegion(
    g,
    (_, y) => y < rowLimit,
    () => [0, 1],
  );
}

export function poseKey(p: Pose): string {
  return `${+p.headDrop}${+p.bodyDrop}${p.leg[0]}${p.tail}${p.eyes[0]}`;
}

// Fotograma compuesto de cualquier personaje con su rig. El orden importa:
// primero las partes pequeñas (cola, ojos, pierna) sobre la figura en
// reposo y al final los desplazamientos grandes, que las arrastran.
export function composeRows(
  id: string,
  rows: readonly string[],
  rig: Rig,
  pose: Pose,
  override?: EyeOverride,
): string[] {
  const g = toGrid(rows);
  if (rig.tailLayer) {
    // Cola en capa propia: se balancea sola y se pinta encima del cuerpo.
    const layer = toGrid(rig.tailLayer);
    swayTail(layer, rig, pose.tail);
    overlay(g, layer);
  } else {
    swayTail(g, rig, pose.tail);
  }
  paintEyes(g, id, rig, pose, override);
  liftLeg(g, rig, pose.leg);
  if (pose.bodyDrop) dropAbove(g, rig.hipY);
  if (pose.headDrop) dropAbove(g, rig.neckY + (pose.bodyDrop ? 1 : 0));
  closeOutline(g);
  return g.map((row) => row.join(""));
}

export function composeFrame(
  id: SpriteId,
  pose: Pose,
  override?: EyeOverride,
): string[] {
  return composeRows(id, GIRL[id].rows, GIRL[id].rig, pose, override);
}
