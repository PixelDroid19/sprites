// Líneas de tiempo de la animación. El bucle corre a 60 Hz, pero la pose
// solo cambia a ritmo de pixel art (5-8 fps): cada parte tiene su propia
// secuencia de fotogramas y todas se muestrean con Math.floor(ms / paso).
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
export const TAIL_IDLE_STEP = 180;
// Cola del gatito: un coletazo corto y una pausa.
export const KITTEN_TAIL = [0, 1, 1, 0, 0, -1, 0, 0] as const;
export const KITTEN_TAIL_STEP = 150;
// Respiración: la cabeza baja 1 px cada 600 ms.
export const BREATH_STEP = 600;
// Parpadeo: 140 ms cerrados cada 3,4 s.
export const BLINK_EVERY = 3400;
export const BLINK_LENGTH = 140;
const BLINK_OFFSET = 1200;

// Ciclo de paso a 8 fps: contacto (cuerpo abajo), pie izquierdo arriba,
// contacto, pie derecho arriba. La cola contrapesa el paso.
export const WALK_STEP = 125;
export const WALK_CYCLE: readonly Pick<Pose, "bodyDrop" | "leg" | "tail">[] = [
  { bodyDrop: true, leg: "none", tail: 1 },
  { bodyDrop: false, leg: "left", tail: 0 },
  { bodyDrop: true, leg: "none", tail: -1 },
  { bodyDrop: false, leg: "right", tail: 0 },
];

// Caricia: IDLE → ANTICIPACIÓN → ACCIÓN → IMPACTO → RECUPERACIÓN.
export const PET_TIMELINE: readonly { phase: PetPhase; until: number }[] = [
  { phase: "anticipacion", until: 120 },
  { phase: "accion", until: 360 },
  { phase: "impacto", until: 480 },
  { phase: "recuperacion", until: 1700 },
];
export const PET_DURATION = PET_TIMELINE[PET_TIMELINE.length - 1].until;

export const isBlinking = (ms: number) =>
  (((ms + BLINK_OFFSET) % BLINK_EVERY) + BLINK_EVERY) % BLINK_EVERY <
  BLINK_LENGTH;

function idle(ms: number, reduced: boolean): AnimSample {
  if (reduced) return { pose: REST_POSE, lift: 0, bubble: null, phase: "idle" };
  return {
    pose: {
      ...REST_POSE,
      headDrop: at([false, true], ms, BREATH_STEP),
      tail: at(TAIL_IDLE, ms, TAIL_IDLE_STEP),
      kittenTail: at(KITTEN_TAIL, ms, KITTEN_TAIL_STEP),
      eyes: isBlinking(ms) ? "closed" : "open",
    },
    lift: 0,
    bubble: null,
    phase: "idle",
  };
}

function walk(ms: number): AnimSample {
  const step = at(WALK_CYCLE, ms, WALK_STEP);
  return {
    pose: {
      ...REST_POSE,
      ...step,
      kittenTail: at([0, 1, 0, -1], ms, WALK_STEP),
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
      // Se agacha: todo sobre las piernas baja 1 px.
      return {
        pose: { ...happy, bodyDrop: true, tail: -1 },
        lift: 0,
        bubble: null,
        phase,
      };
    case "accion":
      // Saltito de 2 px con la cola arriba.
      return {
        pose: { ...happy, headDrop: true, tail: 1, kittenTail: 1 },
        lift: 2,
        bubble: { dy: 2 },
        phase,
      };
    case "impacto":
      return {
        pose: { ...happy, bodyDrop: true, tail: 0 },
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
  return idle(ms, reduced);
}
