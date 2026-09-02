import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Legacy actor sheet keeps the Notes-sized bounded ApplicationV2 frame", async () => {
 const [character, clock, styles] = await Promise.all([
 read("module/blades-actor-sheet.js"),
 read("module/blades-clock-sheet.js"),
 read("scss/import/character-sheet.scss"),
  ]);

 assert.match(character, /position:\s*\{\s*width:\s*700,\s*height:\s*1170\s*\}/);
 assert.doesNotMatch(character, /position:\s*\{[^}]*height:\s*["']auto["']/);
 assert.match(clock, /position:\s*\{\s*width:\s*350,\s*height:\s*"auto"\s*\}/);
 assert.match(styles, /max-height:\s*calc\(100vh - 32px\)/);
 assert.match(styles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?overflow-y:\s*auto/);
});
