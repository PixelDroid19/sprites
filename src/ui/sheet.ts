// Hoja: las 9 figuras junto a su recorte original, y la paleta por grupos.
import type { Ctx } from "../engine/surface";
import { sample, sampleKitten } from "../nina-gatita/animation";
import { KITTEN_DIRECTIONS } from "../nina-gatita/kitten";
import type { Facing } from "../nina-gatita/types";
import {
  PALETTE,
  PALETTE_KEYS,
  type PaletteGroup,
} from "../nina-gatita/palette";
import { drawCharacter, drawShadow } from "../nina-gatita/render";
import { RIGS, SPRITE_IDS, type SpriteId } from "../nina-gatita/rig";
import { REFERENCE_SPRITES } from "../nina-gatita/sprites.generated";
import { h, prefersReducedMotion } from "./dom";
import { createPixelScreen, type PixelScreen } from "./pixel-screen";
import { referenceCrop } from "./reference-crop";

// Escala fija de las tarjetas: 3 px CSS por píxel lógico.
const CARD_SCALE = 3;
const PAD_X = 2;
const PAD_BOTTOM = 3;

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Avisos donde la hoja se contradice a sí misma.
function warningFor(id: SpriteId): string | null {
  const s = REFERENCE_SPRITES[id];
  if (s.label.toLowerCase() === s.faces) return null;
  return `La etiqueta dice «${s.label}», pero la figura mira hacia ${s.faces}.`;
}

function spriteCard(id: SpriteId, reduced: boolean) {
  const rig = RIGS[id];
  const s = REFERENCE_SPRITES[id];
  const w = rig.width + PAD_X * 2;
  const hgt = rig.height + PAD_BOTTOM;
  const screen = createPixelScreen({
    width: w,
    height: hgt,
    label: `Figura ${s.label} en pixel art`,
    render: (ctx: Ctx, ms: number) => {
      // Cada tarjeta desfasa su reloj para que no parpadeen todas a la vez.
      const anim = sample("idle", ms, ms + id.length * 377, reduced);
      drawShadow(ctx, PAD_X + rig.legSplitX, rig.height, 11);
      drawCharacter(ctx, {
        sprite: id,
        flip: false,
        pose: anim.pose,
        x: PAD_X + rig.legSplitX,
        y: rig.height,
      });
    },
  });
  const warning = warningFor(id);
  const card = h("article", { className: "ng-card" }, [
    h("div", { className: "ng-card-pair" }, [
      h("figure", {}, [
        referenceCrop(
          id,
          (s.box[3] - s.box[1] + 1) * (CARD_SCALE / s.pitch[1]),
        ),
        h("figcaption", {}, ["hoja"]),
      ]),
      h("figure", {}, [
        h("div", { style: `width:${w * CARD_SCALE}px` }, [screen.el]),
        h("figcaption", {}, [`JS · ${rig.width}×${rig.height}`]),
      ]),
    ]),
    h("h3", {}, [s.label]),
    h("p", { className: "ng-note" }, [
      `Celda media ${fmt(s.pitch[0])}×${fmt(s.pitch[1])} px de la hoja · ΔE medio ${fmt(s.meanDeltaE)}`,
    ]),
    warning && h("p", { className: "ng-warn" }, [warning]),
  ]);
  return { card, screen };
}

const GROUP_ORDER: PaletteGroup[] = [
  "contorno",
  "pelo",
  "ojos",
  "piel",
  "jersey",
  "falda",
  "blancos",
  "gatito",
];

function paletteGroups() {
  return h(
    "div",
    { className: "ng-palette" },
    GROUP_ORDER.map((group) =>
      h("div", {}, [
        h("p", { className: "ng-note", style: "margin:0 0 4px" }, [group]),
        h(
          "div",
          { className: "ng-swatches" },
          PALETTE_KEYS.filter((k) => PALETTE[k].group === group).map((k) =>
            h(
              "span",
              {
                className: "ng-swatch",
                title: `${PALETTE[k].role} · ${PALETTE[k].hex}`,
                style: "cursor:default",
              },
              [
                h("span", {
                  className: "ng-chip",
                  style: `background:${PALETTE[k].hex}`,
                }),
                h("span", { className: "ng-mono" }, [k]),
              ],
            ),
          ),
        ),
      ]),
    ),
  );
}

// Orden de la hoja del gatito: de abajo en sentido horario.
const KITTEN_ORDER: Facing[] = [
  "abajo",
  "abajo-izquierda",
  "izquierda",
  "arriba-izquierda",
  "arriba",
  "arriba-derecha",
  "derecha",
  "abajo-derecha",
];
const KITTEN_CELL = 32;
const KITTEN_SIT_Y = 27;
const KITTEN_LIE_Y = 50;

// Recorte de una franja de la hoja del gatito escalada a `width` px CSS.
function kittenReference(box: readonly number[], width: number) {
  const [x0, y0, x1, y1] = box;
  const scale = width / (x1 - x0);
  return h("div", {
    className: "ng-ref",
    role: "img",
    "aria-label": "Hoja de referencia del gatito",
    style: `width:${width}px;height:${Math.round((y1 - y0) * scale)}px;background-image:url("${import.meta.env.BASE_URL}referencia/gatito-referencia.webp");background-size:${1536 * scale}px ${1024 * scale}px;background-position:${-x0 * scale}px ${-y0 * scale}px`,
  });
}

// El gatito en sus 8 direcciones, sentado (arriba) y tumbado como va en la
// cabeza (abajo), todos en un solo lienzo con su animación de reposo.
function kittenPanel(reduced: boolean) {
  const width = KITTEN_CELL * KITTEN_ORDER.length;
  const screen = createPixelScreen({
    width,
    height: KITTEN_LIE_Y + 2,
    label: "El gatito en 8 direcciones, sentado y tumbado",
    render: (ctx: Ctx, ms: number) => {
      KITTEN_ORDER.forEach((facing, i) => {
        const d = KITTEN_DIRECTIONS[facing];
        const x = i * KITTEN_CELL + KITTEN_CELL / 2;
        const pose = sampleKitten("idle", ms, ms + i * 290, reduced).pose;
        drawShadow(ctx, x, KITTEN_SIT_Y - 1, 7, 2);
        drawCharacter(ctx, {
          sprite: `gatito:${d.view}`,
          flip: d.flip,
          pose,
          x,
          y: KITTEN_SIT_Y,
        });
        drawCharacter(ctx, {
          sprite: `gatito-cabeza:${d.view}`,
          flip: d.flip,
          pose,
          x,
          y: KITTEN_LIE_Y,
        });
      });
    },
  });
  return {
    screen,
    el: h("div", { className: "ng-panel", style: "margin-top:12px" }, [
      h("p", { className: "ng-panel-title" }, [
        "Gatito: 8 direcciones, sentado y en la cabeza",
      ]),
      h(
        "div",
        {
          style:
            "display:flex;flex-direction:column;align-items:center;gap:6px",
        },
        [
          kittenReference([17, 195, 1517, 345], width * 3),
          kittenReference([17, 495, 1517, 615], width * 3),
          h("div", { style: `width:${width * 3}px;max-width:100%` }, [
            screen.el,
          ]),
        ],
      ),
      h("p", { className: "ng-note" }, [
        "Arriba, la hoja de referencia del gatito. Abajo, el gatito del proyecto, dibujado a mano sobre la rejilla siguiendo esa hoja (la extracción automática rompía ojos, boca y bigotes). Las vistas hacia la derecha son el espejo de las de la izquierda.",
      ]),
    ]),
  };
}

export function createSheet(): HTMLElement {
  const reduced = prefersReducedMotion();
  const cards = SPRITE_IDS.map((id) => spriteCard(id, reduced));
  const kitten = kittenPanel(reduced);
  const screens: PixelScreen[] = [...cards.map((c) => c.screen), kitten.screen];
  let playing = true;
  const toggle = h("button", { type: "button", className: "ng-btn" }, [
    "Pausar animaciones",
  ]);
  toggle.addEventListener("click", () => {
    playing = !playing;
    toggle.textContent = playing
      ? "Pausar animaciones"
      : "Reanudar animaciones";
    toggle.setAttribute("aria-pressed", String(!playing));
    screens.forEach((s) => s.setPlaying(playing));
  });

  return h(
    "section",
    { className: "ng", "aria-label": "Niña Gatita: hoja de personaje" },
    [
      h("p", { className: "ng-eyebrow" }, ["Las 9 figuras de la hoja"]),
      h("h2", { className: "ng-title" }, [
        "Referencia frente a rejilla extraída",
      ]),
      h("p", { className: "ng-intro" }, [
        "A la izquierda, el recorte de la hoja original; a la derecha, la misma figura pintada en JS píxel a píxel desde la rejilla extraída y corregida (sin el gatito, que ahora es un personaje aparte), con su animación de reposo.",
      ]),
      h("div", { className: "ng-buttons", style: "margin-bottom:12px" }, [
        toggle,
      ]),
      h(
        "div",
        { className: "ng-sheet" },
        cards.map((c) => c.card),
      ),
      kitten.el,
      h("div", { className: "ng-panel", style: "margin-top:12px" }, [
        h("p", { className: "ng-panel-title" }, [
          `Paleta (${PALETTE_KEYS.length} colores, por función)`,
        ]),
        paletteGroups(),
      ]),
    ],
  );
}
