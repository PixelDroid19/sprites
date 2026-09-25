// Pintado sobre el lienzo lógico. Cada píxel es un fillRect de 1x1 en
// coordenadas enteras con un color de la paleta; los fotogramas se
// rasterizan una vez y se cachean como superficies.
import { createSurface, type Ctx, type Surface } from "../engine/surface";
import { PALETTE, SCENE, isPaletteKey } from "./palette";
import { composeRows, poseKey, type EyeOverride, type Pose } from "./pose";
import { KITTEN, type KittenView } from "./kitten";
import { GIRL, type Rig, type SpriteId } from "./rig";
import { HEART_BUBBLE } from "./sprites.generated";

export type ViewMode = "color" | "silhouette" | "grayscale";

// Gris con la misma luminancia (Rec. 601) que cada color: sirve para
// comprobar que el volumen se lee sin depender del tono.
const GRAY = Object.fromEntries(
  Object.entries(PALETTE).map(([key, { hex }]) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      .toString(16)
      .padStart(2, "0");
    return [key, `#${l}${l}${l}`];
  }),
) as Record<string, string>;

function colorOf(ch: string, mode: ViewMode): string {
  if (mode === "silhouette") return PALETTE.k.hex;
  if (mode === "grayscale") return GRAY[ch];
  return PALETTE[ch as keyof typeof PALETTE].hex;
}

export function paintRows(
  ctx: Ctx,
  rows: readonly string[],
  x: number,
  y: number,
  mode: ViewMode = "color",
) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx];
      if (ch === "." || !isPaletteKey(ch)) continue;
      ctx.fillStyle = colorOf(ch, mode);
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

// Caché acotada: pocas decenas de poses distintas por figura.
const frameCache = new Map<string, string[]>();
const surfaceCache = new Map<string, Surface>();
const CACHE_LIMIT = 600;

function remember<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = make();
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
}

// Los fotogramas con ojos del alumno se cachean aparte, por la identidad
// de la función que los aporta (cambia en cada "Ejecutar").
const overrideCache = new WeakMap<EyeOverride, Map<string, Surface>>();

// Todo lo que se puede pintar: las figuras de la niña por su id y las del
// gatito como "gatito:<vista>" (sentado) o "gatito-cabeza:<vista>"
// (tumbado sobre la cabeza). Todos usan el mismo sistema de poses.
export type ActorId =
  SpriteId | `gatito:${KittenView}` | `gatito-cabeza:${KittenView}`;

export function actor(id: ActorId): { rows: readonly string[]; rig: Rig } {
  const [kind, view] = id.split(":") as [string, KittenView];
  if (kind === "gatito") return KITTEN.sentado[view];
  if (kind === "gatito-cabeza") return KITTEN.tumbado[view];
  return GIRL[id as SpriteId];
}

export function getFrame(
  id: ActorId,
  pose: Pose,
  override?: EyeOverride,
): string[] {
  const { rows, rig } = actor(id);
  if (override && pose.eyes === "closed")
    return composeRows(id, rows, rig, pose, override);
  return remember(frameCache, `${id}|${poseKey(pose)}`, () =>
    composeRows(id, rows, rig, pose),
  );
}

function frameSurface(
  id: ActorId,
  pose: Pose,
  mode: ViewMode,
  override?: EyeOverride,
): Surface {
  const build = () => {
    const rows = getFrame(id, pose, override);
    const surface = createSurface(rows[0].length, rows.length);
    paintRows(surface.getContext("2d")!, rows, 0, 0, mode);
    return surface;
  };
  const key = `${id}|${poseKey(pose)}|${mode}`;
  if (override && pose.eyes === "closed") {
    let cache = overrideCache.get(override);
    if (!cache) overrideCache.set(override, (cache = new Map()));
    return remember(cache, key, build);
  }
  return remember(surfaceCache, key, build);
}

export interface CharacterDraw {
  sprite: ActorId;
  flip: boolean;
  pose: Pose;
  // Punto de apoyo: centro entre los pies, sobre la línea del suelo.
  x: number;
  y: number;
  // Elevación del cuerpo entero (salto), en px hacia arriba.
  lift?: number;
  mode?: ViewMode;
  override?: EyeOverride;
  // Solo las orejas (se pintan de nuevo delante del gatito en la cabeza).
  earsOnly?: boolean;
}

// Esquina superior izquierda del sprite ya colocado sobre su apoyo.
export function spriteOrigin(
  d: Pick<CharacterDraw, "sprite" | "flip" | "x" | "y" | "lift">,
) {
  const { rig } = actor(d.sprite);
  const anchorX = d.flip ? rig.width - rig.legSplitX : rig.legSplitX;
  return {
    x: Math.round(d.x) - anchorX,
    y: Math.round(d.y) - rig.height - Math.round(d.lift ?? 0),
  };
}

// Fotograma filtrado a la capa de orejas, desplazada con la cabeza.
function earSurface(id: ActorId, pose: Pose, mode: ViewMode): Surface | null {
  const layer = actor(id).rig.earLayer;
  if (!layer) return null;
  return remember(surfaceCache, `${id}|${poseKey(pose)}|${mode}|orejas`, () => {
    const drop = Number(pose.headDrop) + Number(pose.bodyDrop);
    const rows = getFrame(id, pose).map((row, y) =>
      [...row]
        .map((ch, x) => ((layer[y - drop]?.[x] ?? ".") !== "." ? ch : "."))
        .join(""),
    );
    const surface = createSurface(rows[0].length, rows.length);
    paintRows(surface.getContext("2d")!, rows, 0, 0, mode);
    return surface;
  });
}

export function drawCharacter(ctx: Ctx, d: CharacterDraw) {
  const surface = d.earsOnly
    ? earSurface(d.sprite, d.pose, d.mode ?? "color")
    : frameSurface(d.sprite, d.pose, d.mode ?? "color", d.override);
  if (!surface) return;
  const o = spriteOrigin(d);
  ctx.save();
  if (d.flip) {
    ctx.translate(o.x + surface.width, o.y);
    ctx.scale(-1, 1);
    ctx.drawImage(surface, 0, 0);
  } else {
    ctx.drawImage(surface, o.x, o.y);
  }
  ctx.restore();
}

// Sombra ovalada hecha de tramos horizontales: cada fila de la elipse se
// redondea a un ancho entero, así el borde forma escalones limpios.
export function drawShadow(
  ctx: Ctx,
  cx: number,
  groundY: number,
  rx: number,
  ry = 3,
) {
  ctx.fillStyle = SCENE.shadow;
  for (let r = -ry; r < ry; r++) {
    const v = (r + 0.5) / ry;
    const half = Math.round(rx * Math.sqrt(1 - v * v));
    if (half > 0)
      ctx.fillRect(Math.round(cx) - half, Math.round(groundY) + r, half * 2, 1);
  }
}

// Suelo de baldosas cálidas con juntas y motas, en tonos de la escena.
export const TILE = 16;
export function drawFloor(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = SCENE.floor;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCENE.floorLine;
  for (let y = 0; y < h; y += TILE) ctx.fillRect(0, y, w, 1);
  for (let y = 0; y < h; y += TILE) {
    const shift = (y / TILE) % 2 ? TILE / 2 : 0;
    for (let x = shift; x < w; x += TILE) ctx.fillRect(x, y, 1, TILE);
  }
  ctx.fillStyle = SCENE.floorDot;
  for (let y = 0; y < h; y += TILE)
    for (let x = 0; x < w; x += TILE) {
      ctx.fillRect(x + 5, y + 6, 2, 1);
      ctx.fillRect(x + 11, y + 11, 1, 1);
    }
}

export const BUBBLE_W = HEART_BUBBLE[0].length;
export const BUBBLE_H = HEART_BUBBLE.length;

export function drawHeartBubble(ctx: Ctx, x: number, y: number) {
  paintRows(ctx, HEART_BUBBLE, Math.round(x), Math.round(y));
}
