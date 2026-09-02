import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Legacy actor sheet uses ApplicationV2 automatic height without changing V2", async () => {
  const [character, clock] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("module/blades-clock-sheet.js"),
  ]);

  assert.match(character, /position:\s*\{\s*width:\s*700,\s*height:\s*"auto"\s*\}/);
  assert.match(clock, /position:\s*\{\s*width:\s*350,\s*height:\s*"auto"\s*\}/);
});
