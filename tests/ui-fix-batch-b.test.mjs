import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character fallbacks respond to the sheet container", async () => {
  const source = await read("scss/import/character-sheet.scss");

  assert.match(source, /&\s*\{\s*min-width:\s*0/);
  assert.match(source, /\.window-content\s*\{[\s\S]*?container-type:\s*inline-size/);
  assert.match(source, /@container \(max-width: 640px\)/);
  assert.match(source, /@container \(max-width: 480px\)/);
  assert.doesNotMatch(source, /@media \(max-width: (?:900|640)px\)/);
});

test("Mask Essence uses assigned Character Oath and read-only items remain viewable", async () => {
  const [template, controller] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("module/blades-mask-sheet.js"),
  ]);

  assert.match(controller, /context\.system\.oath\s*=\s*game\.user\.character\?\.system\?\.oath\s*\|\|\s*0/);
  assert.match(template, /data-roll-value="\{\{system\.oath\}\}"/);
  assert.doesNotMatch(template, /data-roll-value="\{\{system\.essence\.value\}\}"/);
  assert.ok(controller.indexOf('querySelectorAll(".item-body")') < controller.indexOf("if (!this.isEditable) return;"));
  assert.doesNotMatch(controller, /\b_dig\s*\(|\b_setDeep\s*\(/);
});
