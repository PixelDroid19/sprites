// Lienzo de pixel art con escalado entero: se pinta a resolución lógica en
// un buffer y se vuelca al canvas visible con vecino más cercano.
import { createSurface, type Ctx, type Surface } from "../engine/surface";
import { h } from "./dom";

export interface PixelScreenOptions {
  // Resolución lógica de la escena.
  width: number;
  height: number;
  // Pinta un fotograma sobre el buffer lógico; ms es el tiempo reproducido.
  render: (ctx: Ctx, ms: number) => void;
  label: string;
  className?: string;
  playing?: boolean;
}

export interface PixelScreen {
  // Contenedor exterior (define el ancho disponible).
  el: HTMLElement;
  // Capa HTML del mismo tamaño que el canvas, para zonas clicables.
  overlay: HTMLElement;
  setPlaying(playing: boolean): void;
  setRender(render: PixelScreenOptions["render"]): void;
  // Repinta el fotograma actual (útil en pausa).
  redraw(): void;
  destroy(): void;
}

export function createPixelScreen(opts: PixelScreenOptions): PixelScreen {
  const { width, height, label } = opts;
  let render = opts.render;
  const canvas = h("canvas", {
    width,
    height,
    role: "img",
    "aria-label": label,
    style: "image-rendering: pixelated; display: block; margin: 0 auto;",
  }) as HTMLCanvasElement;
  const overlay = h("div", { className: "ng-overlay" });
  const inner = h("div", { style: "position: relative; margin: 0 auto;" }, [
    canvas,
    overlay,
  ]);
  const el = h("div", { className: opts.className ?? "" }, [inner]);
  const surface: Surface = createSurface(width, height);
  const ctx = surface.getContext("2d")!;

  const state = {
    ms: 0,
    base: 0,
    runStart: 0,
    running: false,
    playing: opts.playing ?? true,
    visible: true,
    raf: 0,
  };

  const drawFrame = (ms: number) => {
    ctx.clearRect(0, 0, width, height);
    render(ctx, ms);
    const view = canvas.getContext("2d");
    if (!view) return;
    view.imageSmoothingEnabled = false;
    view.clearRect(0, 0, canvas.width, canvas.height);
    view.drawImage(
      surface as unknown as CanvasImageSource,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  // k píxeles de dispositivo por píxel lógico; si no cabe ni uno entero,
  // el canvas ocupa el 100% del ancho.
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = el.clientWidth || width;
    const k = Math.floor((cssWidth * dpr) / width);
    if (k >= 1) {
      canvas.width = width * k;
      canvas.height = height * k;
      canvas.style.width = `${(width * k) / dpr}px`;
      canvas.style.height = `${(height * k) / dpr}px`;
      inner.style.width = canvas.style.width;
      el.style.setProperty("--px", String(k / dpr));
    } else {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      inner.style.width = "100%";
      el.style.setProperty("--px", String(cssWidth / width));
    }
  };

  // El rAF solo corre reproduciendo y en pantalla; el tiempo acumulado no
  // salta al pausar y reanudar.
  const tick = (now: number) => {
    state.ms = Math.max(0, state.base + (now - state.runStart));
    drawFrame(state.ms);
    state.raf = requestAnimationFrame(tick);
  };
  const syncLoop = () => {
    const shouldRun = state.playing && state.visible;
    if (shouldRun && !state.running) {
      state.running = true;
      state.runStart = performance.now();
      state.raf = requestAnimationFrame(tick);
    } else if (!shouldRun && state.running) {
      state.running = false;
      cancelAnimationFrame(state.raf);
      state.base = state.ms;
    }
  };

  const ro = new ResizeObserver(() => {
    fit();
    drawFrame(state.ms);
  });
  ro.observe(el);
  const io = new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    syncLoop();
  });
  io.observe(el);
  queueMicrotask(() => {
    fit();
    drawFrame(state.ms);
    syncLoop();
  });

  return {
    el,
    overlay,
    setPlaying(playing) {
      state.playing = playing;
      syncLoop();
      if (!playing) drawFrame(state.ms);
    },
    setRender(next) {
      render = next;
      if (!state.running) drawFrame(state.ms);
    },
    redraw: () => drawFrame(state.ms),
    destroy() {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(state.raf);
    },
  };
}
