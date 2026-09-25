// Líneas de tiempo de la animación. El bucle corre a 60 Hz, pero la pose
// solo cambia a ritmo de pixel art: cada parte tiene su propia secuencia de
// fotogramas y todas se muestrean con Math.floor(ms / paso).
//
// Para que el movimiento no se vea rígido se usan tres recursos clásicos:
//   - Movimiento secundario: el pelo (cabeza) y la cola llegan un fotograma
//     tarde respecto al cuerpo, así "rebotan" tras cada paso.
//   - Asentado: al parar, un fotograma con el cuerpo abajo antes del reposo.
//   - Desfase: cada ciclo (respirar, cola, parpadeo) tiene un periodo
//     distinto, así la pose en reposo nunca se repite de forma mecánica.
import { REST_POSE, type Pose } from "./pose";

export type AnimState = "idle" | "walk" | "pet";

export type PetPhase = "anticipacion" | "accion" | "impacto" | "recuperacion";

export interface AnimSample {
  pose: Pose;
  // Elevación del cuerpo entero (px enteros hacia arriba).
  lift: number;
  // Burbuja de corazón: null si no se ve; dy la hace "brotar" 2 px.
  bubble: { dy: number } | null;
  phase: string;
}

const at = <T>(seq: readonly T[], ms: number, step: number): T =>
  seq[((Math.floor(ms / step) % seq.length) + seq.length) % seq.length];

// Cola en vaivén lento: la punta sube y baja 1 px.
export const TAIL_IDLE = [0, 0, 1, 1, 0, 0, -1, -1] as const;
export const TAIL_IDLE_STEP = 190;
// Respiración en 4 tiempos: la cabeza baja 1 px y vuelve.
export const BREATH = [false, true, true, false] as const;
export const BREATH_STEP = 420;
// Parpadeo: 140 ms cerrados cada 3,4 s.
export const BLINK_EVERY = 3400;
export const BLINK_LENGTH = 140;
const BLINK_OFFSET = 1200;
// Al parar: 140 ms con el cuerpo y la cabeza abajo.
export const SETTLE_MS = 140;

// Ciclo de paso a 12 fps en 8 fotogramas: contacto (cuerpo abajo), la
// pierna se levanta, el pelo llega tarde (cabeza abajo con el cuerpo ya
// arriba), punto alto; y lo mismo con la otra pierna. La cola contrapesa
// con un fotograma de retraso.
export const WALK_STEP = 84;
export const WALK_CYCLE: readonly Pick<
  Pose,
  "bodyDrop" | "headDrop" | "leg" | "tail"
>[] = [
  { bodyDrop: true, headDrop: false, leg: "none", tail: 1 },
  { bodyDrop: true, headDrop: false, leg: "left", tail: 1 },
  { bodyDrop: false, headDrop: true, leg: "left", tail: 0 },
  { bodyDrop: false, headDrop: false, leg: "none", tail: -1 },
  { bodyDrop: true, headDrop: false, leg: "none", tail: -1 },
  { bodyDrop: true, headDrop: false, leg: "right", tail: -1 },
  { bodyDrop: false, headDrop: true, leg: "right", tail: 0 },
  { bodyDrop: false, headDrop: false, leg: "none", tail: 1 },
];

// Caricia: IDLE → ANTICIPACIÓN → ACCIÓN → IMPACTO → RECUPERACIÓN.
export const PET_TIMELINE: readonly { phase: PetPhase; until: number }[] = [
  { phase: "anticipacion", until: 120 },
  { phase: "accion", until: 360 },
  { phase: "impacto", until: 480 },
  { phase: "recuperacion", until: 1700 },
];
export const PET_DURATION = PET_TIMELINE[PET_TIMELINE.length - 1].until;

export const isBlinking = (ms: number, offset = BLINK_OFFSET) =>
  (((ms + offset) % BLINK_EVERY) + BLINK_EVERY) % BLINK_EVERY < BLINK_LENGTH;

// msInState: tiempo desde que empezó el reposo (para el asentado).
function idle(ms: number, reduced: boolean, msInState = Infinity): AnimSample {
  if (reduced) return { pose: REST_POSE, lift: 0, bubble: null, phase: "idle" };
  if (msInState < SETTLE_MS)
    return {
      pose: { ...REST_POSE, bodyDrop: true, headDrop: true, tail: -1 },
      lift: 0,
      bubble: null,
      phase: "asentado",
    };
  return {
    pose: {
      ...REST_POSE,
      headDrop: at(BREATH, ms, BREATH_STEP),
      tail: at(TAIL_IDLE, ms, TAIL_IDLE_STEP),
      eyes: isBlinking(ms) ? "closed" : "open",
    },
    lift: 0,
    bubble: null,
    phase: "idle",
  };
}

function walk(ms: number): AnimSample {
  return {
    pose: {
      ...REST_POSE,
      ...at(WALK_CYCLE, ms, WALK_STEP),
      eyes: isBlinking(ms) ? "closed" : "open",
    },
    lift: 0,
    bubble: null,
    phase: `walk ${Math.floor(ms / WALK_STEP) % WALK_CYCLE.length}`,
  };
}

export function petPhaseAt(msInState: number): PetPhase | null {
  return PET_TIMELINE.find((p) => msInState < p.until)?.phase ?? null;
}

function pet(msInState: number, ms: number): AnimSample {
  const phase = petPhaseAt(msInState) ?? "recuperacion";
  const base = idle(ms, false);
  const happy = { ...base.pose, eyes: "happy" as const };
  switch (phase) {
    case "anticipacion":
      // Se agacha: todo sobre las piernas baja 1 px y la cabeza otro más.
      return {
        pose: { ...happy, bodyDrop: true, headDrop: true, tail: -1 },
        lift: 0,
        bubble: null,
        phase,
      };
    case "accion":
      // Saltito de 2 px; el pelo se queda atrás (cabeza abajo).
      return {
        pose: { ...happy, bodyDrop: false, headDrop: true, tail: 1 },
        lift: 2,
        bubble: { dy: 2 },
        phase,
      };
    case "impacto":
      return {
        pose: { ...happy, bodyDrop: true, headDrop: true, tail: 0 },
        lift: 0,
        bubble: { dy: 1 },
        phase,
      };
    default:
      return {
        pose: msInState < 1100 ? happy : base.pose,
        lift: 0,
        bubble: { dy: 0 },
        phase,
      };
  }
}

export function sample(
  state: AnimState,
  msInState: number,
  ms: number,
  reduced = false,
): AnimSample {
  if (state === "walk") return walk(msInState);
  if (state === "pet") return pet(msInState, ms);
  return idle(ms, reduced, msInState);
}

// --- Gatito --------------------------------------------------------------

export type KittenState = "head" | "idle" | "walk" | "jumpDown" | "jumpUp";

// Salto: agacharse, vuelo en arco y aterrizaje aplastado.
export const KITTEN_JUMP_MS = 520;
const KITTEN_CROUCH_MS = 90;
const KITTEN_LAND_MS = 90;

// Coletazo del gatito: rápido y con pausa, distinto al de la niña.
const KITTEN_TAIL = [0, 1, 1, 0, -1, -1, 0, 0, 0, 0] as const;
const KITTEN_TAIL_STEP = 110;
// Cabeceo: baja la cabeza un momento cada ~1,3 s (mira alrededor).
const KITTEN_NOD = [
  false,
  false,
  false,
  true,
  true,
  false,
  false,
  false,
] as const;
const KITTEN_NOD_STEP = 160;
// Paso rápido del gatito: 4 fotogramas a 10 fps.
const KITTEN_WALK = [
  { bodyDrop: true, leg: "none" },
  { bodyDrop: false, leg: "left" },
  { bodyDrop: true, leg: "none" },
  { bodyDrop: false, leg: "right" },
] as const;
export const KITTEN_WALK_STEP = 100;

export interface KittenSample {
  pose: Pose;
  // Progreso del vuelo (0..1) para colocar al gatito en el arco.
  jump: number | null;
  phase: string;
}

export function sampleKitten(
  state: KittenState,
  msInState: number,
  ms: number,
  reduced = false,
): KittenSample {
  const eyes = isBlinking(ms, 400) ? "closed" : "open";
  if (state === "jumpDown" || state === "jumpUp") {
    const crouch = msInState < KITTEN_CROUCH_MS;
    const land = msInState > KITTEN_JUMP_MS - KITTEN_LAND_MS;
    const flight = Math.min(
      1,
      Math.max(
        0,
        (msInState - KITTEN_CROUCH_MS) /
          (KITTEN_JUMP_MS - KITTEN_CROUCH_MS - KITTEN_LAND_MS),
      ),
    );
    return {
      pose: {
        ...REST_POSE,
        // Agachado al impulsarse y al aterrizar; cola arriba en el aire.
        bodyDrop: crouch || land,
        headDrop: crouch || land,
        tail: crouch || land ? -1 : 1,
      },
      jump: crouch ? 0 : land ? 1 : flight,
      phase: crouch ? "impulso" : land ? "aterrizaje" : "vuelo",
    };
  }
  if (state === "walk")
    return {
      pose: {
        ...REST_POSE,
        ...at(KITTEN_WALK, msInState, KITTEN_WALK_STEP),
        tail: at([1, 0, -1, 0], msInState, KITTEN_WALK_STEP),
        eyes,
      },
      jump: null,
      phase: "walk",
    };
  if (reduced) return { pose: REST_POSE, jump: null, phase: state };
  return {
    pose: {
      ...REST_POSE,
      headDrop: at(KITTEN_NOD, ms, KITTEN_NOD_STEP),
      tail: at(KITTEN_TAIL, ms, KITTEN_TAIL_STEP),
      eyes,
    },
    jump: null,
    phase: state,
  };
}

// Posición en el salto: interpolación en x e y más un arco de altura fija.
// Se redondea al pintar, así el gatito siempre cae en la rejilla.
export function jumpArc(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
  height = 14,
) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - height * 4 * t * (1 - t),
  };
}
