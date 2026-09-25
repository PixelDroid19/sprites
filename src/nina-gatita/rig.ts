// Anclajes de cada figura: dónde están el cuello, la cadera, las piernas,
// los ojos y las colas. La animación nunca mueve píxeles sueltos: mueve
// regiones definidas desde estos anclajes, así las partes siguen unidas.
import { REFERENCE_SPRITES } from "./sprites.generated";
import type { Facing } from "./types";

export type SpriteId = keyof typeof REFERENCE_SPRITES;

export const SPRITE_IDS = Object.keys(REFERENCE_SPRITES) as SpriteId[];

// Caja inclusiva en coordenadas de la rejilla del sprite.
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface EyeAnchor extends Box {
  // Lado del rabillo exterior del ojo (hacia la oreja).
  outer: "left" | "right";
}

export interface TailAnchor extends Box {
  // Lado por el que la cola se une al cuerpo: esa columna no se mueve.
  root: "left" | "right";
}

export interface Rig {
  width: number;
  height: number;
  // Primera fila del torso: lo que queda encima es cabeza, pelo y gatito.
  neckY: number;
  // Primera fila de las piernas, justo bajo la falda.
  hipY: number;
  // Caja de las piernas: desde la cadera hasta el suelo, del ancho de las
  // zapatillas (así la cola, si baja hasta ahí, no se levanta con el pie).
  legs: Box;
  // Primera columna de la pierna derecha (en la imagen).
  legSplitX: number;
  eyes: EyeAnchor[];
  tail: TailAnchor;
  // Punta libre de la cola del gatito; la fila de debajo es su raíz.
  kittenTail: Box;
}

export const inBox = (b: Box, x: number, y: number) =>
  x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

type ManualAnchors = Pick<Rig, "eyes" | "tail" | "kittenTail">;

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({
  x0,
  y0,
  x1,
  y1,
});
const eye = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  outer: EyeAnchor["outer"],
): EyeAnchor => ({ ...box(x0, y0, x1, y1), outer });
const tail = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  root: TailAnchor["root"],
): TailAnchor => ({ ...box(x0, y0, x1, y1), root });

// Anclajes que no se pueden deducir por color: medidos sobre cada rejilla.
// Las cajas de ojo cubren el ojo entero (contorno, franja clara y el gris
// de debajo) para que al cerrarlo no queden restos del ojo abierto.
const MANUAL: Record<SpriteId, ManualAnchors> = {
  abajoIzquierda: {
    eyes: [eye(7, 27, 11, 33, "left"), eye(19, 27, 24, 33, "right")],
    tail: tail(36, 32, 44, 44, "left"),
    kittenTail: box(23, 0, 29, 5),
  },
  abajo: {
    eyes: [eye(12, 29, 18, 36, "left"), eye(26, 29, 31, 36, "right")],
    tail: tail(37, 35, 44, 47, "left"),
    kittenTail: box(28, 0, 35, 3),
  },
  abajoDerecha: {
    eyes: [eye(17, 30, 22, 37, "left"), eye(29, 29, 33, 36, "right")],
    tail: tail(0, 38, 11, 51, "right"),
    kittenTail: box(13, 0, 19, 5),
  },
  izquierdaFila1: {
    eyes: [eye(20, 30, 24, 35, "left")],
    tail: tail(0, 40, 9, 53, "right"),
    kittenTail: box(9, 0, 16, 5),
  },
  derecha: {
    eyes: [eye(26, 27, 29, 31, "left")],
    tail: tail(0, 37, 11, 54, "right"),
    kittenTail: box(8, 4, 13, 8),
  },
  arribaIzquierda: {
    eyes: [eye(14, 27, 19, 33, "left"), eye(26, 27, 32, 33, "right")],
    tail: tail(0, 37, 9, 51, "right"),
    kittenTail: box(10, 0, 16, 5),
  },
  arriba: {
    eyes: [],
    tail: tail(33, 43, 40, 57, "left"),
    kittenTail: box(26, 2, 32, 6),
  },
  arribaDerecha: {
    eyes: [],
    tail: tail(0, 42, 11, 56, "right"),
    kittenTail: box(25, 0, 30, 4),
  },
  izquierda: {
    eyes: [eye(8, 28, 11, 34, "right")],
    tail: tail(29, 43, 35, 57, "left"),
    kittenTail: box(19, 1, 25, 4),
  },
};

const SHIRT = new Set(["r", "R"]);
const SKIRT = new Set(["g"]);

// Cuello, cadera y piernas salen de los propios colores: el torso empieza
// en la primera fila con 3+ píxeles de jersey; las piernas, justo debajo de
// la última fila con 3+ de falda (las zapatillas tienen algún gris suelto).
// El ancho de las piernas se mide en las 3 filas del suelo, fuera de la
// cola, y se separan por el centro de ese ancho.
function autoAnchors(rows: readonly string[], tailBox: Box) {
  const count = (row: string, set: Set<string>) =>
    [...row].filter((ch) => set.has(ch)).length;
  const neckY = rows.findIndex((row) => count(row, SHIRT) >= 3);
  let lastSkirt = -1;
  rows.forEach((row, y) => {
    if (count(row, SKIRT) >= 3) lastSkirt = y;
  });
  const hipY = lastSkirt + 1;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = rows.length - 3; y < rows.length; y++)
    [...rows[y]].forEach((ch, x) => {
      if (ch === "." || inBox(tailBox, x, y)) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    });
  return {
    neckY,
    hipY,
    legs: box(minX, hipY, maxX, rows.length - 1),
    legSplitX: Math.round((minX + maxX + 1) / 2),
  };
}

export const RIGS = Object.fromEntries(
  SPRITE_IDS.map((id) => {
    const rows = REFERENCE_SPRITES[id].rows;
    const rig: Rig = {
      width: rows[0].length,
      height: rows.length,
      ...autoAnchors(rows, MANUAL[id].tail),
      ...MANUAL[id],
    };
    return [id, rig];
  }),
) as Record<SpriteId, Rig>;

// Qué figura se usa para cada dirección al caminar. La hoja no trae una
// "arriba-izquierda" válida (la figura con esa etiqueta mira al frente), así
// que se usa "arriba-derecha" en espejo. Para "derecha" hay dos figuras que
// miran a la derecha; se usa la que la hoja llama "Derecha".
export const DIRECTIONS: Record<Facing, { sprite: SpriteId; flip: boolean }> = {
  abajo: { sprite: "abajo", flip: false },
  "abajo-izquierda": { sprite: "abajoIzquierda", flip: false },
  izquierda: { sprite: "izquierda", flip: false },
  "arriba-izquierda": { sprite: "arribaDerecha", flip: true },
  arriba: { sprite: "arriba", flip: false },
  "arriba-derecha": { sprite: "arribaDerecha", flip: false },
  derecha: { sprite: "derecha", flip: false },
  "abajo-derecha": { sprite: "abajoDerecha", flip: false },
};

// Dirección a partir de un vector de movimiento (y crece hacia abajo).
export function facingFromVector(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy === 0) return null;
  const ORDER: Facing[] = [
    "derecha",
    "abajo-derecha",
    "abajo",
    "abajo-izquierda",
    "izquierda",
    "arriba-izquierda",
    "arriba",
    "arriba-derecha",
  ];
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ORDER[(octant + 8) % 8];
}
