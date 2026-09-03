import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("item sheets keep their content scrollable and their portrait bounded", async () => {
  const [controller, template, source, compiled] = await Promise.all([
    read("module/blades-item-sheet.js"),
    read("templates/items/item.html"),
    read("scss/import/item-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(template, /class="\{\{cssClass\}\} loadout-item-sheet"/);
  assert.match(controller, /position:\s*\{ width:\s*560, height:\s*700 \}/);
  assert.match(source, /\.window-content\s*\{[\s\S]*?container-type:\s*inline-size/);
  assert.match(source, /\.window-content\s*\{[\s\S]*?height:\s*100%/);
  assert.match(source, /\.window-content\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow:\s*hidden/);
  assert.match(source, /\.window-content > \.loadout-item-sheet\s*\{[\s\S]*?height:\s*100%[\s\S]*?min-height:\s*0[\s\S]*?overflow-y:\s*auto/);
  assert.match(source, /form\.loadout-item-sheet \.loadout-item-sheet__header > img\s*\{[\s\S]*?max-width:\s*88px[\s\S]*?max-height:\s*88px/);
  assert.match(source, /@container \(max-width: 480px\)/);
  assert.match(compiled, /\.brinkwood\.item\.sheet \.window-content > \.loadout-item-sheet\s*\{[\s\S]*?overflow-y: auto/);
  assert.match(compiled, /\.brinkwood\.item\.sheet form\.loadout-item-sheet \.loadout-item-sheet__header > img\s*\{[\s\S]*?max-width: 88px/);
});

test("legacy item sheets share bounded headers and scrolling content", async () => {
  const [simple, trait, itemClass, moot, source, compiled] = await Promise.all([
    read("templates/items/simple.html"),
    read("templates/items/trait.html"),
    read("templates/items/class.html"),
    read("templates/items/moot_decision.html"),
    read("scss/import/item-sheet.scss"),
    read("styles/blades.css"),
  ]);

  for (const template of [simple, trait, itemClass, moot]) {
    assert.match(template, /class="\{\{cssClass\}\} legacy-item-sheet"/);
  }
  assert.match(source, /\.window-content > \.legacy-item-sheet\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(source, /\.sheet-header\s*\{[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(simple, /class="sheet-body legacy-item-sheet__body"/);
  assert.match(simple, /class="legacy-item-sheet__primary"/);
  assert.match(simple, /class="legacy-item-sheet__secondary"/);
  assert.match(simple, /class="legacy-item-sheet__effects"/);
  assert.match(source, /\.legacy-item-sheet__body\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.4fr\) minmax\(180px, 0\.8fr\)/);
  assert.match(source, /\.legacy-item-sheet__effects\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(source, /\.legacy-item-sheet__primary:only-child\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(source, /@container \(max-width: 440px\)[\s\S]*?legacy-item-sheet__body/);
  assert.match(compiled, /\.brinkwood\.item\.sheet \.window-content > \.legacy-item-sheet\s*\{[\s\S]*?overflow-y: auto/);
});

test("loadout items use v13 form editing and accessible active-effect controls", async () => {
  const [controller, template, source] = await Promise.all([
    read("module/blades-item-sheet.js"),
    read("templates/items/item.html"),
    read("scss/import/item-sheet.scss"),
  ]);

  assert.match(controller, /form:\s*\{ closeOnSubmit: false, submitOnChange: true \}/);
  assert.match(controller, /async _onRender\(context, options\)\s*\{\s*await super\._onRender\(context, options\)/);
  assert.doesNotMatch(controller, /activateListeners\s*\(/);
  assert.doesNotMatch(controller, /_onChangeInput\s*\(/);
  assert.match(template, /<textarea id="item-description" name="system\.description" aria-labelledby="item-\{\{_id\}\}-description-heading">\{\{system\.description\}\}<\/textarea>/);
  assert.doesNotMatch(template, /<prose-mirror name="system\.description"/);
  assert.match(template, /aria-labelledby="item-\{\{_id\}\}-effects-heading"/);
  assert.match(template, /\{\{> "systems\/brinkwood\/templates\/parts\/active-effects\.html"\}\}/);
  assert.match(controller, /_bindEffectDisclosureState\(html\)/);
  assert.match(controller, /BladesActiveEffect\.onManageActiveEffect\(ev, this\.document, \{ gmOnly: true \}\)/);
  assert.match(controller, /const canEditFields = Boolean\(isGM && sheetEditable\)/);
  assert.match(controller, /if \(!context\.editable\)[\s\S]*?lockSheetFormControls\(html\)[\s\S]*?return/);
  assert.match(template, /name="system\.load"[\s\S]*?\{\{#unless canEditLoad\}\} disabled aria-disabled="true"/);
  assert.match(source, /\.loadout-item-sheet__section\s*\{[\s\S]*?h2\s*\{[\s\S]*?background: var\(--bw-ink\)/);
  assert.match(source, /\.loadout-item-sheet__section\s*\{[\s\S]*?display: block/);
  assert.match(source, /\.loadout-item-sheet__effects\s*\{[\s\S]*?\.effects-category\s*\{[\s\S]*?display: block/);
  assert.match(source, /\.effects-category \+ \.effects-category\s*\{[\s\S]*?margin-top: 8px/);
});
