import { REFERENCE_SPRITES } from "../nina-gatita/sprites.generated";
import type { SpriteId } from "../nina-gatita/rig";
import { h } from "./dom";

// Hoja original, servida desde public/. Se muestra solo como referencia
// visual al lado del pixel art; el personaje nunca se pinta desde ella.
export const REFERENCE_SHEET = {
  src: `${import.meta.env.BASE_URL}referencia/nina-gatita-referencia.webp`,
  width: 1536,
  height: 1024,
} as const;

// Recorte de una figura de la hoja escalado a `height` px CSS.
export function referenceCrop(
  id: SpriteId,
  height: number,
  flip = false,
): HTMLElement {
  const el = h("div", { className: "ng-ref", role: "img" });
  updateReferenceCrop(el, id, height, flip);
  return el;
}

export function updateReferenceCrop(
  el: HTMLElement,
  id: SpriteId,
  height: number,
  flip = false,
) {
  const [x0, y0, x1, y1] = REFERENCE_SPRITES[id].box;
  const scale = height / (y1 - y0 + 1);
  el.setAttribute(
    "aria-label",
    `Figura «${REFERENCE_SPRITES[id].label}» de la hoja original`,
  );
  Object.assign(el.style, {
    width: `${Math.round((x1 - x0 + 1) * scale)}px`,
    height: `${height}px`,
    backgroundImage: `url("${REFERENCE_SHEET.src}")`,
    backgroundSize: `${REFERENCE_SHEET.width * scale}px ${REFERENCE_SHEET.height * scale}px`,
    backgroundPosition: `${-x0 * scale}px ${-y0 * scale}px`,
    transform: flip ? "scaleX(-1)" : "",
  });
}
