// El gatito como personaje propio. Sus figuras salen del panel "Gatito
// (solo)" de la hoja, limpias: la extracción mezcla marrones del pelo de la
// niña con el pelaje (antialiasado del fondo) y se pasan a la rampa
// naranja; la boca se redibuja como una nariz rosa. Usa el mismo sistema
// de anclajes y poses que la niña: cabeza, patas, ojos y cola.
import type { Box, EyeAnchor, Rig, TailAnchor } from "./rig";
import { inBox } from "./rig";
import { KITTEN_REFERENCE } from "./sprites.generated";
import type { Facing } from "./types";

export type KittenView = keyof typeof KITTEN_REFERENCE;

// Marrones y rosas del pelo de la niña que aparecen dentro del gatito.
const RECOLOR: Record<string, string> = {
  B: "o",
  H: "o",
  h: "o",
  D: "o",
  d: "k",
  L: "O",
  e: "O",
  i: "k",
  K: "k",
  S: "p",
};

// Retoques de diseño [x, y, color] tras el recolor.
const TOUCHES: Partial<Record<KittenView, [number, number, string][]>> = {
  // Nariz rosa en lugar de la mancha marrón, y ojos 2x2 con brillo.
  frente: [
    [8, 12, "R"],
    [9, 12, "R"],
    [5, 9, "w"],
    [11, 9, "w"],
  ],
};

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });
const eye = (x0: number, y0: number, x1: number, y1: number, outer: EyeAnchor["outer"]): EyeAnchor => ({
  ...box(x0, y0, x1, y1),
  outer,
  fill: "y",
  shade: "O",
});
const tail = (x0: number, y0: number, x1: number, y1: number, root: TailAnchor["root"]): TailAnchor => ({
  ...box(x0, y0, x1, y1),
  root,
});

// neckY: primera fila del cuerpo. hipY: primera fila de las patas.
const ANCHORS: Record<KittenView, { neckY: number; hipY: number; eyes: EyeAnchor[]; tail: TailAnchor }> = {
  frente: {
    neckY: 13,
    hipY: 17,
    eyes: [eye(5, 8, 6, 11, "left"), eye(11, 8, 12, 11, "right")],
    tail: tail(14, 13, 17, 17, "left"),
  },
  tresCuartos: {
    neckY: 12,
    hipY: 14,
    eyes: [eye(4, 6, 4, 9, "left")],
    tail: tail(12, 10, 15, 15, "left"),
  },
  lado: {
    neckY: 12,
    hipY: 15,
    eyes: [eye(3, 6, 3, 9, "right")],
    tail: tail(12, 7, 17, 11, "bottom"),
  },
  espalda: {
    neckY: 14,
    hipY: 19,
    eyes: [],
    tail: tail(0, 15, 6, 20, "right"),
  },
  espaldaTresCuartos: {
    neckY: 11,
    hipY: 17,
    eyes: [],
    tail: tail(13, 11, 18, 16, "left"),
  },
};

function clean(view: KittenView): string[] {
  const g = KITTEN_REFERENCE[view].map((row) => [...row].map((ch) => RECOLOR[ch] ?? ch));
  for (const [x, y, ch] of TOUCHES[view] ?? []) g[y][x] = ch;
  return g.map((r) => r.join(""));
}

function buildRig(view: KittenView, rows: string[]): Rig {
  const a = ANCHORS[view];
  // Patas: ancho medido en las 2 filas del suelo, fuera de la cola.
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = rows.length - 2; y < rows.length; y++)
    [...rows[y]].forEach((ch, x) => {
      if (ch === "." || inBox(a.tail, x, y)) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    });
  return {
    width: rows[0].length,
    height: rows.length,
    neckY: a.neckY,
    hipY: a.hipY,
    legs: box(minX, a.hipY, maxX, rows.length - 1),
    legSplitX: Math.round((minX + maxX + 1) / 2),
    eyes: a.eyes,
    tail: a.tail,
    seat: { x: 0, y: 0 },
  };
}

export const KITTEN = Object.fromEntries(
  (Object.keys(KITTEN_REFERENCE) as KittenView[]).map((view) => {
    const rows = clean(view);
    return [view, { rows, rig: buildRig(view, rows) }];
  }),
) as Record<KittenView, { rows: string[]; rig: Rig }>;

// Las figuras del panel miran a la izquierda; la derecha es el espejo.
export const KITTEN_DIRECTIONS: Record<Facing, { view: KittenView; flip: boolean }> = {
  abajo: { view: "frente", flip: false },
  "abajo-izquierda": { view: "tresCuartos", flip: false },
  izquierda: { view: "lado", flip: false },
  "arriba-izquierda": { view: "espaldaTresCuartos", flip: false },
  arriba: { view: "espalda", flip: false },
  "arriba-derecha": { view: "espaldaTresCuartos", flip: true },
  derecha: { view: "lado", flip: true },
  "abajo-derecha": { view: "tresCuartos", flip: true },
};
