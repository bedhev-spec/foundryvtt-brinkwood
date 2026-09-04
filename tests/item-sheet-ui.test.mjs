import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

function renderEffectCardOpeningTag(partial, rootContext, section, effect) {
  const openingTag = partial.match(/<article class="[^"]+" data-effect-id="\{\{effect\.id\}\}">/)?.[0];
  assert.ok(openingTag, "active-effect partial has an effect-card opening tag");
  const contexts = [rootContext, section, effect];
  return openingTag.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, path, content) => {
    const parents = path.split("../").length - 1;
    const key = path.replace(/^(\.\.\/)+/, "");
    return contexts.at(-1 - parents)?.[key] ? content : "";
  });
}

test("item sheets keep their content scrollable and their portrait bounded", async () => {
  const [controller, template, source, compiled] = await Promise.all([
    read("module/blades-item-sheet.js"),
    read("templates/items/item.html"),
    read("scss/import/item-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(template, /class="\{\{cssClass\}\} loadout-item-sheet"/);
  assert.match(controller, /position:\s*\{ width:\s*720, height:\s*700 \}[\s\S]*?resizable:\s*false/);
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
    assert.match(template, /class="\{\{cssClass\}\} bw-item-sheet"/);
  }
  assert.match(source, /\.window-content > \.bw-item-sheet\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(source, /\.sheet-header\s*\{[\s\S]*?grid-template-columns:\s*88px minmax\(0, 1fr\)/);
  assert.match(simple, /class="sheet-body bw-item-sheet__body"/);
  assert.match(simple, /class="bw-item-sheet__primary"/);
  assert.match(simple, /class="bw-item-sheet__secondary"/);
  assert.match(simple, /class="bw-item-sheet__effects"/);
  assert.match(source, /\.bw-item-sheet__body\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.4fr\) minmax\(180px, 0\.8fr\)/);
  assert.match(source, /\.bw-item-sheet__effects\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(source, /\.bw-item-sheet__primary:only-child\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(source, /@container \(max-width: 440px\)[\s\S]*?bw-item-sheet__body/);
  assert.match(compiled, /\.brinkwood\.item\.sheet \.window-content > \.bw-item-sheet\s*\{[\s\S]*?overflow-y: auto/);
});

test("item sheets opt into compact active-effect cards without changing shared sheets", async () => {
  const [partial, item, simple, trait, klass, styles, characterStyles] = await Promise.all([
    read("templates/parts/active-effects.html"),
    read("templates/items/item.html"),
    read("templates/items/simple.html"),
    read("templates/items/trait.html"),
    read("templates/items/class.html"),
    read("scss/import/general-styles.scss"),
    read("scss/import/character-sheet.scss"),
  ]);

  const compactCard = renderEffectCardOpeningTag(partial, { compact: true }, {}, { disabled: false });
  const defaultCard = renderEffectCardOpeningTag(partial, {}, {}, { disabled: false });
  assert.match(compactCard, /class="effect-card effect-card--compact"/);
  assert.doesNotMatch(defaultCard, /effect-card--compact/);
  for (const template of [item, simple, trait, klass]) {
    assert.match(template, /active-effects\.html" compact=true/);
  }
  assert.match(styles, /\.effect-card--compact\s*\{[\s\S]*?\.effect-card__image\s*\{[\s\S]*?width:\s*28px/);
  assert.match(styles, /\.effect-card--compact\s*\{[\s\S]*?button\.effect-control\s*\{[\s\S]*?block-size:\s*28px !important/);
  assert.match(styles, /\.effect-card--compact\s*\{[\s\S]*?inline-size:\s*fit-content[\s\S]*?justify-self:\s*end/);
  assert.match(styles, /\.effect-card--compact[\s\S]*?button\.effect-control\s*\{[\s\S]*?inline-size:\s*28px !important[\s\S]*?flex:\s*0 0 28px !important/);
  assert.match(styles, /@container \(max-width: 600px\)\s*\{[\s\S]*?\.effect-card--compact[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(characterStyles, /\.loadout__controls\s*\{[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center[\s\S]*?gap:\s*7px/);
  assert.match(characterStyles, /\.loadout__weight\s*\{[\s\S]*?align-items:\s*center[\s\S]*?block-size:\s*20px[\s\S]*?font-size:\s*calc\(1em \+ 2px\)[\s\S]*?transform:\s*translateY\(2px\)/);
  assert.match(characterStyles, /\.loadout__level\s*\{[\s\S]*?select\s*\{[\s\S]*?inline-size:\s*82px; min-width:\s*82px; max-width:\s*82px[\s\S]*?height:\s*20px/);
  assert.match(characterStyles, /&:focus\s*\{[\s\S]*?box-shadow:\s*none !important[\s\S]*?&:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--bw-ink-soft\) !important/);
});

test("loadout items use v13 form editing and accessible active-effect controls", async () => {
  const [controller, template, source] = await Promise.all([
    read("module/blades-item-sheet.js"),
    read("templates/items/item.html"),
    read("scss/import/item-sheet.scss"),
  ]);

  assert.match(controller, /form:\s*\{ closeOnSubmit: false, submitOnChange: false \}/);
  assert.doesNotMatch(controller, /activateListeners\s*\(/);
  assert.doesNotMatch(controller, /_onChangeInput\s*\(/);
  assert.match(template, /<textarea id="item-description" name="system\.description" aria-labelledby="item-\{\{_id\}\}-description-heading">\{\{system\.description\}\}<\/textarea>/);
  assert.doesNotMatch(template, /<prose-mirror name="system\.description"/);
  assert.match(template, /aria-labelledby="item-\{\{_id\}\}-effects-heading"/);
  assert.match(template, /\{\{> "systems\/brinkwood\/templates\/parts\/active-effects\.html" compact=true\}\}/);
  assert.match(template, /name="system\.load"[\s\S]*?\{\{#unless canEditLoad\}\} disabled aria-disabled="true"/);
  assert.match(source, /\.loadout-item-sheet__section\s*\{[\s\S]*?h2\s*\{[\s\S]*?background: var\(--bw-ink\)/);
  assert.match(source, /\.loadout-item-sheet__section\s*\{[\s\S]*?display: block/);
  assert.match(source, /\.loadout-item-sheet__effects\s*\{[\s\S]*?\.effects-category\s*\{[\s\S]*?display: block/);
  assert.match(source, /\.effects-category \+ \.effects-category\s*\{[\s\S]*?margin-top: 8px/);
});
