import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Mask Attributes live in the identity header and share Character presentation", async () => {
  const [maskSheet, maskAttributes, maskStyles, sharedStyles, characterSheet, controller] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/mask-attributes.html"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/general-styles.scss"),
    read("templates/actor-sheet.html"),
    read("module/blades-mask-sheet.js"),
  ]);

  const header = maskSheet.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? "";
  const traitsPanel = maskSheet.match(/data-tab="traits"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(header, /\{\{#if maskItem\}\}[\s\S]*?parts\/mask-attributes\.html[\s\S]*?\{\{\/if\}\}/);
  assert.doesNotMatch(traitsPanel, /parts\/mask-attributes\.html/);

  assert.match(maskAttributes, /class="mask-attributes sheet-attribute-presentation"/);
  assert.match(maskAttributes, /class="attributes-exp"[\s\S]*?class="stripe"[\s\S]*?class="attribute-label"/);
  assert.match(maskAttributes, /class="attributes-container mask-skill"[\s\S]*?dot-value--empty[\s\S]*?dot-value--filled[\s\S]*?class="attribute-skill-label roll-die-attribute/);
  assert.match(characterSheet, /class="character-attributes sheet-attribute-presentation"/);
  assert.match(sharedStyles, /\.sheet-attribute-presentation\s*\{[\s\S]*?\.stripe\s*\{[\s\S]*?background:\s*\$almost_black[\s\S]*?\.attribute-skill-label\s*\{[\s\S]*?min-height:\s*28px[\s\S]*?\.attributes-container\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, 28px\) minmax\(0, 1fr\)[\s\S]*?transform:\s*translateY\(7px\)[\s\S]*?\.dot-value--filled::before/);

  assert.match(controller, /MASK_SHEET_DEFAULT_WIDTH\s*=\s*700/);
  assert.match(controller, /MASK_SHEET_ATTRIBUTES_WIDTH\s*=\s*720/);
  assert.match(controller, /position:\s*\{\s*width:\s*MASK_SHEET_DEFAULT_WIDTH,\s*height:\s*840\s*\}/);
  assert.match(controller, /async _syncMaskAttributeAvailability\(hasMaskType\)[\s\S]*?const becameAvailable = available && !this\._maskAttributesAvailable;[\s\S]*?if \(becameAvailable\) await this\._expandForMaskAttributes\(\);[\s\S]*?else if \(!available && wasAvailable\) await this\._shrinkForMaskAttributes\(\);/);
  assert.match(controller, /await this\._syncMaskAttributeAvailability\(Boolean\(context\.maskItem\)\);/);
  assert.match(maskStyles, /\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(230px, 1fr\) 212px;[\s\S]*?column-gap:\s*20px;/);
  assert.match(maskStyles, /@container \(max-width: 650px\)\s*\{[\s\S]*?\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(0, 1fr\)[\s\S]*?\.mask-attributes\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(maskStyles, /&\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*width 180ms ease;/);
  assert.doesNotMatch(maskStyles, /color:\s*var\(--bw-ink\);\s*transition:/);
  assert.match(maskStyles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?&\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*none;/);
});

test("Mask Attribute parity has one shared visual owner and preserves its responsive and persistence contracts", async () => {
  const [maskAttributes, maskStyles, sharedStyles, legacyEffects, legacyPolish, compiledStyles] = await Promise.all([
    read("templates/parts/mask-attributes.html"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/legacy-character-effects.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(maskAttributes, /data-path="attributes\.\{\{\.\.\/\.\.\/system\.type\}\}\.skills\.\{\{skill_name\}\}\.value"/);
  assert.match(maskAttributes, /\{\{#unless \.\.\/\.\.\/editable\}\} disabled\{\{\/unless\}\}/);

  assert.match(sharedStyles, /h2\.attribute-label\s*\{[\s\S]*?font-family:\s*inherit;[\s\S]*?font-size:\s*inherit;[\s\S]*?font-weight:\s*bold;/);
  assert.match(sharedStyles, /&:focus,\s*&:active\s*\{[\s\S]*?box-shadow:\s*none;/);
  assert.match(sharedStyles, /&:focus-visible::before\s*\{[\s\S]*?outline-offset:\s*3px;/);
  assert.doesNotMatch(legacyEffects, /\.attributes-container button\.dot-value/);
  assert.doesNotMatch(legacyPolish, /\.attributes \.attributes-container/);

  assert.match(maskStyles, /\.mask-sheet__traits-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.doesNotMatch(maskStyles, /0\.42fr/);
  assert.match(maskStyles, /\.mask-sheet__trait-library\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?inline-size:\s*100%;/);
  assert.match(maskStyles, /@container \(max-width: 480px\)\s*\{[\s\S]*?\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*96px minmax\(0, 1fr\);[\s\S]*?\.sheet-identity__portrait\s*\{[\s\S]*?grid-row:\s*span 3;[\s\S]*?\.sheet-identity__portrait-frame\s*\{[\s\S]*?width:\s*96px;[\s\S]*?height:\s*96px;/);

  assert.match(compiledStyles, /\.brinkwood \.sheet-attribute-presentation h2\.attribute-label\s*\{[\s\S]*?font-size:\s*inherit;/);
  assert.match(compiledStyles, /\.brinkwood\.actor\.mask\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*width 180ms ease;/);
  assert.doesNotMatch(compiledStyles, /\.brinkwood\.actor\.mask\s*\{[^}]*transition:\s*width/);
  assert.match(compiledStyles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.brinkwood\.actor\.mask\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*none;/);
  assert.match(compiledStyles, /\.brinkwood\.actor\.mask \.mask-sheet__traits-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(compiledStyles, /@container \(max-width: 480px\)\s*\{[\s\S]*?\.brinkwood\.actor\.mask \.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*96px minmax\(0, 1fr\);/);
});

test("configured Mask Attribute column matches one default Character Attribute column", async () => {
  const [characterStyles, maskStyles] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
  ]);
  const characterColumnWidth = (700 - (20 * 2) - (12 * 2)) / 3;
  const configuredMaskContentWidth = 720 - (16 * 2);
  const compactMaskContentWidth = 700 - (16 * 2);
  const maskHeaderMinimumWidth = 150 + 230 + characterColumnWidth + (20 * 2);

  assert.equal(characterColumnWidth, 212);
  assert.equal(configuredMaskContentWidth, 688);
  assert.equal(compactMaskContentWidth, 668);
  assert.equal(maskHeaderMinimumWidth, 632);
  assert.ok(configuredMaskContentWidth > maskHeaderMinimumWidth);
  assert.ok(compactMaskContentWidth > 650);
  assert.match(characterStyles, /form\.actor-sheet\s*\{[\s\S]*?padding:\s*20px;/);
  assert.match(characterStyles, /character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*12px;/);
  assert.match(maskStyles, /grid-template-columns:\s*minmax\(150px, 200px\) minmax\(230px, 1fr\) 212px;/);
  assert.match(maskStyles, /@container \(max-width: 650px\)/);
});
