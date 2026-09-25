// Vuelca una figura como texto, junto a su rejilla original de la hoja.
// Uso: npx tsx .claude/skills/sprite-desde-referencia/scripts/ascii.ts <id|gatito:vista|gatito-cabeza:vista> [y0] [y1]
import { resolve } from "node:path";

const [id = "abajo", a = "0", b = "999"] = process.argv.slice(2);
const root = process.cwd();
const { actor } = await import(resolve(root, "src/nina-gatita/render.ts"));
const { REFERENCE_SPRITES } = await import(
  resolve(root, "src/nina-gatita/sprites.generated.ts")
);
const final: string[] = actor(id).rows;
const original: string[] | undefined = REFERENCE_SPRITES[id]?.rows;
const y0 = Number(a);
const y1 = Math.min(Number(b), final.length);
console.log(`${id}   final${original ? " | hoja (sin corregir)" : ""}`);
for (let y = y0; y < y1; y++)
  console.log(
    String(y).padStart(3),
    final[y],
    original ? `| ${original[y]}` : "",
  );
