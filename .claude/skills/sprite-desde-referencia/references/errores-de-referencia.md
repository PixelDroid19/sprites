# Errores típicos de una hoja generada

Revisa **cada** figura contra esta tabla. Corrige con una regla en
`character.ts` que se pueda aplicar a otras figuras.

| Error                                          | Cómo se ve                                     | Corrección                                                             |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Etiqueta de dirección falsa                    | "Izquierda" mira a la derecha                  | Anota `faces` real; usa la figura correcta o el espejo de otra         |
| Falta una dirección                            | la de arriba-izquierda mira al frente          | Espejo de la simétrica (`flip`)                                        |
| Mezcla gris/marrón bajo los ojos               | parece un golpe                                | Franja bajo el ojo a piel + rubor simétrico (`cleanUnderEyes`)         |
| Gris al pie del ojo                            | parece una lágrima                             | `dryEyes`                                                              |
| Parte anatómica en sitio distinto entre vistas | la cola sale de un lado en la vista de espalda | Recolocar en capa propia desde el anclaje correcto (`tailFromBack`)    |
| Personaje pegado a otro                        | el gatito pintado en la cabeza                 | Borrarlo, rehacer lo que tapaba y dibujarlo aparte (`removeKitten`)    |
| Parte tapada por otro personaje                | falta una oreja al quitar el gatito            | Espejo de la simétrica (`mirrorEar`) o sello a mano                    |
| Antenas, pelos de 1-3 px, islas                | restos al borrar                               | `smoothCrown`, `dropIslands`, `pruneDanglingOutline`                   |
| Rasgo pequeño deformado                        | orejas con rosa enorme, bordes rotos           | Borrar y estampar un sello a mano (`drawEars`, ver `rasgos-a-mano.md`) |
| Silueta cortada                                | tramos rectos o escalones junto a un rasgo     | Rehacer la silueta como **una** curva (cúpula) y poner el rasgo encima |
| Costura interior                               | contorno de la oreja dentro del pelo           | Bajo la superficie del pelo, el sello solo pinta relleno, no contorno  |

## Antipatrones (aprendidos a golpes)

- **Parchear sobre parche.** Si una corrección necesita otra para tapar lo
  que rompe, la base es mala: borra y rehaz desde cero.
- **Borrar franjas rectas** "para despejar" un rasgo: deja cortes. Borra
  por encima de una curva, nunca por columnas o filas fijas.
- **Suavizar después de dibujar el rasgo** sin protegerlo: `smoothCrown` se
  come puntas de oreja. Protege el rango o dibuja el rasgo al final.
- **Ubicar un rasgo donde la extracción vio su color** (rosa → oreja): la
  extracción desborda. Ubícalo por anatomía (esquina de la cabeza) y usa el
  color de la hoja solo para borrar.
