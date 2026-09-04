import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Character Name and Alias share exact field geometry while retaining distinct type", async () => {
  const [character, field, name, styles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/parts/sheet-identity-field.html"),
    read("templates/parts/sheet-identity-name.html"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(name, /class="sheet-identity__field-box sheet-identity__name-box/);
  assert.match(character, /sheet-identity-field\.html"[\s\S]*?fieldBoxClass="sheet-identity__alias-box"[\s\S]*?fieldClass="alias bw-text-field"/);
  assert.match(field, /class="sheet-identity__field-box/);
  assert.match(styles, /\.sheet-identity__field-box\s*\{[\s\S]*?grid-template-rows:\s*16px 36px[\s\S]*?> label\s*\{[\s\S]*?height:\s*16px[\s\S]*?align-items:\s*flex-end[\s\S]*?input\[type="text"\]\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*36px[\s\S]*?margin:\s*0/);
  assert.match(styles, /\.sheet-identity__name-box[\s\S]*?\.bw-text-field\s*\{[\s\S]*?font-size:\s*1\.35rem/);
  assert.match(styles, /\.sheet-identity__alias-box \.alias\s*\{[\s\S]*?font-size:\s*1rem/);
});

test("Character identity rows keep selected and empty values clear of separators", async () => {
  const [character, sharedStyles, legacyEffects] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("scss/import/sheet-identity.scss"),
    read("scss/import/legacy-character-effects.scss"),
  ]);

  assert.match(character, /class="sheet-identity__rows sheet-identity__rows--separated"/);
  assert.match(sharedStyles, /\.sheet-identity \.sheet-identity__rows--separated\s*\{[\s\S]*?grid-auto-rows:\s*28px/);
  assert.match(sharedStyles, /\.sheet-identity \.sheet-identity__rows--separated \.sheet-identity__row\s*\{[\s\S]*?height:\s*28px;[\s\S]*?min-height:\s*28px;[\s\S]*?border-block-end:\s*1px solid rgba\(141, 98, 93, 0\.3\);[\s\S]*?box-shadow:\s*none/);
  assert.doesNotMatch(legacyEffects, /\.name-alias \.item-block \.item\s*\{/);
});
