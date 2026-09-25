---
name: sprite-desde-referencia
description: Convierte una hoja de personaje "estilo pixel art" (imagen generada o pintada, con rejilla irregular) en sprites profesionales pintados píxel a píxel en Canvas 2D, corrige los errores de la hoja, redibuja a mano los rasgos pequeños (orejas, ojos, mascotas) y anima por partes con anclajes. Úsala para dibujar, extraer o copiar un personaje o sprite desde una imagen de referencia, añadir un personaje nuevo, separar un personaje pegado a otro (mascota en la cabeza, arma, montura), pulir sprites (orejas, pelo, caras, siluetas cortadas) o animarlos (caminar, respirar, parpadear, cola, saltos).
---

# Sprite desde referencia

Método probado con la Niña Gatita (`src/nina-gatita/`). Las fases van en
orden y cada una tiene una **puerta**: no pases a la siguiente sin
cumplirla. Los detalles están en `references/`; cárgalos cuando llegues a
la fase que los cita.

| Fase                   | Qué produce                         | Puerta                                               |
| ---------------------- | ----------------------------------- | ---------------------------------------------------- |
| 0. Medir               | cajas, tamaño de celda, expectativa | el usuario sabe que será "muy parecido", no idéntico |
| 1. Paleta              | colores por función                 | ningún tono es solo antialiasado                     |
| 2. Extraer             | rejillas por figura                 | ΔE medio ≤ 8, una pieza, contorno cerrado            |
| 3. Corregir            | rejillas limpias                    | checklist de errores revisado figura a figura        |
| 3b. Redibujar rasgos   | sellos a mano (orejas, ojos…)       | comparado celda a celda con la hoja ampliada         |
| 4. Anclajes            | rig por figura                      | modo "Anclajes" y tests                              |
| 5. Capas y secundarios | orden de pintado, asientos          | 8 direcciones capturadas sin choques                 |
| 6. Animación           | poses y líneas de tiempo            | 6-12 fps de pose, contorno cerrado en toda pose      |
| 7. Verificar           | tests, build, capturas              | `references/checklist.md` completo                   |

## 0. Medir antes de prometer

Una imagen "pixel art" generada **no tiene píxeles exactos**: los bloques
miden 4-5 px de pantalla, no encajan en una rejilla fija y llevan
antialiasado. Localiza las figuras y mide:

```bash
npx tsx scripts/find-boxes.ts hoja.png "[r,g,b del panel]" [área mínima]
npx tsx .claude/skills/sprite-desde-referencia/scripts/reference-zoom.ts out.png
```

Desconfía de lo que la hoja dice de sí misma (tamaño, paleta de ejemplo,
etiquetas de dirección). Nunca pintes el personaje con `drawImage` de la
referencia: la hoja solo se muestra al lado para comparar.

## 1. Paleta por función

`npx tsx scripts/derive-palette.ts hoja.png "[x0,y0,x1,y1];[...]" 24`, luego
nombra y agrupa a mano. Reglas en `references/paleta.md`.

## 2. Extraer la rejilla

Copia `scripts/extract-nina-gatita.ts` y cambia `CELLS`, la paleta y las
rutas; el algoritmo (bordes en Lab, cortes por programación dinámica,
mediana por celda) no se toca. `EXTRACT_DEBUG=1` vuelca los cortes.

## 3. Corregir errores de la hoja (no copiarlos)

Cada corrección es una **regla en código** (`character.ts`), nunca un
retoque de píxeles sueltos. Tabla de errores, síntomas y arreglos:
`references/errores-de-referencia.md`. Si una vista contradice a las
demás, las demás mandan.

## 3b. Redibujar a mano lo que la extracción rompe

Todo rasgo más pequeño que 2-3 celdas en la hoja (orejas, ojos, boca,
bigotes, una mascota entera) sale roto. No se parchea: se **borra y se
estampa un sello dibujado a mano** calcado celda a celda de la hoja
ampliada. Método, anatomía de las orejas y fallos a evitar:
`references/rasgos-a-mano.md`. Léelo antes de tocar orejas o caras.

## 4. Anclajes

Automáticos por color (cuello, cadera, piernas) y medidos a mano (ojos,
cola, asiento de un secundario). `rig.ts`, `kitten.ts`.

## 5. Capas y personajes secundarios

Un personaje encima de otro (gatito en la cabeza) necesita orden de
pintado explícito, asiento medido sobre la coronilla sin orejas y a veces
una capa que se repinta delante. `references/capas-y-secundarios.md`.

## 6. Poses y animación

Todo son desplazamientos enteros de regiones (`composeRows`): nada se rota
ni se escala. Tiempos, anticipación y arcos: `references/animacion.md`.

## 7. Verificar antes de entregar

```bash
npm test && npm run build
npx tsx scripts/compare-reference.ts cmp.png            # hoja vs JS, cabezas
npx tsx .claude/skills/sprite-desde-referencia/scripts/ascii.ts abajo 4 24
npx tsx .claude/skills/sprite-desde-referencia/scripts/palette-audit.ts
npx vite preview --port 4176 &   # y luego:
node .claude/skills/sprite-desde-referencia/scripts/capture-stage.cjs dirs.png
```

Mira **siempre** las imágenes ampliadas: un test verde no demuestra que se
vea bien. Recorre `references/checklist.md` antes de decir "hecho".
