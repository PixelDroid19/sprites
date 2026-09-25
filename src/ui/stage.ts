// Escenario jugable: la Niña Gatita camina en 8 direcciones y se acaricia.
import type { Ctx } from "../engine/surface";
import {
  KITTEN_JUMP_MS,
  PET_DURATION,
  jumpArc,
  sample,
  sampleKitten,
  type AnimState,
  type KittenState,
} from "../nina-gatita/animation";
import { KITTEN_DIRECTIONS } from "../nina-gatita/kitten";
import type { Pose } from "../nina-gatita/pose";
import {
  BUBBLE_H,
  BUBBLE_W,
  drawCharacter,
  drawFloor,
  drawHeartBubble,
  drawShadow,
  spriteOrigin,
  type ViewMode,
} from "../nina-gatita/render";
import {
  DIRECTIONS,
  RIGS,
  facingFromVector,
  type Box,
  type Rig,
} from "../nina-gatita/rig";
import { REFERENCE_SPRITES } from "../nina-gatita/sprites.generated";
import type { Facing } from "../nina-gatita/types";
import { h, prefersReducedMotion, toggleButton } from "./dom";
import { createPixelScreen } from "./pixel-screen";
import { referenceCrop, updateReferenceCrop } from "./reference-crop";

export const STAGE_W = 160;
export const STAGE_H = 136;
// Zona por la que puede andar el punto de apoyo (entre los pies): deja
// sitio arriba para la figura más alta (62 px) y su burbuja.
const WALK_AREA = { x0: 22, x1: 138, y0: 94, y1: 132 };
// Velocidad en px lógicos por segundo; la posición se redondea al pintar.
const SPEED = 40;
const SHADOW_RX = 11;
// Velocidad del gatito en el suelo (algo más rápido que la niña).
const KITTEN_SPEED = 46;
// Un "paso" manual en pausa avanza un fotograma de la caminata.
const STEP_MS = 125;

type Vec = readonly [number, number];

const KEY_DIRS: Record<string, Vec> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

const PAD: { vec: Vec; label: string; glyph: string }[] = [
  { vec: [-1, -1], label: "arriba-izquierda", glyph: "↖" },
  { vec: [0, -1], label: "arriba", glyph: "↑" },
  { vec: [1, -1], label: "arriba-derecha", glyph: "↗" },
  { vec: [-1, 0], label: "izquierda", glyph: "←" },
  { vec: [0, 0], label: "acariciar", glyph: "♥" },
  { vec: [1, 0], label: "derecha", glyph: "→" },
  { vec: [-1, 1], label: "abajo-izquierda", glyph: "↙" },
  { vec: [0, 1], label: "abajo", glyph: "↓" },
  { vec: [1, 1], label: "abajo-derecha", glyph: "↘" },
];

const MODES: { id: ViewMode; label: string }[] = [
  { id: "color", label: "Color" },
  { id: "silhouette", label: "Silueta" },
  { id: "grayscale", label: "Grises" },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

// Suma de teclas pulsadas (o la cruceta), limitada a -1..1 por eje.
function inputVector(pad: Vec | null, keys: Set<string>): Vec {
  if (pad) return pad;
  let dx = 0;
  let dy = 0;
  for (const k of keys) {
    const v = KEY_DIRS[k];
    if (v) {
      dx += v[0];
      dy += v[1];
    }
  }
  return [clamp(dx, -1, 1), clamp(dy, -1, 1)];
}

// Caja de anclaje en % del sprite (el contenedor ya está volteado si toca).
function anchorBox(b: Box, rig: Rig, kind: string) {
  return h("span", {
    className: "ng-anchor",
    "data-kind": kind,
    style: `left:${pct(b.x0, rig.width)};top:${pct(b.y0, rig.height)};width:${pct(b.x1 - b.x0 + 1, rig.width)};height:${pct(b.y1 - b.y0 + 1, rig.height)}`,
  });
}

function anchorLayer(rig: Rig): HTMLElement[] {
  return [
    ...rig.eyes.map((e) => anchorBox(e, rig, "eye")),
    anchorBox(rig.tail, rig, "tail"),
    anchorBox(rig.legs, rig, "legs"),
    h("span", {
      className: "ng-anchor-line",
      style: `left:0;right:0;top:${pct(rig.neckY, rig.height)}`,
    }),
    h("span", {
      className: "ng-anchor-line",
      style: `left:${pct(rig.legSplitX, rig.width)};width:1px;top:${pct(rig.hipY, rig.height)};height:${pct(rig.height - rig.hipY, rig.height)};border-top:0;border-left:1px dashed #d07a1e`,
    }),
  ];
}

export function createStage(): HTMLElement {
  const reduced = prefersReducedMotion();
  const view = { mode: "color" as ViewMode, slow: false, anchors: false };
  const sim = {
    x: 80,
    y: 116,
    facing: "abajo" as Facing,
    state: "idle" as AnimState,
    stateStart: 0,
    clock: 0,
    last: -1,
    keys: new Set<string>(),
    pad: null as Vec | null,
    hudText: "",
    shownSprite: "",
  };

  const hud = {
    state: h("dd"),
    facing: h("dd"),
    pose: h("dd"),
  };
  const refNote = h("p", { className: "ng-note" });
  const refCrop = referenceCrop("abajo", 150);
  const spriteBox = h("div", { style: "position:absolute" });
  const hit = h("button", {
    type: "button",
    className: "ng-hit",
    style: "inset:0",
    tabIndex: -1,
    "aria-label": "Acariciar a la Niña Gatita",
  });
  const anchors = h("div", { style: "position:absolute;inset:0" });
  spriteBox.append(hit, anchors);

  const pet = () => {
    sim.state = "pet";
    sim.stateStart = sim.clock;
    screen.redraw();
  };
  hit.addEventListener("click", pet);

  // Referencia y anclajes cambian solo al cambiar de figura.
  const syncSprite = () => {
    const dir = DIRECTIONS[sim.facing];
    const key = `${dir.sprite}|${dir.flip}|${view.anchors}`;
    if (key === sim.shownSprite) return;
    sim.shownSprite = key;
    const rig = RIGS[dir.sprite];
    anchors.replaceChildren(...(view.anchors ? anchorLayer(rig) : []));
    updateReferenceCrop(refCrop, dir.sprite, 150, dir.flip);
    refNote.textContent =
      `Figura «${REFERENCE_SPRITES[dir.sprite].label}» de la hoja${dir.flip ? ", en espejo" : ""}. ` +
      `Rejilla extraída: ${rig.width}×${rig.height} px lógicos.` +
      (dir.flip
        ? " La hoja no trae una vista válida de arriba-izquierda (la figura con esa etiqueta mira al frente), así que se refleja arriba-derecha."
        : "");
  };

  // Gatito: en la cabeza, saltando o en el suelo siguiendo a la niña.
  const kitten = {
    state: "head" as KittenState,
    start: 0,
    x: 0,
    y: 0,
    facing: "abajo" as Facing,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
  };
  const setKitten = (state: KittenState) => {
    kitten.state = state;
    kitten.start = sim.clock;
  };
  // Pide saltar: desde la cabeza al suelo, o desde el suelo a la cabeza.
  const toggleKitten = () => {
    if (kitten.state === "head") {
      kitten.from = { ...lastSeat };
      const side = sim.facing.includes("izquierda") ? 1 : -1;
      kitten.to = {
        x: clamp(sim.x + side * 18, WALK_AREA.x0, WALK_AREA.x1),
        y: clamp(sim.y + 2, WALK_AREA.y0, WALK_AREA.y1),
      };
      kitten.facing = side > 0 ? "derecha" : "izquierda";
      setKitten("jumpDown");
    } else if (kitten.state === "idle" || kitten.state === "walk") {
      kitten.from = { x: kitten.x, y: kitten.y };
      setKitten("jumpUp");
    }
    kittenBtn.textContent =
      kitten.state === "jumpDown" ? "Gatito: subir (G)" : "Gatito: bajar (G)";
  };
  let lastSeat = { x: 0, y: 0 };

  // Avanza al gatito y devuelve cómo pintarlo este fotograma.
  const stepKitten = (dt: number, seat: { x: number; y: number }) => {
    lastSeat = seat;
    const inState = sim.clock - kitten.start;
    if (kitten.state === "jumpDown" || kitten.state === "jumpUp") {
      const to = kitten.state === "jumpUp" ? seat : kitten.to;
      const s = sampleKitten(kitten.state, inState, sim.clock, reduced);
      const p = jumpArc(kitten.from, to, s.jump ?? 0);
      kitten.x = p.x;
      kitten.y = p.y;
      if (inState >= KITTEN_JUMP_MS)
        setKitten(kitten.state === "jumpUp" ? "head" : "idle");
      return kittenDraw(kitten.facing, s.pose, p.x, p.y);
    }
    if (kitten.state === "head") {
      kitten.x = seat.x;
      kitten.y = seat.y;
      kitten.facing = sim.facing;
      const s = sampleKitten("head", inState, sim.clock, reduced);
      return kittenDraw(sim.facing, s.pose, seat.x, seat.y);
    }
    // En el suelo: se queda a un lado de la niña, un poco detrás.
    const side = kitten.x < sim.x ? -1 : 1;
    const tx = clamp(sim.x + side * 18, WALK_AREA.x0, WALK_AREA.x1);
    const ty = clamp(sim.y - 3, WALK_AREA.y0, WALK_AREA.y1);
    const dx = tx - kitten.x;
    const dy = ty - kitten.y;
    const dist = Math.hypot(dx, dy);
    const walking = dist > (kitten.state === "walk" ? 2 : 8);
    if (walking !== (kitten.state === "walk"))
      setKitten(walking ? "walk" : "idle");
    if (walking) {
      const step = Math.min(dist, (KITTEN_SPEED * dt) / 1000);
      kitten.x += (dx / dist) * step;
      kitten.y += (dy / dist) * step;
      kitten.facing = facingFromVector(Math.round(dx), Math.round(dy)) ?? kitten.facing;
    } else {
      // Quieto, mira hacia la niña.
      kitten.facing = sim.x > kitten.x ? "derecha" : "izquierda";
    }
    const s = sampleKitten(kitten.state, sim.clock - kitten.start, sim.clock, reduced);
    return kittenDraw(kitten.facing, s.pose, kitten.x, kitten.y);
  };
  const kittenDraw = (facing: Facing, pose: Pose, kx: number, ky: number) => {
    const d = KITTEN_DIRECTIONS[facing];
    return {
      sprite: `gatito:${d.view}` as const,
      flip: d.flip,
      pose,
      x: Math.round(kx),
      y: Math.round(ky),
    };
  };

  const render = (ctx: Ctx, ms: number) => {
    const dt =
      sim.last < 0 ? 0 : clamp(ms - sim.last, 0, 100) * (view.slow ? 0.25 : 1);
    sim.last = ms;
    sim.clock += dt;

    // Máquina de estados: la caricia termina sola; andar y reposo dependen
    // de si hay entrada. Cada cambio reinicia el reloj del estado.
    const [vx, vy] = inputVector(sim.pad, sim.keys);
    const moving = vx !== 0 || vy !== 0;
    if (sim.state === "pet" && sim.clock - sim.stateStart >= PET_DURATION) {
      sim.state = "idle";
      sim.stateStart = sim.clock;
    }
    if (sim.state !== "pet" && moving !== (sim.state === "walk")) {
      sim.state = moving ? "walk" : "idle";
      sim.stateStart = sim.clock;
    }
    if (sim.state === "walk") {
      const len = Math.hypot(vx, vy);
      const d = (SPEED * dt) / 1000;
      sim.x = clamp(sim.x + (vx / len) * d, WALK_AREA.x0, WALK_AREA.x1);
      sim.y = clamp(sim.y + (vy / len) * d, WALK_AREA.y0, WALK_AREA.y1);
      sim.facing = facingFromVector(vx, vy) ?? sim.facing;
    }

    const anim = sample(
      sim.state,
      sim.clock - sim.stateStart,
      sim.clock,
      reduced,
    );
    const dir = DIRECTIONS[sim.facing];
    const rig = RIGS[dir.sprite];
    const x = Math.round(sim.x);
    const y = Math.round(sim.y);

    const origin = spriteOrigin({
      sprite: dir.sprite,
      flip: dir.flip,
      x,
      y,
      lift: anim.lift,
    });
    // Asiento del gatito en la coronilla: sigue a la cabeza cuando baja
    // (respiración, pasos) y hunde 2 px las patas en el pelo.
    const seatX = dir.flip ? rig.width - 1 - rig.seat.x : rig.seat.x;
    const seat = {
      x: origin.x + seatX,
      y:
        origin.y +
        rig.seat.y +
        2 +
        (anim.pose.bodyDrop ? 1 : 0) +
        (anim.pose.headDrop ? 1 : 0),
    };
    const k = stepKitten(dt, seat);

    drawFloor(ctx, STAGE_W, STAGE_H);
    const girl = () => {
      if (view.mode === "color") drawShadow(ctx, x, y - 1, SHADOW_RX);
      drawCharacter(ctx, {
        sprite: dir.sprite,
        flip: dir.flip,
        pose: anim.pose,
        x,
        y,
        lift: anim.lift,
        mode: view.mode,
      });
    };
    const kittenOnFloor = kitten.state === "idle" || kitten.state === "walk";
    const kittenDraw = () => {
      if (kittenOnFloor && view.mode === "color")
        drawShadow(ctx, Math.round(kitten.x), Math.round(kitten.y) - 1, 6, 2);
      drawCharacter(ctx, { ...k, mode: view.mode });
    };
    // Orden por profundidad: lo que está más abajo en pantalla va delante.
    if (kittenOnFloor && kitten.y < y) {
      kittenDraw();
      girl();
    } else {
      girl();
      kittenDraw();
    }
    if (anim.bubble) {
      // Arriba a la derecha de la cabeza, como en el panel "Detalle".
      const bx = clamp(origin.x + rig.width - 10, 1, STAGE_W - BUBBLE_W - 1);
      const by = clamp(
        origin.y + 14 - BUBBLE_H + anim.bubble.dy,
        1,
        STAGE_H - BUBBLE_H,
      );
      drawHeartBubble(ctx, bx, by);
    }

    // La capa HTML (clic para acariciar y anclajes) sigue al sprite.
    Object.assign(spriteBox.style, {
      left: pct(origin.x, STAGE_W),
      top: pct(origin.y, STAGE_H),
      width: pct(rig.width, STAGE_W),
      height: pct(rig.height, STAGE_H),
      transform: dir.flip ? "scaleX(-1)" : "",
    });
    syncSprite();

    // El HUD solo se toca cuando cambia el texto (a ritmo de pose).
    const p = anim.pose;
    const poseText =
      [
        p.headDrop && "cabeza -1",
        p.bodyDrop && "cuerpo -1",
        p.leg !== "none" && `pie ${p.leg === "left" ? "izq." : "der."} +1`,
        p.tail && `cola ${p.tail > 0 ? "+" : ""}${p.tail}`,
        p.eyes !== "open" &&
          `ojos ${p.eyes === "closed" ? "cerrados" : "felices"}`,
        anim.lift && `salto ${anim.lift}`,
      ]
        .filter(Boolean)
        .join(" · ") || "reposo";
    const stateText =
      sim.state === "pet" ? `caricia: ${anim.phase}` : anim.phase.toUpperCase();
    const text = `${stateText}|${sim.facing}|${poseText}`;
    if (text !== sim.hudText) {
      sim.hudText = text;
      hud.state.textContent = stateText;
      hud.facing.textContent = sim.facing;
      hud.pose.textContent = poseText;
    }
  };

  const screen = createPixelScreen({
    width: STAGE_W,
    height: STAGE_H,
    render,
    label: "La Niña Gatita en un suelo de baldosas",
    className: "ng-screen",
  });
  screen.overlay.append(spriteBox);

  // Teclado sobre el escenario enfocado.
  const keyOf = (e: KeyboardEvent) =>
    e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const wrap = h(
    "div",
    {
      className: "ng-screen-wrap",
      role: "group",
      tabIndex: 0,
      "aria-label":
        "Escenario: usa las flechas para caminar y espacio para acariciar",
    },
    [screen.el],
  );
  wrap.addEventListener("keydown", (e) => {
    const key = keyOf(e);
    if (KEY_DIRS[key]) {
      e.preventDefault();
      sim.keys.add(key);
    } else if (key === " " || key === "Enter") {
      e.preventDefault();
      pet();
    } else if (key === "g") {
      e.preventDefault();
      toggleKitten();
    }
  });
  wrap.addEventListener("keyup", (e) => sim.keys.delete(keyOf(e)));
  wrap.addEventListener("blur", () => sim.keys.clear());

  // Controles de vista.
  const modeButtons = MODES.map((m) => {
    const btn = h("button", { type: "button", className: "ng-btn" }, [m.label]);
    btn.setAttribute("aria-pressed", String(m.id === view.mode));
    btn.addEventListener("click", () => {
      view.mode = m.id;
      modeButtons.forEach((b, i) =>
        b.setAttribute("aria-pressed", String(MODES[i].id === m.id)),
      );
      screen.redraw();
    });
    return btn;
  });
  const gridBtn = toggleButton("Rejilla", false, (on) =>
    screen.overlay.classList.toggle("ng-grid", on),
  );
  const anchorBtn = toggleButton("Anclajes", false, (on) => {
    view.anchors = on;
    sim.shownSprite = "";
    syncSprite();
  });

  // Controles de tiempo.
  const stepBtn = h(
    "button",
    { type: "button", className: "ng-btn", disabled: true },
    [`Paso (+${STEP_MS} ms)`],
  );
  stepBtn.addEventListener("click", () => {
    sim.clock += STEP_MS;
    screen.redraw();
  });
  const pauseBtn = h("button", { type: "button", className: "ng-btn" }, [
    "Pausa",
  ]);
  let playing = true;
  pauseBtn.addEventListener("click", () => {
    playing = !playing;
    pauseBtn.textContent = playing ? "Pausa" : "Seguir";
    pauseBtn.setAttribute("aria-pressed", String(!playing));
    stepBtn.disabled = playing;
    screen.setPlaying(playing);
  });
  const slowBtn = toggleButton(
    "Cámara lenta ×¼",
    false,
    (on) => (view.slow = on),
  );
  const petBtn = h(
    "button",
    { type: "button", className: "ng-btn ng-btn-primary" },
    ["Acariciar"],
  );
  petBtn.addEventListener("click", pet);
  const kittenBtn = h("button", { type: "button", className: "ng-btn" }, [
    "Gatito: bajar (G)",
  ]);
  kittenBtn.addEventListener("click", toggleKitten);

  // Cruceta: mantener pulsado para caminar.
  const padButtons = PAD.map((b) => {
    const btn = h(
      "button",
      {
        type: "button",
        className: "ng-btn",
        "aria-label":
          b.label === "acariciar" ? "Acariciar" : `Caminar hacia ${b.label}`,
      },
      [b.glyph],
    );
    const release = () => {
      sim.pad = null;
      btn.dataset.active = "false";
    };
    btn.addEventListener("pointerdown", (e) => {
      if (b.vec[0] === 0 && b.vec[1] === 0) return pet();
      btn.setPointerCapture(e.pointerId);
      sim.pad = b.vec;
      btn.dataset.active = "true";
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    return btn;
  });

  return h(
    "section",
    { className: "ng", "aria-label": "Niña Gatita: escenario" },
    [
      h("p", { className: "ng-eyebrow" }, [
        `Canvas 2D · ${STAGE_W}×${STAGE_H} px lógicos`,
      ]),
      h("h2", { className: "ng-title" }, ["Pasea a la Niña Gatita"]),
      h("p", { className: "ng-intro" }, [
        "Haz clic en el escenario y muévela con las flechas o WASD (o con la cruceta). Espacio o clic sobre ella: caricia. Activa «Cámara lenta» para ver cada fotograma.",
      ]),
      h("div", { className: "ng-cols" }, [
        h("div", {}, [
          wrap,
          h("dl", { className: "ng-hud" }, [
            h("dt", {}, ["Estado"]),
            hud.state,
            h("dt", {}, ["Dirección"]),
            hud.facing,
            h("dt", {}, ["Pose"]),
            hud.pose,
          ]),
          h(
            "div",
            { className: "ng-buttons", role: "group", "aria-label": "Vista" },
            [...modeButtons, gridBtn, anchorBtn],
          ),
          h(
            "div",
            { className: "ng-buttons", role: "group", "aria-label": "Tiempo" },
            [pauseBtn, stepBtn, slowBtn, petBtn, kittenBtn],
          ),
        ]),
        h("div", {}, [
          h("div", { className: "ng-panel" }, [
            h("p", { className: "ng-panel-title" }, ["Cruceta"]),
            h("div", { className: "ng-pad" }, padButtons),
          ]),
          h("div", { className: "ng-panel", style: "margin-top:12px" }, [
            h("p", { className: "ng-panel-title" }, [
              "Referencia de esta dirección",
            ]),
            h("div", { style: "display:flex;justify-content:center" }, [
              refCrop,
            ]),
            refNote,
          ]),
        ]),
      ]),
    ],
  );
}
