# Checklist antes de entregar

## Automático

- [ ] `npm test`: paleta, una sola pieza, contorno cerrado en **todas** las
      poses de **todas** las figuras, anclajes, líneas de tiempo.
- [ ] `npm run build` sin errores.
- [ ] `palette-audit.ts`: sin colores fuera de paleta; rosa en la coronilla ≤ 8 % (la hoja ronda el 6-7 %).
- [ ] Chromium (Playwright): sin errores de consola; el lienzo solo tiene
      colores de paleta + escena; sin scroll horizontal en móvil.

## Visual (con las imágenes ampliadas delante)

- [ ] `compare-reference.ts`: cada cabeza junto a su recorte de la hoja.
- [ ] Silueta continua: sin tramos rectos, escalones ni píxeles sueltos.
- [ ] Rasgos iguales entre vistas del mismo tipo (sello compartido).
- [ ] Acentos (rosa, brillos) pequeños y en su sitio.
- [ ] 8 direcciones en el escenario con el secundario encima: sin choques,
      sin flotar, rasgos visibles.
- [ ] A escala 1x también se lee (lo que funciona a 12x puede no leerse).

## Entrega

- [ ] Di qué es fiel a la hoja y qué es corrección tuya, y qué limitaciones
      quedan (p. ej. "ΔE medio 6: muy parecido, no idéntico").
