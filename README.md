# Sprites · La Niña Gatita

Personaje en pixel art pintado **píxel a píxel en Canvas 2D** a partir de su
hoja de referencia, con toda la animación hecha en JavaScript.

- **Hoja**: las 9 figuras de la referencia junto a su versión en JS, con la
  paleta de 24 colores agrupada por función.
- **Escenario**: camina en 8 direcciones (flechas, WASD o cruceta) y se
  acaricia (clic o espacio). Modos de silueta, grises, rejilla y anclajes;
  pausa, paso a paso y cámara lenta.
- **Reto**: dibujar el fotograma de parpadeo, con validación estructural,
  pistas progresivas y solución.

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # tests de sprites, poses, animación y reto
npm run build      # typecheck + build estático en dist/
npm run extract    # regenera src/nina-gatita/sprites.generated.ts
```

El build usa rutas relativas, así que `dist/` se puede publicar tal cual,
también en una subcarpeta (por ejemplo GitHub Pages).

## De la imagen a la rejilla

La hoja (`public/referencia/nina-gatita-referencia.webp`) **no es pixel art
real**: anuncia «16x32 px», pero cada figura está hecha de bloques de 4-5 px
de pantalla, y la rejilla no es uniforme (la celda va de 4,13 a 4,78 px). No
hay píxeles exactos que copiar, así que `scripts/extract-nina-gatita.ts`:

1. Mide la fuerza de borde entre columnas y entre filas.
2. Elige los cortes de la rejilla con programación dinámica (saltos de 4-5 px
   sobre los bordes más fuertes).
3. Toma de cada celda el píxel real más cercano a la mediana de su interior
   y lo cuantiza a la paleta (distancia en Lab).
4. Quita la sombra del suelo (se pinta por código) y las motas sueltas.
5. Aplica correcciones manuales documentadas en `FIXES` donde la hoja pinta
   detalle más pequeño que su propia celda (pupilas del gatito, brillos).
6. Cierra el contorno de la silueta.

Cada sprite guarda su **ΔE medio** frente a los píxeles originales: 5,5-8,2.
Es muy parecido a simple vista, pero no idéntico, porque la hoja tiene
antialiasado y degradados dentro de cada «píxel».

Otros problemas de la hoja: la muestra «Paleta (ejemplo)» tiene 11 colores
(dos naranjas casi iguales) y los sprites usan 24. Además, la figura
«Izquierda» de la fila 1 mira a la derecha y la «Arriba-Izquierda» mira al
frente, así que para caminar hacia arriba-izquierda se refleja
«Arriba-Derecha».

## Animación

La hoja solo trae vistas estáticas. Cada figura tiene anclajes (`rig.ts`):
cuello, cadera, piernas, ojos, cola y cola del gatito. `composeFrame`
(`pose.ts`) compone cada pose moviendo regiones enteras de la rejilla con
desplazamientos enteros, sin rotar ni escalar nada:

- Respiración: la cabeza baja 1 px.
- Paso a 8 fps: el cuerpo baja 1 px en el contacto y un pie sube 1 px.
- La cola se cizalla por columnas y la del gatito por filas.
- Ojos cerrados y felices.
- Caricia: anticipación → acción → impacto → recuperación, con la burbuja
  de corazón extraída del panel «Detalle (Zoom)».

El bucle corre a 60 Hz, pero la pose cambia a ritmo de pixel art (5-8 fps).
Los tests comprueban que en todas las poses de las 9 figuras la silueta
sigue siendo una sola pieza, con el contorno cerrado y solo colores de la
paleta.

## Estructura

```
src/
  engine/surface.ts        lienzos lógicos (navegador y Node)
  nina-gatita/
    palette.ts             24 colores por función
    sprites.generated.ts   rejillas extraídas (generado)
    rig.ts                 anclajes y direcciones
    pose.ts                composición de fotogramas
    animation.ts           líneas de tiempo (reposo, paso, caricia)
    render.ts              pintado y caché de fotogramas
    blink-exercise.ts      reglas del reto
    nina-gatita.test.ts
  ui/                      DOM sin framework: hoja, escenario, reto
scripts/extract-nina-gatita.ts
```
