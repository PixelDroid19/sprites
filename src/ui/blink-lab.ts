// Reto: dibujar el fotograma de ojos cerrados y verlo en la animación.
import type { Ctx } from "../engine/surface";
import { sample } from "../nina-gatita/animation";
import {
  EDITOR_COLORS,
  EXERCISE_EYES,
  EXERCISE_SPRITE,
  FACE_CROP,
  HINTS,
  openEyes,
  solutionEyes,
  validateBlink,
  type EyePixels,
} from "../nina-gatita/blink-exercise";
import { PALETTE } from "../nina-gatita/palette";
import type { EyeOverride } from "../nina-gatita/pose";
import { drawCharacter, drawShadow, paintRows } from "../nina-gatita/render";
import { RIGS } from "../nina-gatita/rig";
import { REFERENCE_SPRITES } from "../nina-gatita/sprites.generated";
import { h, prefersReducedMotion } from "./dom";
import { createPixelScreen } from "./pixel-screen";

const CROP_W = FACE_CROP.x1 - FACE_CROP.x0 + 1;
const CROP_H = FACE_CROP.y1 - FACE_CROP.y0 + 1;
const RIG = RIGS[EXERCISE_SPRITE];
const PREVIEW_W = RIG.width + 4;
const PREVIEW_H = RIG.height + 3;
// En la vista previa el parpadeo se repite rápido para poder observarlo:
// 450 ms cerrados cada 1,5 s.
const PREVIEW_BLINK_EVERY = 1500;
const PREVIEW_BLINK_LENGTH = 450;

const cloneEyes = (eyes: EyePixels[]) =>
  eyes.map((eye) => eye.map((row) => [...row]));

// Cara del sprite con los ojos del alumno encima, en coordenadas del recorte.
function faceRows(eyes: EyePixels[]): string[] {
  const rows = REFERENCE_SPRITES[EXERCISE_SPRITE].rows
    .slice(FACE_CROP.y0, FACE_CROP.y1 + 1)
    .map((row) => [...row.slice(FACE_CROP.x0, FACE_CROP.x1 + 1)]);
  EXERCISE_EYES.forEach((e, i) =>
    eyes[i].forEach((row, dy) =>
      row.forEach((ch, dx) => {
        rows[e.y0 - FACE_CROP.y0 + dy][e.x0 - FACE_CROP.x0 + dx] = ch;
      }),
    ),
  );
  return rows.map((r) => r.join(""));
}

const pctX = (v: number) => `${(v / CROP_W) * 100}%`;
const pctY = (v: number) => `${(v / CROP_H) * 100}%`;

// Editor ampliado de la cara: solo se pinta dentro de las cajas de ojo.
function pixelEditor(
  onPaint?: (eye: number, x: number, y: number) => void,
  onStrokeStart?: () => void,
) {
  const canvas = h("canvas", {
    width: CROP_W,
    height: CROP_H,
    role: "img",
    "aria-label": "Ojos de la figura Abajo, ampliados para editar",
  });
  const el = h("div", { className: "ng-editor" }, [
    canvas,
    h("div", {
      className: "ng-overlay",
      style: `background-image:linear-gradient(to right, rgba(58,42,36,.25) 1px, transparent 1px),linear-gradient(to bottom, rgba(58,42,36,.25) 1px, transparent 1px);background-size:${100 / CROP_W}% ${100 / CROP_H}%`,
    }),
    ...EXERCISE_EYES.map((b) =>
      h("span", {
        className: "ng-editbox",
        style: `left:${pctX(b.x0 - FACE_CROP.x0)};top:${pctY(b.y0 - FACE_CROP.y0)};width:${pctX(b.x1 - b.x0 + 1)};height:${pctY(b.y1 - b.y0 + 1)}`,
      }),
    ),
  ]);
  const draw = (eyes: EyePixels[]) => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CROP_W, CROP_H);
    paintRows(ctx as unknown as Ctx, faceRows(eyes), 0, 0);
  };
  if (onPaint) {
    let drawing = false;
    const paintAt = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x =
        FACE_CROP.x0 +
        Math.floor(((e.clientX - rect.left) / rect.width) * CROP_W);
      const y =
        FACE_CROP.y0 +
        Math.floor(((e.clientY - rect.top) / rect.height) * CROP_H);
      const i = EXERCISE_EYES.findIndex(
        (b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1,
      );
      if (i >= 0) onPaint(i, x - EXERCISE_EYES[i].x0, y - EXERCISE_EYES[i].y0);
    };
    el.addEventListener("pointerdown", (e) => {
      drawing = true;
      el.setPointerCapture(e.pointerId);
      onStrokeStart?.();
      paintAt(e);
    });
    el.addEventListener("pointermove", (e) => drawing && paintAt(e));
    el.addEventListener("pointerup", () => (drawing = false));
    el.addEventListener("pointercancel", () => (drawing = false));
  } else {
    el.style.pointerEvents = "none";
  }
  return { el, draw };
}

export function createBlinkLab(): HTMLElement {
  const reduced = prefersReducedMotion();
  let eyes = openEyes();
  let color: string = "s";
  let history: EyePixels[][] = [];
  let hints = 0;
  // Ojos "ejecutados" en la vista previa: cambian solo al pulsar Ejecutar.
  let override: EyeOverride | undefined;

  const editor = pixelEditor(
    (i, x, y) => {
      if (eyes[i][y][x] === color) return;
      eyes = cloneEyes(eyes);
      eyes[i][y][x] = color;
      editor.draw(eyes);
    },
    () => {
      history = [...history.slice(-30), cloneEyes(eyes)];
      undoBtn.disabled = false;
    },
  );
  editor.draw(eyes);

  const setEyes = (next: EyePixels[]) => {
    eyes = next;
    editor.draw(eyes);
  };

  // Paleta del lápiz.
  const swatches = EDITOR_COLORS.map((k) => {
    const btn = h(
      "button",
      {
        type: "button",
        className: "ng-swatch",
        "aria-label": `${PALETTE[k].role} (${k})`,
        title: `${PALETTE[k].role} · ${PALETTE[k].hex}`,
      },
      [
        h("span", {
          className: "ng-chip",
          style: `background:${PALETTE[k].hex}`,
        }),
        h("span", { className: "ng-mono" }, [k]),
      ],
    );
    btn.setAttribute("aria-pressed", String(k === color));
    btn.addEventListener("click", () => {
      color = k;
      swatches.forEach((b, i) =>
        b.setAttribute("aria-pressed", String(EDITOR_COLORS[i] === k)),
      );
    });
    return btn;
  });

  // Resultado de la última ejecución.
  const verdict = h("p", { className: "ng-verdict" });
  const checks = h("ul", { className: "ng-checks" });
  const idleNote = h("p", { className: "ng-note" }, [
    "Pulsa Ejecutar para meter tu fotograma en la animación.",
  ]);
  const run = () => {
    const ran = cloneEyes(eyes);
    override = (_, i) => ran[i].map((row) => row.join(""));
    const result = validateBlink(eyes);
    const ok = result.every((c) => c.ok);
    idleNote.hidden = true;
    verdict.dataset.ok = String(ok);
    verdict.textContent = ok
      ? "Parpadeo correcto: cumple todas las reglas."
      : "Aún no: revisa las reglas en rojo.";
    checks.replaceChildren(
      ...result.map((c) =>
        h("li", { "data-ok": String(c.ok) }, [
          c.title,
          h("small", {}, [c.detail]),
        ]),
      ),
    );
    preview.setPlaying(true);
  };

  const hintsBox = h("div");
  const hintBtn = h("button", { type: "button", className: "ng-btn" });
  const syncHints = () => {
    hintBtn.textContent = `Pista ${Math.min(hints + 1, HINTS.length)}/${HINTS.length}`;
    hintBtn.disabled = hints >= HINTS.length;
    hintsBox.replaceChildren(
      ...HINTS.slice(0, hints).map((text, i) =>
        h("p", { className: "ng-hint" }, [
          h("strong", {}, [`Pista ${i + 1}. `]),
          text,
        ]),
      ),
    );
  };
  hintBtn.addEventListener("click", () => {
    hints = Math.min(HINTS.length, hints + 1);
    syncHints();
  });
  syncHints();

  const runBtn = h(
    "button",
    { type: "button", className: "ng-btn ng-btn-primary" },
    ["Ejecutar"],
  );
  runBtn.addEventListener("click", run);
  const undoBtn = h(
    "button",
    { type: "button", className: "ng-btn", disabled: true },
    ["Deshacer"],
  );
  undoBtn.addEventListener("click", () => {
    const last = history.pop();
    if (last) setEyes(last);
    undoBtn.disabled = history.length === 0;
  });
  const resetBtn = h("button", { type: "button", className: "ng-btn" }, [
    "Reiniciar",
  ]);
  resetBtn.addEventListener("click", () => {
    setEyes(openEyes());
    history = [];
    undoBtn.disabled = true;
    override = undefined;
    verdict.textContent = "";
    checks.replaceChildren();
    idleNote.hidden = false;
  });

  // Solución de referencia, oculta hasta que se pide.
  const solution = solutionEyes();
  const solutionView = pixelEditor();
  solutionView.draw(solution);
  const copyBtn = h("button", { type: "button", className: "ng-btn" }, [
    "Copiar al editor",
  ]);
  copyBtn.addEventListener("click", () => {
    history = [...history, cloneEyes(eyes)];
    undoBtn.disabled = false;
    setEyes(cloneEyes(solution));
  });
  const solutionBox = h("div", { className: "ng-hint", hidden: true }, [
    h("strong", {}, ["Solución de referencia"]),
    " (la que usa la animación del escenario). No es la única válida: la validación mira reglas, no píxeles exactos.",
    h("div", { style: "max-width:360px;margin-top:8px" }, [solutionView.el]),
    h("div", { className: "ng-buttons" }, [copyBtn]),
  ]);
  const solutionBtn = h("button", { type: "button", className: "ng-btn" }, [
    "Ver solución",
  ]);
  solutionBtn.addEventListener("click", () => {
    solutionBox.hidden = !solutionBox.hidden;
    solutionBtn.textContent = solutionBox.hidden
      ? "Ver solución"
      : "Ocultar solución";
    solutionBtn.setAttribute("aria-pressed", String(!solutionBox.hidden));
  });

  const preview = createPixelScreen({
    width: PREVIEW_W,
    height: PREVIEW_H,
    label: "Vista previa del parpadeo",
    playing: !reduced,
    render: (ctx: Ctx, ms: number) => {
      const base = sample("idle", ms, ms, reduced).pose;
      const closed =
        override !== undefined &&
        ms % PREVIEW_BLINK_EVERY >= PREVIEW_BLINK_EVERY - PREVIEW_BLINK_LENGTH;
      const pose = {
        ...base,
        eyes: closed ? ("closed" as const) : ("open" as const),
      };
      const x = 2 + RIG.legSplitX;
      drawShadow(ctx, x, RIG.height, 11);
      drawCharacter(ctx, {
        sprite: EXERCISE_SPRITE,
        flip: false,
        pose,
        x,
        y: RIG.height,
        override,
      });
    },
  });

  return h(
    "section",
    { className: "ng", "aria-label": "Reto: fotograma de parpadeo" },
    [
      h("p", { className: "ng-eyebrow" }, ["Reto · fotograma de animación"]),
      h("h2", { className: "ng-title" }, ["Dibuja el parpadeo"]),
      h("p", { className: "ng-intro" }, [
        "La animación de reposo necesita un fotograma con los ojos cerrados. Solo puedes pintar dentro de las cajas discontinuas (los anclajes de los ojos). Pinta, pulsa Ejecutar y observa el parpadeo en la vista previa.",
      ]),
      h("div", { className: "ng-cols" }, [
        h("div", { className: "ng-panel" }, [
          h("p", { className: "ng-panel-title" }, [
            "Editor (ojos de la figura «Abajo»)",
          ]),
          editor.el,
          h(
            "div",
            {
              className: "ng-swatches",
              role: "group",
              "aria-label": "Color del lápiz",
              style: "margin-top:10px",
            },
            swatches,
          ),
          h("div", { className: "ng-buttons" }, [
            runBtn,
            undoBtn,
            resetBtn,
            hintBtn,
            solutionBtn,
          ]),
          hintsBox,
          solutionBox,
        ]),
        h("div", { className: "ng-panel" }, [
          h("p", { className: "ng-panel-title" }, ["Vista previa"]),
          h("div", { style: `max-width:${PREVIEW_W * 4}px;margin:0 auto` }, [
            preview.el,
          ]),
          idleNote,
          verdict,
          checks,
        ]),
      ]),
    ],
  );
}
