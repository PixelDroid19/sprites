import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { PALETTE } from "../src/nina-gatita/palette";
import { GIRL, SPRITE_IDS } from "../src/nina-gatita/rig";
import { REFERENCE_SPRITES } from "../src/nina-gatita/sprites.generated";
(async () => {
  const ref = await loadImage("public/referencia/nina-gatita-referencia.webp");
  const S = 7,
    CW = 46,
    RH = 26;
  const cv = createCanvas(CW * S * SPRITE_IDS.length, RH * S * 2 + 10);
  const c = cv.getContext("2d");
  c.fillStyle = "#e9dccb";
  c.fillRect(0, 0, cv.width, cv.height);
  SPRITE_IDS.forEach((id, i) => {
    const s = REFERENCE_SPRITES[id];
    const [x0, y0, x1] = s.box;
    const h = RH * s.pitch[1];
    c.drawImage(
      ref,
      x0,
      y0,
      x1 - x0,
      h,
      i * CW * S,
      0,
      ((x1 - x0) * S) / s.pitch[0],
      RH * S,
    );
    GIRL[id].rows.slice(0, RH).forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (ch !== ".") {
          c.fillStyle = (PALETTE as Record<string, { hex: string }>)[ch].hex;
          c.fillRect((i * CW + x) * S, RH * S + 10 + y * S, S, S);
        }
      }),
    );
  });
  writeFileSync(process.argv[2], cv.toBuffer("image/png"));
})();
