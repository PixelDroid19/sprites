// El gatito como personaje propio, sobre los sprites dibujados a mano de
// kitten-art.ts. Usa el mismo sistema de anclajes y poses que la niña:
// cabeza (filas 0-13), patas (3 filas del suelo), ojos y cola.
import { KITTEN_BACK_TAIL, KITTEN_LIE, KITTEN_SIT } from "./kitten-art";
import type { Box, EyeAnchor, Rig, TailAnchor } from "./rig";
import { inBox } from "./rig";
import type { Facing } from "./types";

export type KittenView = keyof typeof KITTEN_SIT;
export type KittenPose = "sentado" | "tumbado";

// Primera fila del cuerpo: todas las vistas comparten la misma cabeza.
const NECK_Y = 14;

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({
  x0,
  y0,
  x1,
  y1,
});
// Los ojos se cierran con pelaje (no piel) y su sombra.
const eye = (x0: number, y0: number, outer: EyeAnchor["outer"]): EyeAnchor => ({
  ...box(x0, y0, x0 + 1, y0 + 3),
  outer,
  fill: "y",
  shade: "O",
});
const tail = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  root: TailAnchor["root"],
): TailAnchor => ({ ...box(x0, y0, x1, y1), root });
// Vista sin cola visible: caja vacía, el vaivén no mueve nada.
const NO_TAIL = tail(0, 0, 0, 0, "left");

// Ojos (2x2, la caja empieza una fila por encima) y cola de cada vista.
const ANCHORS: Record<KittenView, { eyes: EyeAnchor[]; tail: TailAnchor }> = {
  frente: { eyes: [eye(6, 7, "left"), eye(16, 7, "right")], tail: NO_TAIL },
  lado: { eyes: [eye(5, 7, "right")], tail: tail(20, 1, 25, 11, "bottom") },
  tresCuartos: {
    eyes: [eye(5, 7, "left"), eye(12, 7, "right")],
    tail: tail(22, 1, 27, 11, "bottom"),
  },
  espalda: { eyes: [], tail: tail(9, 15, 14, 19, "bottom") },
  espaldaTresCuartos: { eyes: [], tail: tail(22, 1, 27, 11, "bottom") },
};

function buildRig(
  view: KittenView,
  rows: readonly string[],
  lying: boolean,
): Rig {
  const a = ANCHORS[view];
  const h = rows.length;
  // En el tumbado la cola de la espalda queda bajo el cuerpo: no se ve.
  const hideTail = lying && view === "espalda";
  const tailAnchor = hideTail ? NO_TAIL : a.tail;
  // Patas: las 3 filas del suelo (en el tumbado, las que quedan bajo el
  // cuello).
  const hipY = Math.max(NECK_Y + 1, h - 3);
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = hipY; y < h; y++)
    [...rows[y]].forEach((ch, x) => {
      if (ch === "." || inBox(tailAnchor, x, y)) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    });
  return {
    width: rows[0].length,
    height: h,
    neckY: NECK_Y,
    hipY,
    legs: box(minX, hipY, maxX, h - 1),
    legSplitX: Math.round((minX + maxX + 1) / 2),
    eyes: a.eyes,
    tail: tailAnchor,
    tailLayer: view === "espalda" && !lying ? KITTEN_BACK_TAIL : undefined,
    seat: { x: 0, y: 0 },
  };
}

type Sprite = { rows: readonly string[]; rig: Rig };

const build = (source: Record<KittenView, readonly string[]>, lying: boolean) =>
  Object.fromEntries(
    (Object.keys(source) as KittenView[]).map((view) => [
      view,
      { rows: source[view], rig: buildRig(view, source[view], lying) },
    ]),
  ) as Record<KittenView, Sprite>;

export const KITTEN: Record<KittenPose, Record<KittenView, Sprite>> = {
  sentado: build(KITTEN_SIT, false),
  tumbado: build(KITTEN_LIE, true),
};

// Todas las vistas miran a la izquierda; la derecha es el espejo.
export const KITTEN_DIRECTIONS: Record<
  Facing,
  { view: KittenView; flip: boolean }
> = {
  abajo: { view: "frente", flip: false },
  "abajo-izquierda": { view: "tresCuartos", flip: false },
  izquierda: { view: "lado", flip: false },
  "arriba-izquierda": { view: "espaldaTresCuartos", flip: false },
  arriba: { view: "espalda", flip: false },
  "arriba-derecha": { view: "espaldaTresCuartos", flip: true },
  derecha: { view: "lado", flip: true },
  "abajo-derecha": { view: "tresCuartos", flip: true },
};
