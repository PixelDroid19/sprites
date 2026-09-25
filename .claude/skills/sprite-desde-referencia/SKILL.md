---
name: sprite-desde-referencia
description: Convierte una hoja de personaje "estilo pixel art" (imagen generada o pintada, con rejilla irregular) en sprites reales pintados píxel a píxel en Canvas 2D, corrige los errores de la referencia y los anima por partes con anclajes. Úsala cuando pidan dibujar/extraer/copiar un personaje o sprite desde una imagen de referencia, añadir un personaje nuevo a este proyecto, separar un personaje que va pegado a otro (mascota en la cabeza, arma, montura), o pulir/animar sprites extraídos (caminar, respirar, parpadear, cola, saltos).
---

# Sprite desde referencia

Método probado con la Niña Gatita (`src/nina-gatita/`). Sigue las fases en
orden; cada una tiene una comprobación antes de pasar a la siguiente.

## 0. Medir antes de prometer

Una imagen "pixel art" generada **no tiene píxeles exactos**: los bloques
miden 4-5 px de pantalla, no encajan en una rejilla fija y llevan
antialiasado dentro. Antes de nada:

- Localiza las figuras: `npx tsx scripts/find-boxes.ts hoja.png [r,g,b del panel] [área mínima]`.
- Desconfía de lo que la hoja dice de sí misma (tamaño "16x32", paleta de
  ejemplo, etiquetas de dirección). Mídelo.
- Dilo al usuario: el resultado será _muy parecido_ (ΔE medio 5-8 por celda),
  no idéntico. Nunca pintes el personaje con `drawImage` de la referencia:
  la referencia solo se muestra al lado para comparar.

## 1. Paleta por función

`npx tsx scripts/derive-palette.ts hoja.png "[x0,y0,x1,y1];[...]" 24`

Nombra cada color por su papel (contorno, sombra 2, sombra 1, base, luz,
brillo) y agrúpalo por material (`src/nina-gatita/palette.ts`). Fusiona los
tonos que solo son antialiasado. Contorno casi negro cálido, nunca `#000`.

## 2. Extraer la rejilla

Copia `scripts/extract-nina-gatita.ts` y cambia `CELLS`, la paleta y las
rutas. El algoritmo no se toca:

1. Fuerza de borde entre columnas y filas (Lab, con tope).
2. Cortes por programación dinámica: saltos de 4-5 px (3 y 6 penalizados)
   sobre los bordes más fuertes. Ajusta los saltos si la hoja usa otro tamaño
   de bloque (mide el periodo primero).
3. Por celda: el píxel real más cercano a la mediana de su interior (sin el
   borde de 1 px), cuantizado a la paleta.
4. Quita la sombra del suelo (inundación desde el fondo), las motas y cierra
   el contorno.
5. `FIXES` solo donde la hoja pinta detalle más pequeño que su celda
   (pupilas, brillos). Revisa cada uno celda a celda con `EXTRACT_DEBUG`.

Comprobación: render de referencia y extracción lado a lado; ΔE en el
fichero generado; test de "una sola pieza" y "contorno cerrado".

## 3. Corregir los errores de la referencia (no copiarlos)

Revisa esta lista en **cada** figura y corrige con reglas en código
(`src/nina-gatita/character.ts`), no retocando píxeles sueltos a mano:

| Error típico                                   | Cómo se ve                                     | Corrección                                                                           |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Etiqueta de dirección falsa                    | "Izquierda" mira a la derecha                  | Anota `faces` real; usa la figura correcta o el espejo de otra                       |
| Falta una dirección                            | la de arriba-izquierda mira al frente          | Espejo de la simétrica (`flip`)                                                      |
| Mezcla gris/marrón bajo los ojos               | parece un golpe                                | Franja bajo el ojo a piel + rubor simétrico (`cleanUnderEyes`)                       |
| Parte anatómica en sitio distinto entre vistas | la cola sale de un lado en la vista de espalda | Recolocar en capa propia desde el anclaje correcto (`tailFromBack`)                  |
| Personaje pegado a otro                        | el gatito pintado en la cabeza                 | Borrarlo, rehacer lo que tapaba (`removeKitten`: cúpula de pelo) y extraerlo aparte  |
| Antenas, pelos de 1-3 px, islas                | restos al borrar                               | `smoothCrown` (sin tocar orejas: tienen rosa), `dropIslands`, `pruneDanglingOutline` |
| Gris al pie del ojo                            | parece una lágrima                             | `dryEyes`                                                                            |
| Parte tapada por otro personaje                | falta una oreja al quitar el gatito            | Espejo de la simétrica (`mirrorEar`)                                                 |

Regla: si una vista contradice a las demás, las demás mandan. Si la hoja
tiene un panel aparte del personaje secundario (p. ej. "Gatito (solo)"),
extrae de ahí; recolorea a su rampa los tonos ajenos que traiga mezclados.

## 3b. Cuándo dibujar a mano en vez de extraer

Si en la referencia los rasgos importantes (ojos, boca, bigotes, nariz)
miden menos que una celda, la extracción los rompe: ojos en barra, boca de
1 px, bigotes perdidos. No se arreglan con `FIXES` sueltos: se **redibuja
el personaje a mano sobre la rejilla** siguiendo la referencia
(`kitten-art.ts`):

1. Diseña primero la vista de frente con la mitad izquierda y refléjala
   (simetría perfecta); luego ajusta la luz (arriba-izquierda).
2. Rasgos como grupos intencionados: ojos 2x2, rubor de 2 px, hocico crema
   con boca en "ω", bigotes de 2 px pegados al contorno.
3. Todas las vistas miran a un lado; las del otro son su espejo.
4. Misma cabeza (mismas filas) en todas las poses del personaje; las poses
   se derivan: "tumbado" = cabeza + las 3 filas de abajo del cuerpo.
5. Compara siempre con la referencia ampliada al lado y con el conjunto a
   escala real: lo que se ve bien a 12x puede no leerse a 1x.

## 4. Anclajes

Por figura (`rig.ts`, `kitten.ts`):

- **Automáticos por color**: cuello (primera fila del torso), cadera (bajo
  la última fila de falda/pelvis), ancho y separación de piernas (filas del
  suelo, fuera de la cola).
- **Medidos a mano**: ojos (la caja cubre el ojo entero, contorno y gris
  incluidos, o al cerrarlo quedan restos), cola con su lado de raíz
  (`left`/`right` → cizalla por columnas; `bottom` → por filas), asiento de
  un personaje secundario.

Comprobación: modo "Anclajes" del escenario y tests de cajas dentro de la
figura.

## 5. Poses y animación

Todo son **desplazamientos enteros de regiones** (`composeRows` en
`pose.ts`): nada se rota ni se escala.

- Una región que **baja** tapa la fila de debajo y no deja huecos; por eso
  respirar y pisar bajan el cuerpo en vez de subirlo.
- Tras mover, `closeOutline`: el relleno que queda al borde pasa a contorno.
- Movimiento secundario: cabeza y cola llegan un fotograma tarde (paso de 8
  fotogramas a 12 fps en `animation.ts`). Asentado al parar. Periodos
  distintos para respirar, cola y parpadeo.
- Estados con anticipación → acción → impacto → recuperación (caricia,
  salto del gatito). Saltos en arco con `jumpArc`, redondeado al pintar.
- El bucle va a 60 Hz; la pose cambia a 5-12 fps.

## 6. Verificar antes de entregar

- `npm test`: paleta, una sola pieza, contorno cerrado en **todas** las
  poses de **todas** las figuras, anclajes, líneas de tiempo, correcciones.
- `npm run build` y prueba en Chromium con Playwright: sin errores de
  consola, el lienzo solo contiene colores de la paleta (+ escena), sin
  scroll horizontal en móvil.
- Mira las capturas ampliadas de cada figura y de cada pose nueva. Un test
  verde no demuestra que se vea bien.
