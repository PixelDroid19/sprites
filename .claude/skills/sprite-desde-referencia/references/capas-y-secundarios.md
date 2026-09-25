# Capas y personajes secundarios

## Orden de pintado

1. Suelo y sombras.
2. Por profundidad (y en pantalla): lo más bajo va delante.
3. Secundario **en** el principal (gatito en la cabeza): principal →
   secundario → **capa de rasgos que quedan delante** (orejas). Así el
   gatito queda recostado _entre_ las orejas, como en la hoja.

La capa delantera (`rig.earLayer`) son los píxeles del rasgo que asoman por
encima de la coronilla. Se pinta filtrando el fotograma ya compuesto (así
sigue a la cabeza al respirar o caminar) y se cachea como una superficie
más. Solo se pinta mientras el secundario está en la cabeza.

## Asiento

- Mídelo sobre la coronilla **sin rasgos** (la cúpula antes de estampar
  orejas), no sobre la figura final: si no, el secundario se sienta en la
  punta de una oreja.
- Hunde 2 px las patas en el pelo; si la base del secundario es redonda
  (barbilla), hunde más en esa vista (`SEAT_SINK`) o parecerá flotar.
- De perfil, el secundario ocupa casi todo el ancho de la cabeza: córrelo
  unos px hacia la cara para que el rasgo de la nuca quede a la vista.

## Comprobación

Captura las 8 direcciones del escenario con el secundario en la cabeza
(`scripts/capture-stage.cjs`) y mira: ¿se ven las dos orejas (o la de la
nuca)? ¿Hay píxeles del rasgo sobre el cuerpo del secundario? ¿Flota?
