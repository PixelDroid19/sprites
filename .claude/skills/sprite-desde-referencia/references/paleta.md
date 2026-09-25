# Paleta por función

- Nombra cada color por su **papel** (contorno, sombra 2, sombra 1, base,
  luz, brillo) y agrúpalo por **material** (pelo, piel, ropa…). Una letra
  por color en las rejillas.
- Rampa típica de un material: 4-6 tonos. Más de 6 suele ser antialiasado
  de la hoja: fusiónalo con el vecino más cercano en Lab.
- Contorno casi negro y cálido (`#2a1a1a`-ish), nunca `#000`. Un segundo
  contorno más claro (K) para bordes interiores.
- La luz viene de arriba-izquierda: el lado izquierdo de cada volumen usa la
  base/luz, el derecho la sombra.
- Rosa (interior de orejas, rubor) es un color de **acento**: si en una
  cabeza supera ~8 % de los píxeles de la coronilla (hasta los ojos), se lee como
  mancha. `scripts/palette-audit.ts` lo mide.
- Un secundario (mascota) con su propia rampa se extrae con la paleta
  restringida (`allowed`) para que no robe tonos del principal.
