// Reto: dibujar el fotograma de ojos cerrados de la figura "Abajo".
// La validación es estructural (colores, una sola línea, grosor, altura,
// coherencia entre ojos), no una comparación píxel a píxel: hay más de un
// parpadeo correcto.
import { closedEye } from "./pose";
import { GIRL, RIGS, type EyeAnchor } from "./rig";

export const EXERCISE_SPRITE = "abajo" as const;
export const EXERCISE_EYES: readonly EyeAnchor[] = RIGS[EXERCISE_SPRITE].eyes;

// Recorte de la cara que ve el editor: las dos cajas de ojo y 2 px de margen.
export const FACE_CROP = {
  x0: Math.min(...EXERCISE_EYES.map((e) => e.x0)) - 2,
  y0: Math.min(...EXERCISE_EYES.map((e) => e.y0)) - 2,
  x1: Math.max(...EXERCISE_EYES.map((e) => e.x1)) + 2,
  y1: Math.max(...EXERCISE_EYES.map((e) => e.y1)) + 2,
};

// Colores disponibles en el editor. Incluye los del ojo abierto a
// propósito: el reto es saber cuáles deben desaparecer.
export const EDITOR_COLORS = [
  "s",
  "S",
  "P",
  "k",
  "K",
  "i",
  "h",
  "w",
  "G",
] as const;

const SKIN = new Set(["s", "S", "P"]);
const LID = new Set(["k", "K"]);

export type EyePixels = string[][];

export function openEyes(): EyePixels[] {
  const rows = GIRL[EXERCISE_SPRITE].rows;
  return EXERCISE_EYES.map((e) =>
    rows.slice(e.y0, e.y1 + 1).map((row) => [...row.slice(e.x0, e.x1 + 1)]),
  );
}

export function solutionEyes(): EyePixels[] {
  return EXERCISE_EYES.map((e) => closedEye(e).map((row) => [...row]));
}

export interface Check {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
}

interface Lid {
  pixels: [number, number][];
  components: number;
  columns: Map<number, number[]>;
}

function lidOf(eye: EyePixels): Lid {
  const pixels: [number, number][] = [];
  eye.forEach((row, y) =>
    row.forEach((ch, x) => LID.has(ch) && pixels.push([x, y])),
  );
  // Componentes 8-conexas de la línea oscura.
  const key = (x: number, y: number) => `${x},${y}`;
  const dark = new Set(pixels.map(([x, y]) => key(x, y)));
  const seen = new Set<string>();
  let components = 0;
  for (const [x, y] of pixels) {
    if (seen.has(key(x, y))) continue;
    components++;
    const stack = [[x, y]];
    seen.add(key(x, y));
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const k = key(cx + dx, cy + dy);
          if (dark.has(k) && !seen.has(k)) {
            seen.add(k);
            stack.push([cx + dx, cy + dy]);
          }
        }
    }
  }
  const columns = new Map<number, number[]>();
  for (const [x, y] of pixels) columns.set(x, [...(columns.get(x) ?? []), y]);
  return { pixels, components, columns };
}

// Fila con más píxeles de párpado: la "altura" de la línea.
function mainRow(lid: Lid): number {
  const count = new Map<number, number>();
  for (const [, y] of lid.pixels) count.set(y, (count.get(y) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? -1;
}

const names = (i: number) =>
  EXERCISE_EYES.length > 1
    ? i === 0
      ? "ojo izquierdo"
      : "ojo derecho"
    : "ojo";

export function validateBlink(eyes: EyePixels[]): Check[] {
  const lids = eyes.map(lidOf);
  const perEye = (
    test: (eye: EyePixels, lid: Lid, i: number) => string | null,
  ) =>
    eyes
      .map((eye, i) => test(eye, lids[i], i))
      .filter((m): m is string => m !== null);

  const leftovers = perEye((eye, _, i) => {
    const bad = eye.flat().filter((ch) => !SKIN.has(ch) && !LID.has(ch));
    return bad.length
      ? `${names(i)}: ${bad.length} píxel(es) de ojo abierto (${[...new Set(bad)].join(", ")})`
      : null;
  });
  // Una línea tiene como mucho un píxel por columna más un par de escalones;
  // más píxeles oscuros que eso es una mancha (el iris), no un párpado.
  const isBlob = (eye: EyePixels, lid: Lid) =>
    lid.pixels.length > eye[0].length + 2;
  const oneLine = perEye((eye, lid, i) => {
    if (lid.components === 0) return `${names(i)}: no hay línea de párpado`;
    if (isBlob(eye, lid))
      return `${names(i)}: ${lid.pixels.length} píxeles oscuros forman una mancha, no una línea`;
    return lid.components === 1
      ? null
      : `${names(i)}: ${lid.components} trozos sueltos`;
  });
  const width = perEye((eye, lid, i) => {
    const w = eye[0].length;
    if (isBlob(eye, lid))
      return `${names(i)}: no se puede medir hasta que la mancha sea una línea`;
    return lid.columns.size >= w - 1
      ? null
      : `${names(i)}: la línea cubre ${lid.columns.size} de ${w} columnas`;
  });
  const thin = perEye((_, lid, i) => {
    const thick = [...lid.columns.values()].filter(
      (ys) => ys.length > 1,
    ).length;
    return thick
      ? `${names(i)}: ${thick} columna(s) con más de 1 px de línea`
      : null;
  });
  const low = perEye((eye, lid, i) => {
    const half = Math.floor((eye.length - 1) / 2);
    const high = lid.pixels.filter(([, y]) => y < half).length;
    return high
      ? `${names(i)}: ${high} píxel(es) de línea en la mitad de arriba`
      : null;
  });
  const rows = lids.map(mainRow);
  const corners = EXERCISE_EYES.map((e, i) => {
    const cols = [...lids[i].columns.keys()].sort((a, b) => a - b);
    if (!cols.length) return true;
    const outer = e.outer === "left" ? cols[0] : cols[cols.length - 1];
    const inner = e.outer === "left" ? cols[cols.length - 1] : cols[0];
    return (
      Math.max(...lids[i].columns.get(outer)!) >=
      Math.max(...lids[i].columns.get(inner)!)
    );
  });
  const mirrored =
    new Set(rows).size <= 1 && corners.every(Boolean)
      ? null
      : "las líneas no están a la misma altura o un rabillo exterior sube en vez de caer";

  const check = (
    id: string,
    title: string,
    problems: string[],
    okText: string,
  ): Check => ({
    id,
    title,
    ok: problems.length === 0,
    detail: problems.length ? problems.join("; ") : okText,
  });

  return [
    check(
      "colores",
      "Solo piel y párpado",
      leftovers,
      "sin brillos, iris ni esclerótica: el ojo está cerrado de verdad",
    ),
    check(
      "linea",
      "Una sola línea por ojo",
      oneLine,
      "cada párpado es un trazo continuo (8-conexo)",
    ),
    check(
      "ancho",
      "El párpado cubre todo el ojo",
      width,
      "la línea va de lado a lado de la caja",
    ),
    check(
      "grosor",
      "Grosor de 1 px",
      thin,
      "una línea por columna: escalones limpios, sin bultos",
    ),
    check(
      "altura",
      "El párpado está abajo",
      low,
      "la mitad de arriba es piel: el párpado ha bajado",
    ),
    check(
      "espejo",
      "Los dos ojos en espejo",
      mirrored ? [mirrored] : [],
      "misma altura y los rabillos exteriores caen hacia fuera",
    ),
  ];
}

export const HINTS = [
  "Principio: al cerrar el ojo el párpado baja y tapa el iris y los brillos. Lo que queda visible es piel y una única línea oscura de 1 px.",
  "Dónde mirar: la mitad superior de cada caja se queda de piel. La línea va en la mitad inferior y cruza la caja entera.",
  `Más concreto: rellena cada caja con "s" y traza una fila de "k" dos filas por encima del borde inferior; baja 1 px el píxel del rabillo exterior (hacia la oreja). Si quieres volumen, pon "S" justo debajo de la línea.`,
] as const;
