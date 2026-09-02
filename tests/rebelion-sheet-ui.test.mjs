import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Rebellion template retains Foundry v13 tabs and tracker bindings", async () => {
  const [template, sedition, aspect] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/sedition-section.html"),
    read("templates/rebelion-sheet/aspect-section.html"),
  ]);

  assert.match(template, /data-action="tab" data-tab="overview" data-group="primary"/);
  assert.match(template, /data-action="tab" data-tab="aspects" data-group="primary"/);
  assert.match(template, /class="rebelion-sheet__status"/);
  assert.match(template, /path='system\.tyranny\.value'/);
  assert.match(template, /path='system\.heat\.value'/);
  assert.match(sedition, /path=\(concat 'system\.' \.\.\/type '\.' @index '\.sedition\.clock\.value'\)/);
  assert.match(sedition, /path=\(concat 'system\.' \.\.\/type '\.' @index '\.sedition\.level'\)/);
  assert.match(aspect, /path=\(concat 'system\.' \.\.\/type '\.progress\.' this\)/);
  assert.doesNotMatch(template, /data-group="primary-tabs"/);
});

test("Rebellion styles contain tooth dimensions and responsive ledger grids", async () => {
  const styles = await read("scss/import/rebelion-sheet.scss");

  assert.match(styles, /^\/\*[\s\S]*?\n& \{/);
  assert.match(styles, /\.rebelion-sheet \.big-teeth img\.big-teeth/);
  assert.match(styles, /inline-size:\s*16px/);
  assert.match(styles, /block-size:\s*22px/);
  assert.match(styles, /flex-wrap:\s*nowrap/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /inline-size:\s*14px/);
  assert.match(styles, /block-size:\s*19px/);
  assert.match(styles, /\.rebelion-settlements__header, \.rebelion-settlements__row/);
  assert.match(styles, /\.rebelion-aspect__header, \.rebelion-aspect__row/);
  assert.match(styles, /grid-column:\s*1 \/ -1/);
  assert.doesNotMatch(styles, /min-width:\s*450px/);
});
