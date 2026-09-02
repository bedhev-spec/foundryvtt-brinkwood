import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("the evolved character sheet is the only registered character sheet", async () => {
  const [registration, controller] = await Promise.all([
    read("module/blades.js"),
    read("module/blades-actor-sheet.js"),
  ]);

  assert.match(registration, /registerSheet\(foundry\.documents\.Actor, "brinkwood", BladesActorSheet,/);
  assert.match(registration, /label: "Brinkwood Character Sheet"/);
  assert.doesNotMatch(registration, /BladesActorSheetV2|character-v2|actor-sheet-v2/);
  assert.doesNotMatch(controller, /_isLegacyCharacterSheet|character-v2/);

  for (const removed of [
    "module/blades-actor-sheet-v2.js",
    "templates/actor-sheet-v2.html",
    "scss/import/character-sheet-v2.scss",
  ]) {
    await assert.rejects(access(new URL(removed, root)));
  }
});

test("effect management is grouped and uses markup-independent controls", async () => {
  const [template, manager, sourceStyles, compiledStyles] = await Promise.all([
    read("templates/parts/active-effects.html"),
    read("module/blades-active-effect.js"),
    read("scss/import/general-styles.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(template, /<section class="effects-category" data-effect-type=/);
  assert.match(template, /<article class="effect-card/);
  assert.match(template, /<button type="button" class="effect-control/);
  assert.doesNotMatch(template, /<table|<thead|<tr/);
  assert.match(manager, /closest\("\[data-effect-id\]"\)/);
  assert.match(manager, /closest\("\[data-effect-type\]"\)/);
  assert.match(manager, /suppressed:\s*\{[\s\S]*?canCreate: false/);
  assert.match(template, /\{\{#if section\.canCreate\}\}/);
  assert.match(template, /\{\{#if \.\.\/\.\.\/editable\}\}[\s\S]*?data-effect-action="toggle"[\s\S]*?\{\{\/if\}\}/);
  assert.match(sourceStyles, /\.effect-card__metadata/);
  assert.match(sourceStyles, /\.effect-card__metadata\s*\{[\s\S]*?font-size:\s*0\.92rem[\s\S]*?font-weight:\s*600[\s\S]*?opacity:\s*1/);
  assert.match(compiledStyles, /\.brinkwood \.effect-card__metadata/);
});

test("character traits are static purchased cards", async () => {
  const [template, controller] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("module/blades-sheet.js"),
  ]);

  const traitsStart = template.indexOf('<div id="character-{{_id}}-traits-list">');
  const loadoutStart = template.indexOf('id="character-{{_id}}-loadout"');
  const traitMarkup = template.slice(traitsStart, loadoutStart);
  assert.match(traitMarkup, /<article class="trait-card" data-item-id="\{\{trait\._id\}\}">/);
assert.match(traitMarkup, /<header class="trait-card__header">/);
  assert.match(traitMarkup, /<input type="checkbox" id="item-\{\{trait\._id\}\}-purchased" class="trait-card__purchase" data-item-id="\{\{trait\._id\}\}" aria-label="Purchased \/ Learned: \{\{trait\.name\}\}" title="Purchased \/ Learned" \{\{#if trait\.system\.purchased\}\}checked\{\{\/if\}\}\{\{#unless \.\.\/editable\}\} disabled\{\{\/unless\}\}>/);
assert.match(traitMarkup, /<h3 class="trait-card__title">[\s\S]*?\{\{trait\.name\}\}/);
assert.match(traitMarkup, /<div class="trait-card__separator" aria-hidden="true"><\/div>/);
  assert.match(traitMarkup, /<div class="trait-card__description">\{\{\{trait\.system\.description\}\}\}<\/div>/);
  assert.doesNotMatch(traitMarkup, /data-effect-|effect-control|<details|item-delete|item-add-popup|<img/);
  assert.doesNotMatch(traitMarkup, /parts\/attributes\.html/);
  assert.equal((template.match(/parts\/attributes\.html/g) ?? []).length, 1);
  assert.ok(template.indexOf('<section class="character-attributes" aria-label="Attributes">') < template.indexOf('id="character-{{_id}}-bans-armor"'));
assert.match(controller, /html\.querySelectorAll\("\.item-select"\)[\s\S]*?_onItemSelect/);
assert.match(controller, /html\.querySelectorAll\("\.trait-card__purchase"\)[\s\S]*?_onTraitPurchaseChange/);
assert.match(controller, /async _onTraitPurchaseChange\(event\)[\s\S]*?"system\.purchased": event\.currentTarget\.checked/);
  assert.match(controller, /case "trait":\s*update_data = \{ "system\.purchased": !item\.system\.purchased \}/);
});

test("every Brinkwood sheet uses the shared parchment texture", async () => {
  const styles = await read("scss/import/general-styles.scss");

  assert.match(styles, /\.window-content\s*\{[\s\S]*?url\("assets\/textures\/parchment-grain-sage-v4\.png"\)/);
  await access(new URL("styles/assets/textures/parchment-grain-sage-v4.png", root));
});

test("Bans level two has stable neutral emphasis without row focus coloring", async () => {
  const [template, styles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("scss/import/character-sheet.scss"),
  ]);

  assert.match(template, /<tr data-ban-level="3">/);
  assert.match(template, /<tr data-ban-level="2">/);
  assert.match(template, /<tr data-ban-level="1">/);
  assert.match(styles, /tbody tr \+ tr > td\s*\{[\s\S]*?border-top:\s*1px solid rgba\(141, 98, 93, 0\.5\)/);
  assert.doesNotMatch(styles, /tbody tr\[data-ban-level="2"\][\s\S]*?background:/);
  assert.doesNotMatch(styles, /character-bans[\s\S]*?tr:focus-within/);
});

test("Character tabs retain a valid selection and contain Downtime within the fixed sheet width", async () => {
  const [controller, styles, compiled] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(controller, /_ensureValidPrimaryTab\(context\)[\s\S]*?validTabs = \["traits", "loadout", "character-notes", "downtime"\]/);
  assert.match(controller, /if \(validTabs\.includes\(this\.tabGroups\.primary\)\) return;/);
  assert.match(controller, /this\.tabGroups\.primary = "traits";[\s\S]*?context\.tabs\.primary = "traits";/);
  assert.doesNotMatch(styles, /character-sheet__workspace:has\(\.tab\[data-tab="downtime"\]\.active\)/);
  assert.match(styles, /\.tab\[data-tab\]\s*\{[^}]*?min-height:\s*0/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0[\s\S]*?max-width:\s*100%/);
  assert.match(styles, /\.downtime-actions\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/);
  assert.match(styles, /\.tab\.downtime\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(styles, /\.downtime-action\s*\{[\s\S]*?border-left:\s*5px solid var\(--bw-accent\)/);
  assert.doesNotMatch(styles, /\.tab\.downtime,[\s\S]*?\.downtime-action\s*\{[\s\S]*?border-left/);
  assert.match(styles, /\.downtime-action[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.window-content\s*\{[\s\S]*?overflow-y:\s*auto[\s\S]*?scrollbar-gutter:\s*stable/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character \.window-content\s*\{[\s\S]*?scrollbar-gutter:\s*stable/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character \.downtime-action\s*\{[\s\S]*?border-left:\s*5px solid var\(--bw-accent\)/);
});

test("Character sheet commits generic controls once and completes tab-panel contracts", async () => {
  const [controller, template] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("templates/actor-sheet.html"),
  ]);

  assert.match(controller, /control\.addEventListener\("change", event => this\._persistFormControl\(event\), listenerOptions\)/);
  assert.doesNotMatch(controller, /control\.addEventListener\("focusout", event => this\._persistFormControl\(event\), listenerOptions\)/);
  assert.match(controller, /input\[name="system\.scars"\], input\[name="system\.oath"\], \[data-path\]/);
  assert.match(controller, /control\.matches\("prose-mirror\[name\]"\)/);

  assert.match(template, /<thead>\s*<tr>[\s\S]*?<\/tr>\s*<\/thead>/);
  for (const [tab, panel] of [
    ["traits", "traits-tab"],
    ["loadout", "loadout"],
    ["notes", "notes"],
    ["downtime", "downtime"],
    ["effects", "effects"],
  ]) {
    assert.match(template, new RegExp(`id="character-\\{\\{_id\\}\\}-tab-${tab}"[\\s\\S]*?aria-controls="character-\\{\\{_id\\}\\}-${panel}"`));
    assert.match(template, new RegExp(`id="character-\\{\\{_id\\}\\}-${panel}"[\\s\\S]*?role="tabpanel"[\\s\\S]*?aria-labelledby="character-\\{\\{_id\\}\\}-tab-${tab}"`));
  }
  assert.match(template, /\{\{#if isGM\}\}[\s\S]*?id="character-\{\{_id\}\}-tab-effects"[\s\S]*?\{\{\/if\}\}[\s\S]*?\{\{#if isGM\}\}[\s\S]*?id="character-\{\{_id\}\}-effects"[\s\S]*?\{\{\/if\}\}/);
});

test("attribute groups use the Bans width in horizontal, responsive columns", async () => {
  const styles = await read("scss/import/legacy-character-effects.scss");

 assert.match(styles, /\.character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*100%[\s\S]*?box-sizing:\s*border-box[\s\S]*?flex:\s*1 1 100%/);
 assert.match(styles, /\.character-attributes\s*\{[\s\S]*?align-self:\s*stretch[\s\S]*?width:\s*100%[\s\S]*?flex:\s*0 0 auto/);
 assert.match(styles, /\.attribute > \.flex-horizontal\s*\{[\s\S]*?display:\s*block[\s\S]*?width:\s*100%/);
 assert.match(styles, /\.attributes \.attributes-container\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(4, 28px\) minmax\(0, 1fr\)[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/);
 assert.match(styles, /\.attributes \.attribute-skill-label\s*\{[\s\S]*?min-width:\s*0[\s\S]*?text-overflow:\s*ellipsis[\s\S]*?white-space:\s*nowrap/);
 assert.match(styles, /@container \(max-width: 570px\)\s*\{[\s\S]*?\.character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
 assert.match(styles, /@container \(max-width: 410px\)\s*\{[\s\S]*?\.character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});
