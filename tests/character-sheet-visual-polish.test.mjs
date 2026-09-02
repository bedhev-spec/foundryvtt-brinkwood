import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("character load-level menu is centered without a local focus frame", async () => {
  const styles = await read("scss/import/legacy-character-sheet-polish.scss");

  assert.match(styles, /loadout \.dropdown > select\[name="system\.selected_load_level"\] \{[\s\S]*?text-align: center;[\s\S]*?text-align-last: center;[\s\S]*?border-color: transparent;[\s\S]*?box-shadow: none;[\s\S]*?outline: none/);
  assert.match(styles, /selected_load_level"\]:focus,[\s\S]*?border-color: transparent;[\s\S]*?box-shadow: none;[\s\S]*?outline: none/);
  assert.match(styles, /selected_load_level"\] option \{[\s\S]*?text-align: center/);
});

test("character identity removal stays at the reserved row endpoint", async () => {
  const [styles, polishStyles] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
  ]);

  assert.match(styles, /character-identity-choices \.item-block \{[\s\S]*?grid-template-columns: max-content minmax\(0, 1fr\);/);
  assert.match(styles, /character-identity-choices \.identity-choice__value \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 18px;[\s\S]*?column-gap: 4px;[\s\S]*?overflow: hidden/);
  assert.match(styles, /identity-choice__value \.item-body \{[\s\S]*?grid-column: 1;[\s\S]*?overflow: hidden/);
  assert.match(styles, /character-identity-choices \.identity-choice__action \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;[\s\S]*?position: static;[\s\S]*?transform: none/);
  assert.match(styles, /character-identity-choices \.identity-choice__remove \{[\s\S]*?position: static;[\s\S]*?transform: none/);
  assert.match(styles, /identity-choice__value \{[\s\S]*?overflow: hidden/);
  assert.match(styles, /identity-choice__value \.item-name \{[\s\S]*?text-align: right;[\s\S]*?overflow: hidden/);
  assert.doesNotMatch(polishStyles, /item-block > \.item\s*\{[^}]*display:\s*flex/);
});
