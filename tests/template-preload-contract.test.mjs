import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const partialReference = /\{\{>\s+"(systems\/brinkwood\/templates\/parts\/sheet-identity-[^"]+)"/g;

test("Character and Mask identity partials are preloaded before their sheet roots compile", async () => {
  const [templates, character, mask] = await Promise.all([
    read("module/blades-templates.js"),
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
  ]);
  const referenced = new Set(
    [...`${character}\n${mask}`.matchAll(partialReference)].map(([, path]) => path),
  );

  assert.deepEqual([...referenced].sort(), [
    "systems/brinkwood/templates/parts/sheet-identity-field.html",
    "systems/brinkwood/templates/parts/sheet-identity-name.html",
    "systems/brinkwood/templates/parts/sheet-identity-portrait.html",
    "systems/brinkwood/templates/parts/sheet-identity-row.html",
    "systems/brinkwood/templates/parts/sheet-identity-tracker.html",
  ]);
  for (const path of referenced) assert.match(templates, new RegExp(`"${path}"`));
});
