// Paleta indexada de la Niña Gatita. Cada carácter de los sprites es un
// color; "." es transparente. Los valores salen de agrupar (k-means en Lab)
// los colores reales de las celdas de la hoja de referencia, no de la
// muestra "Paleta (ejemplo)" de la hoja: esa muestra tiene 11 colores (dos
// naranjas casi idénticos) y los sprites usan bastantes más.

export type PaletteGroup =
  | "contorno"
  | "pelo"
  | "ojos"
  | "piel"
  | "jersey"
  | "falda"
  | "blancos"
  | "gatito";

export interface PaletteEntry {
  hex: string;
  group: PaletteGroup;
  role: string;
}

export const PALETTE = {
  // Contorno: casi negro cálido, nunca #000.
  k: { hex: "#0d0503", group: "contorno", role: "contorno" },
  K: {
    hex: "#220b08",
    group: "contorno",
    role: "contorno cálido / grieta del pelo",
  },

  // Pelo y cola, de sombra a brillo (luz desde arriba).
  d: { hex: "#3b1915", group: "pelo", role: "sombra profunda" },
  D: { hex: "#512522", group: "pelo", role: "sombra 2" },
  h: { hex: "#612c23", group: "pelo", role: "sombra 1" },
  H: { hex: "#723426", group: "pelo", role: "medio" },
  B: { hex: "#843e2a", group: "pelo", role: "base" },
  L: { hex: "#b45e3f", group: "pelo", role: "brillo" },

  // Ojos.
  i: { hex: "#4c1713", group: "ojos", role: "iris oscuro / línea roja" },
  e: { hex: "#8b6861", group: "ojos", role: "iris claro" },

  // Piel.
  S: { hex: "#e89279", group: "piel", role: "sombra" },
  P: { hex: "#fac1b5", group: "piel", role: "rubor / oreja clara" },
  s: { hex: "#fddcbf", group: "piel", role: "base" },

  // Jersey rojo; el rosa claro también es el interior de las orejas.
  R: { hex: "#af2847", group: "jersey", role: "sombra" },
  r: { hex: "#f14260", group: "jersey", role: "base" },
  p: { hex: "#ef7284", group: "jersey", role: "luz / interior de oreja" },

  // Falda.
  g: { hex: "#423d41", group: "falda", role: "base" },

  // Blancos: calcetines, zapatillas y brillos de los ojos.
  w: { hex: "#f3e9e5", group: "blancos", role: "blanco" },
  G: {
    hex: "#baac9e",
    group: "blancos",
    role: "gris (esclerótica, sombra del blanco)",
  },

  // Gatito naranja, de sombra a brillo.
  o: { hex: "#f28c4b", group: "gatito", role: "sombra" },
  O: { hex: "#f5a554", group: "gatito", role: "medio" },
  y: { hex: "#fec559", group: "gatito", role: "base" },
  Y: { hex: "#f9ce72", group: "gatito", role: "luz" },
  c: { hex: "#fbdb94", group: "gatito", role: "brillo" },
} as const satisfies Record<string, PaletteEntry>;

export type PaletteKey = keyof typeof PALETTE;

export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[];

export const isPaletteKey = (ch: string): ch is PaletteKey => ch in PALETTE;

// Colores de escena que no pertenecen al personaje: suelo y su sombra.
export const SCENE = {
  floor: "#e9dccb",
  floorDot: "#dccbb6",
  floorLine: "#cdb9a2",
  shadow: "#baac9e",
} as const;
