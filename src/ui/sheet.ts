// Hoja: las 9 figuras junto a su recorte original, y la paleta por grupos.
import type { Ctx } from "../engine/surface";
import { sample } from "../nina-gatita/animation";
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

export function createSheet(): HTMLElement {
  const reduced = prefersReducedMotion();
  const cards = SPRITE_IDS.map((id) => spriteCard(id, reduced));
  const screens: PixelScreen[] = cards.map((c) => c.screen);
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
        "A la izquierda, el recorte de la hoja original; a la derecha, la misma figura pintada en JS píxel a píxel desde la rejilla extraída, con su animación de reposo.",
      ]),
      h("div", { className: "ng-buttons", style: "margin-bottom:12px" }, [
        toggle,
      ]),
      h(
        "div",
        { className: "ng-sheet" },
        cards.map((c) => c.card),
      ),
      h("div", { className: "ng-panel", style: "margin-top:12px" }, [
        h("p", { className: "ng-panel-title" }, [
          `Paleta (${PALETTE_KEYS.length} colores, por función)`,
        ]),
        paletteGroups(),
      ]),
    ],
  );
}
