// Auditoría de color por figura: colores fuera de paleta y proporción de
// acento (rosa) en la coronilla, de la primera fila hasta la de los ojos
// (así no cuenta la piel de la cara). Sale con código 1 si algo se pasa.
// Uso: npx tsx .claude/skills/sprite-desde-referencia/scripts/palette-audit.ts [umbral %=8]
import { resolve } from "node:path";

const [th = "8"] = process.argv.slice(2);
const root = process.cwd();
const { PALETTE } = await import(resolve(root, "src/nina-gatita/palette.ts"));
const { GIRL, SPRITE_IDS } = await import(
  resolve(root, "src/nina-gatita/rig.ts")
);
const ACCENT = new Set(["p", "P"]);
let bad = false;
for (const id of SPRITE_IDS as string[]) {
  const rows: string[] = GIRL[id].rows;
  const eyes: { y0: number }[] = GIRL[id].rig.eyes;
  const hr = eyes.length ? Math.min(...eyes.map((e) => e.y0)) : 24;
  const unknown = new Set<string>();
  let head = 0;
  let accent = 0;
  rows.forEach((r, y) =>
    [...r].forEach((ch) => {
      if (ch === ".") return;
      if (!(ch in PALETTE)) unknown.add(ch);
      if (y < hr) {
        head++;
        if (ACCENT.has(ch)) accent++;
      }
    }),
  );
  const pct = (100 * accent) / Math.max(1, head);
  const flag = pct > Number(th) || unknown.size > 0;
  bad ||= flag;
  console.log(
    `${flag ? "✗" : "✓"} ${id.padEnd(16)} rosa coronilla ${pct.toFixed(1).padStart(4)} %` +
      (unknown.size ? `  fuera de paleta: ${[...unknown].join("")}` : ""),
  );
}
process.exit(bad ? 1 : 0);
