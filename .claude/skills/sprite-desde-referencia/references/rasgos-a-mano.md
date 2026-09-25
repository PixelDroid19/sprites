# Rasgos redibujados a mano (sellos)

## Cuándo

Si en la hoja un rasgo mide menos de 2-3 celdas o su forma depende de
píxeles sub-celda (puntas, pupilas, bocas, bigotes), la extracción lo
rompe. Señales: rosa o blanco desbordado, puntas romas, formas distintas
entre vistas que deberían ser iguales.

## Método

1. **Amplía la hoja** (`scripts/reference-zoom.ts`) y **vuelca la rejilla
   extraída sin corregir** (`REFERENCE_SPRITES[id].rows`): la extracción da
   la posición y el tamaño aproximados en celdas aunque la forma salga mal.
2. Dibuja el sello de **un** lado como `string[]` con las letras de la
   paleta; el otro lado es `mirror()`. Mismo sello en todas las vistas del
   mismo tipo (frente, espalda, perfil).
3. **Limpia** el rasgo viejo por color dentro de su caja (rosa → pelo).
4. Rehaz la **silueta base** (cúpula lisa) y estampa encima.
5. Regla de estampado: por encima de la superficie del pelo se pinta el
   sello entero; por debajo, solo el acento (rosa) y el borde exterior. Así
   no hay costuras y se conserva la textura de la hoja.
6. Compara con la hoja celda a celda (`scripts/ascii.ts` junto a la
   rejilla de la hoja) y a escala real.

## Anatomía de las orejas de gata (medida en la hoja)

- La oreja **es la esquina superior de la cabeza**, no un triángulo posado
  encima: su borde exterior continúa el lateral del pelo (k-h-H).
- La punta asoma **2 filas** por encima de la coronilla, en la esquina
  exterior. El borde interior baja en diagonal y se funde con la cúpula.
- El rosa es una **cuña estrecha** (2-3 px de ancho, ~7 filas) que empieza
  2 filas bajo la punta, a 3 px del borde exterior, y baja **dentro** del
  pelo. Luz arriba (`p`), sombra abajo (`P`). Nunca un bloque.
- De espaldas: misma silueta, sin rosa (dorso de pelo).
- De perfil: **una** oreja, en la nuca (lado contrario a la cara), con el
  rosa hacia la cara.
- Sello actual: `EAR_CORNER`, `EAR_BACK`, `EAR_PROFILE` en `character.ts`.

## Fallos que ya pasaron (no repetir)

| Intento                                   | Resultado                         |
| ----------------------------------------- | --------------------------------- |
| Afilar la oreja extraída                  | rosa enorme, puntas rotas         |
| Triángulo alto posado sobre la cabeza     | "orejas de antena", muy rosas     |
| Borrar 4 px a cada lado de la oreja       | pelo cortado en recto             |
| Oreja de perfil en el centro de la cabeza | el gatito la tapa por completo    |
| Sello sin regla de superficie             | contorno de oreja dentro del pelo |
