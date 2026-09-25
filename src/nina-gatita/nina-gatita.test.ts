import assert from "node:assert/strict";
import test from "node:test";
import { PALETTE } from "./palette";
import { HEART_BUBBLE, REFERENCE_SPRITES } from "./sprites.generated";
import {
  DIRECTIONS,
  RIGS,
  SPRITE_IDS,
  facingFromVector,
  type SpriteId,
} from "./rig";
import {
  REST_POSE,
  closedEye,
  composeFrame,
  happyEye,
  type Pose,
} from "./pose";
import {
  PET_DURATION,
  PET_TIMELINE,
  WALK_CYCLE,
  WALK_STEP,
  petPhaseAt,
  sample,
} from "./animation";
import {
  EXERCISE_EYES,
  openEyes,
  solutionEyes,
  validateBlink,
  type EyePixels,
} from "./blink-exercise";

const DARK = new Set(["k", "K", "d", "D", "i"]);

function assertPaletteRows(name: string, rows: readonly string[]) {
  const w = rows[0].length;
  rows.forEach((row, y) => {
    assert.equal(row.length, w, `${name}: fila ${y} de ancho distinto`);
    for (const ch of row)
      assert.ok(
        ch === "." || ch in PALETTE,
        `${name}: "${ch}" fuera de la paleta`,
      );
  });
}

// Número de islas opacas 8-conexas: 1 significa que no hay partes flotando.
function islands(rows: readonly string[]): number {
  const seen = rows.map((r) => [...r].map(() => false));
  let count = 0;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "." || seen[y][x]) return;
      count++;
      const stack = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (ny < 0 || ny >= rows.length || nx < 0 || nx >= row.length)
              continue;
            if (rows[ny][nx] !== "." && !seen[ny][nx]) {
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
      }
    }),
  );
  return count;
}

// Píxeles de la silueta (tocan el fondo en cruz) que no son contorno.
function openOutline(rows: readonly string[]): [number, number][] {
  const out: [number, number][] = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "." || DARK.has(ch)) return;
      const bg = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? ".") === ".");
      if (bg) out.push([x, y]);
    }),
  );
  return out;
}

const POSES: Pose[] = [
  REST_POSE,
  ...[-1, 1].map((tail) => ({ ...REST_POSE, tail })),
  ...[-1, 1].map((kittenTail) => ({ ...REST_POSE, kittenTail })),
  { ...REST_POSE, headDrop: true, eyes: "closed" },
  { ...REST_POSE, bodyDrop: true, eyes: "happy" },
  ...WALK_CYCLE.map((step) => ({ ...REST_POSE, ...step, kittenTail: 1 })),
];

test("sprites y burbuja: filas uniformes y solo colores de la paleta", () => {
  for (const id of SPRITE_IDS)
    assertPaletteRows(id, REFERENCE_SPRITES[id].rows);
  assertPaletteRows("burbuja", HEART_BUBBLE);
});

test("cada figura es una sola pieza con el contorno cerrado", () => {
  for (const id of SPRITE_IDS) {
    const rows = REFERENCE_SPRITES[id].rows;
    assert.equal(islands(rows), 1, `${id}: hay píxeles flotando`);
    assert.deepEqual(openOutline(rows), [], `${id}: silueta sin contorno`);
  }
});

test("la extracción sigue siendo fiel a la hoja (ΔE medio por celda)", () => {
  for (const id of SPRITE_IDS) {
    const { meanDeltaE } = REFERENCE_SPRITES[id];
    assert.ok(meanDeltaE < 9, `${id}: ΔE ${meanDeltaE}`);
  }
});

test("los anclajes caen dentro de la figura y en orden", () => {
  for (const id of SPRITE_IDS) {
    const r = RIGS[id];
    const rows = REFERENCE_SPRITES[id].rows;
    assert.ok(
      r.neckY > 0 && r.neckY < r.hipY && r.hipY < r.height,
      `${id}: cuello/cadera`,
    );
    assert.ok(
      r.legSplitX > r.legs.x0 && r.legSplitX <= r.legs.x1,
      `${id}: separación de piernas`,
    );
    for (const b of [r.tail, r.kittenTail, r.legs, ...r.eyes]) {
      assert.ok(
        b.x0 >= 0 && b.x1 < r.width && b.y0 >= 0 && b.y1 < r.height,
        `${id}: caja fuera`,
      );
      assert.ok(b.x0 <= b.x1 && b.y0 <= b.y1, `${id}: caja invertida`);
    }
    for (const e of r.eyes) {
      assert.ok(e.y1 < r.neckY, `${id}: ojo bajo el cuello`);
      assert.ok(
        e.y1 - e.y0 >= 4,
        `${id}: caja de ojo demasiado baja para cerrar`,
      );
    }
    // La raíz de la cola del gatito (fila bajo la punta) está pegada al gato.
    const root = rows[r.kittenTail.y1 + 1].slice(
      r.kittenTail.x0,
      r.kittenTail.x1 + 1,
    );
    assert.match(root, /[oOyYc]/, `${id}: la cola del gatito no tiene raíz`);
  }
});

test("todas las poses conservan tamaño, paleta, una sola pieza y contorno", () => {
  for (const id of SPRITE_IDS)
    for (const pose of POSES) {
      const rows = composeFrame(id, pose);
      const name = `${id} ${JSON.stringify(pose)}`;
      assert.equal(rows.length, RIGS[id].height, name);
      assertPaletteRows(name, rows);
      assert.equal(islands(rows), 1, `${name}: se separa una parte`);
      assert.deepEqual(openOutline(rows), [], `${name}: contorno abierto`);
    }
});

test("la pose en reposo es exactamente la figura extraída", () => {
  for (const id of SPRITE_IDS)
    assert.deepEqual(composeFrame(id, REST_POSE), [
      ...REFERENCE_SPRITES[id].rows,
    ]);
});

test("el paso levanta un pie 1 px y el cuerpo baja 1 px", () => {
  const id: SpriteId = "abajo";
  const rig = RIGS[id];
  const rest = composeFrame(id, REST_POSE);
  const lifted = composeFrame(id, { ...REST_POSE, leg: "left" });
  // La fila del suelo del pie levantado queda vacía; la del otro pie no.
  const floor = rig.height - 1;
  const leftFloor = (rows: string[]) =>
    rows[floor].slice(rig.legs.x0, rig.legSplitX);
  assert.match(leftFloor(rest), /[^.]/);
  assert.equal(leftFloor(lifted).replaceAll(".", ""), "");
  assert.equal(
    lifted[floor].slice(rig.legSplitX),
    rest[floor].slice(rig.legSplitX),
  );
  const dropped = composeFrame(id, { ...REST_POSE, bodyDrop: true });
  assert.equal(
    dropped[0].replaceAll(".", ""),
    "",
    "la fila de arriba se vacía",
  );
  assert.equal(
    dropped[rig.hipY],
    rest[rig.hipY - 1]
      .split("")
      .map((ch, x) => (ch === "." ? rest[rig.hipY][x] : ch))
      .join(""),
  );
});

test("ojos cerrados y felices: una línea de 1 px dentro de la caja", () => {
  for (const id of SPRITE_IDS)
    for (const e of RIGS[id].eyes)
      for (const eye of [closedEye(e), happyEye(e)]) {
        assert.equal(eye.length, e.y1 - e.y0 + 1);
        const cols = eye[0].length;
        for (let x = 0; x < cols; x++)
          assert.equal(
            eye.filter((row) => row[x] === "k").length,
            1,
            `${id}: columna ${x}`,
          );
      }
});

test("las direcciones cubren las 8 orientaciones y el vector elige bien", () => {
  assert.equal(Object.keys(DIRECTIONS).length, 8);
  assert.equal(facingFromVector(1, 0), "derecha");
  assert.equal(facingFromVector(-1, 0), "izquierda");
  assert.equal(facingFromVector(0, 1), "abajo");
  assert.equal(facingFromVector(0, -1), "arriba");
  assert.equal(facingFromVector(1, 1), "abajo-derecha");
  assert.equal(facingFromVector(-1, -1), "arriba-izquierda");
  assert.equal(facingFromVector(0, 0), null);
  // La figura "Arriba-Izquierda" de la hoja mira al frente: no se usa ahí.
  assert.notEqual(DIRECTIONS["arriba-izquierda"].sprite, "arribaIzquierda");
});

test("la animación cambia a ritmo de pixel art, no a 60 fps", () => {
  const changes = (state: "idle" | "walk") => {
    let n = 0;
    let prev = "";
    for (let ms = 0; ms < 1000; ms += 1000 / 60) {
      const s = JSON.stringify(sample(state, ms, ms).pose);
      if (s !== prev) n++;
      prev = s;
    }
    return n;
  };
  assert.ok(changes("idle") <= 16, `idle: ${changes("idle")} cambios/s`);
  assert.equal(changes("walk"), 1000 / WALK_STEP);
});

test("la caricia recorre anticipación, acción, impacto y recuperación", () => {
  const phases: string[] = [];
  for (let ms = 0; ms < PET_DURATION; ms += 10) {
    const p = petPhaseAt(ms)!;
    if (phases[phases.length - 1] !== p) phases.push(p);
  }
  assert.deepEqual(
    phases,
    PET_TIMELINE.map((p) => p.phase),
  );
  assert.equal(petPhaseAt(PET_DURATION), null);
  assert.equal(sample("pet", 200, 200).lift, 2, "el salto sube 2 px");
  assert.ok(Number.isInteger(sample("pet", 200, 200).lift));
});

test("reto del parpadeo: el ojo abierto falla y la solución pasa", () => {
  const open = validateBlink(openEyes());
  // El ojo abierto no pasa ninguna regla de forma: su iris es una mancha.
  for (const id of ["colores", "linea", "ancho", "grosor"])
    assert.equal(open.find((c) => c.id === id)!.ok, false, id);
  assert.ok(
    validateBlink(solutionEyes()).every((c) => c.ok),
    JSON.stringify(validateBlink(solutionEyes())),
  );
});

test("reto del parpadeo: cada regla detecta su error", () => {
  const edit = (f: (eyes: EyePixels[]) => void) => {
    const eyes = solutionEyes();
    f(eyes);
    return Object.fromEntries(validateBlink(eyes).map((c) => [c.id, c.ok]));
  };
  // Línea de 2 px de grosor.
  assert.equal(
    edit((e) => (e[0][e[0].length - 4] = e[0][e[0].length - 4].map(() => "k")))
      .grosor,
    false,
  );
  // Línea en la mitad de arriba.
  assert.equal(edit((e) => (e[1][0][1] = "k")).altura, false);
  // Sin línea en un ojo.
  assert.equal(
    edit((e) => (e[1] = e[1].map((row) => row.map(() => "s")))).linea,
    false,
  );
  // Brillo olvidado.
  assert.equal(edit((e) => (e[0][1][1] = "w")).colores, false);
  // Ojos a distinta altura.
  const h = EXERCISE_EYES[1].y1 - EXERCISE_EYES[1].y0 + 1;
  assert.equal(
    edit((e) => {
      e[1] = Array.from({ length: h }, (_, y) =>
        e[1][0].map(() => (y === h - 2 ? "k" : "s")),
      );
    }).espejo,
    false,
  );
});
