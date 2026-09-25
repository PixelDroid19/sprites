// Lienzos lógicos independientes del DOM: la misma lógica pinta en el
// navegador y en Node (los scripts inyectan createCanvas de @napi-rs/canvas).

// Subconjunto de CanvasRenderingContext2D que se usa; lo cumplen tanto el
// contexto del navegador como el de @napi-rs/canvas.
export interface Ctx {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: unknown, dx: number, dy: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
}

export interface Surface {
  width: number;
  height: number;
  getContext(id: "2d"): Ctx | null;
}

type SurfaceFactory = (w: number, h: number) => Surface;

let surfaceFactory: SurfaceFactory = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas as unknown as Surface;
};

export function setSurfaceFactory(factory: SurfaceFactory) {
  surfaceFactory = factory;
}

export function createSurface(w: number, h: number): Surface {
  return surfaceFactory(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
}
