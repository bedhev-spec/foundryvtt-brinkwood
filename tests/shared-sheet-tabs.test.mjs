import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared tab component covers character and Mask states without geometry", async () => {
  const [component, generalStyles] = await Promise.all([
    read("scss/import/sheet-tabs.scss"),
    read("scss/import/general-styles.scss"),
  ]);

  assert.match(generalStyles, /@import 'sheet-tabs\.scss';/);
  assert.match(component, /\.character-sheet__workspace > nav\.tabs/);
  assert.match(component, /\.mask-sheet__tabs/);
  assert.match(component, /border-bottom-color:\s*var\(--bw-accent\)/);
  assert.match(component, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(component, /\.effects-category\[data-effect-panel\]/);
  assert.doesNotMatch(component, /grid-template-columns/);
});
