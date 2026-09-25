export type Facing =
  | "abajo"
  | "abajo-izquierda"
  | "izquierda"
  | "arriba-izquierda"
  | "arriba"
  | "arriba-derecha"
  | "derecha"
  | "abajo-derecha";

// Una figura de la hoja de referencia ya pasada a la rejilla lógica.
export interface ReferenceSprite {
  // Texto que la hoja pone bajo la figura (puede no coincidir con `faces`).
  label: string;
  // Hacia dónde mira la figura de verdad.
  faces: Facing;
  // Caja en la hoja, en px de la imagen: [x0, y0, x1, y1].
  box: readonly number[];
  // Tamaño medio de celda detectado, en px de la imagen: [x, y].
  pitch: readonly number[];
  meanDeltaE: number;
  rows: readonly string[];
}
