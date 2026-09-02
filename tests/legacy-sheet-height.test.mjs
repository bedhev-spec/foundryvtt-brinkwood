import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Legacy actor sheet uses ApplicationV2 automatic height without changing V2", async () => {
  const [legacy, v2, clock] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("module/blades-actor-sheet-v2.js"),
    read("module/blades-clock-sheet.js"),
  ]);

  assert.match(legacy, /position:\s*\{\s*width:\s*700,\s*height:\s*"auto"\s*\}/);
  assert.match(clock, /position:\s*\{\s*width:\s*350,\s*height:\s*"auto"\s*\}/);
  assert.match(v2, /position:\s*\{\s*width:\s*800,\s*height:\s*900\s*\}/);
});
