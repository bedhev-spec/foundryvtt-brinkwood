import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("native form serialization retains a cleared Alias on the second save", () => {
  const formData = new FormData();
  formData.set("system.alias", "SECOND-SAVE");
  formData.set("system.alias", "");
  assert.equal(formData.get("system.alias"), "");
});

test("Legacy Effects use persistent accessible sub-tabs and hide empty suppression", async () => {
  const [template, actorTemplate, controller, categories, styles, polishStyles, generalStyles, characterStyles, stylesheet, manifest] = await Promise.all([
    read("templates/parts/active-effects.html"),
    read("templates/actor-sheet.html"),
    read("module/blades-actor-sheet.js"),
    read("module/blades-active-effect.js"),
    read("scss/import/legacy-character-effects.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/style.scss"),
    read("system.json"),
  ]);

  assert.match(template, /role="tablist" aria-label="Effect types"/);
  assert.match(template, /role="tab"[\s\S]*?data-effect-tab="\{\{section\.type\}\}"/);
  assert.match(template, /data-effect-panel="\{\{section\.type\}\}"[\s\S]*?role="tabpanel"/);
  assert.match(template, /\{\{#if section\.visible\}\}[\s\S]*?<section class="effects-category"/);
  assert.match(template, /title="Create effect" aria-label="Create effect"/);
  assert.match(template, /effects-category__add[\s\S]*?<i class="fas fa-plus" aria-hidden="true"><\/i>[\s\S]*?<\/button>/);
  assert.doesNotMatch(template, /visually-hidden">Create effect<\/span>/);
  assert.doesNotMatch(template, /visually-hidden">Create effect<\/span>/);
  const sharedController = await read("module/blades-sheet.js");
  assert.match(controller, /this\._prepareEffectTabs\(context\)/);
  assert.match(sharedController, /_activeEffectTab/);
  assert.match(controller, /this\._bindSheetViewState\(html, listenerOptions\)/);
  assert.match(controller, /this\._captureSheetViewState\(\)/);
  assert.match(controller, /this\._restoreSheetViewState\(\)/);
  assert.doesNotMatch(controller, /_getLegacyScrollContainers|_captureLegacyScrollPosition|_restoreLegacyScrollPosition|_legacyViewState/);
  assert.match(sharedController, /_captureSheetViewState[\s\S]*?captureSheetViewState[\s\S]*?effectTab: this\._activeEffectTab/);
  assert.match(sharedController, /_restoreSheetViewState[\s\S]*?restoreSheetViewState[\s\S]*?this\._activateEffectTab/);
  assert.match(sharedController, /_bindSheetViewState[\s\S]*?getSheetScrollContainers[\s\S]*?\.item-add-popup/);
  assert.doesNotMatch(controller, /window\.scroll/);
  assert.doesNotMatch(controller, /globalThis\.requestAnimationFrame/);
  assert.match(controller, /form: \{ submitOnChange: false \}/);
  assert.match(actorTemplate, /name="system\.alias" value="\{\{system\.alias\}\}"/);
  assert.match(controller, /_persistFormControl/);
  assert.match(controller, /prose-mirror\[name\]/);
  assert.match(controller, /input\[name="system\.scars"\], input\[name="system\.oath"\], \[data-path\]/);
  assert.match(categories, /suppressed:[\s\S]*?visible: false/);
  assert.match(categories, /categories\.suppressed\.visible = categories\.suppressed\.effects\.length > 0/);
  assert.match(styles, /\.brinkwood\.actor\.pc\.character \.effects-tabs/);
  assert.match(styles, /\.big-teeth-section \.black-label \{[\s\S]*?flex: 0 0 auto[\s\S]*?width: auto/);
  assert.match(styles, /\.character-xp,[\s\S]*?\.character-stress \{[\s\S]*?width: 100%/);
  assert.match(styles, /\.effects-category\[data-effect-panel\] \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)[\s\S]*?grid-template-rows: auto auto/);
  assert.match(styles, /\.effects-category\[data-effect-panel\] > \.effects-category__header,[\s\S]*?\.effects-category__list \{[\s\S]*?grid-column: 1[\s\S]*?width: 100%/);
  assert.match(styles, /\.character-scars-clock,[\s\S]*?\.character-oath-clock \{[\s\S]*?grid-template-columns: 64px/);
  assert.match(styles, /\.character-scars-clock \.blades-clock[\s\S]*?grid-column: 1[\s\S]*?grid-row: 1/);
  assert.match(controller, /this\._prepareEffectTabs\(context\)/);
  assert.doesNotMatch(controller, /character-v2|_isLegacyCharacterSheet/);
  assert.match(stylesheet, /import\/legacy-character-sheet-polish\.scss/);
  assert.match(stylesheet, /import\/legacy-character-effects\.scss/);
  assert.doesNotMatch(manifest, /legacy-effects-tabs\.css/);
  assert.match(actorTemplate, /character-sheet__workspace[\s\S]*?<nav class="tabs[\s\S]*?<\/nav>[\s\S]*?<div class="tab-content/);
  // Load level is one native select, not a duplicated effect surface.
  assert.equal((actorTemplate.match(/name="system\.selected_load_level"/g) ?? []).length, 1);
  assert.doesNotMatch(actorTemplate, /id="character-\{\{_id\}\}-traits-tab"[\s\S]*?class="label-stripe"[\s\S]*?id="character-\{\{_id\}\}-traits-list"/);
  assert.match(characterStyles, /character-sheet__workspace > nav\.tabs \{[\s\S]*?grid-column: 1 \/ -1[\s\S]*?width: 100%[\s\S]*?box-sizing: border-box/);
  assert.equal((actorTemplate.match(/templates\/parts\/attributes\.html/g) ?? []).length, 1);
  assert.match(actorTemplate, /class="character-attributes"[\s\S]*?templates\/parts\/attributes\.html/);
  assert.match(characterStyles, /character-attributes > \.attributes \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?box-sizing: border-box/);
  assert.match(characterStyles, /character-attributes > \.attributes \.attributes-exp \{[\s\S]*?margin-top: 0/);
  assert.doesNotMatch(styles, /character-sheet__workspace \.tab\[data-tab=traits\].*attributes/);
  assert.match(characterStyles, /@container \(max-width: 570px\) \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(characterStyles, /@container \(max-width: 410px\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /character-bans table tbody > tr:last-child > td,[\s\S]*?td\[rowspan\] \{[\s\S]*?border-bottom: 0/);
  assert.equal((actorTemplate.match(/item-delete identity-choice__remove/g) ?? []).length, 4);
  assert.equal((actorTemplate.match(/class="identity-choice__action"/g) ?? []).length, 4);
  assert.equal((actorTemplate.match(/identity-choice__value/g) ?? []).length, 4);
  assert.match(actorTemplate, /title="Remove Upbringing" aria-label="Remove Upbringing"/);
  assert.match(actorTemplate, /title="Remove Profession" aria-label="Remove Profession"/);
  assert.match(actorTemplate, /title="Remove Class" aria-label="Remove Class"/);
  assert.match(actorTemplate, /title="Remove Pact" aria-label="Remove Pact"/);
  assert.match(controller, /deleteEmbeddedDocuments\("Item", \[element\.dataset\.itemId\]\)/);
  assert.match(styles, /big-teeth-section \{[\s\S]*?--legacy-tooth-pitch: 14px[\s\S]*?border-top: 1px solid var\(--bw-ink\)[\s\S]*?padding-block: 1\.5px/);
  assert.match(styles, /big-teeth-section button\.dot-value \{[\s\S]*?flex: 0 0 var\(--legacy-tooth-pitch\)[\s\S]*?width: var\(--legacy-tooth-pitch\)[\s\S]*?height: 26px[\s\S]*?min-height: 26px[\s\S]*?max-height: 26px/);
  assert.equal((actorTemplate.match(/class="legacy-tracker-segments"/g) ?? []).length, 2);
  assert.match(styles, /big-teeth-section \.big-teeth \{[\s\S]*?display: flex[\s\S]*?flex-wrap: nowrap[\s\S]*?height: 26px[\s\S]*?min-height: 26px[\s\S]*?max-height: 26px[\s\S]*?overflow: visible/);
  assert.match(styles, /legacy-tracker-segments \{[\s\S]*?flex: 0 0 auto[\s\S]*?gap: 1px[\s\S]*?justify-content: flex-start[\s\S]*?height: 26px[\s\S]*?width: auto[\s\S]*?overflow: visible/);
  assert.doesNotMatch(styles, /big-teeth-section \.big-teeth \{[^}]*overflow: hidden/);
  assert.match(characterStyles, /tab-content > \.tab\[data-tab\] \{[\s\S]*?margin-top: 0[\s\S]*?padding-top: 10px/);
  assert.match(characterStyles, /character-sheet__workspace \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)[\s\S]*?row-gap: 0/);
  assert.match(actorTemplate, /class="flex-column character-identity-choices"/);
  assert.match(polishStyles, /character-identity-choices \{[\s\S]*?grid-template-rows: repeat\(4, minmax\(26px, auto\)\)[\s\S]*?row-gap: 0[\s\S]*?padding-right: 0/);
  assert.match(polishStyles, /character-identity-choices \.item-block \{[\s\S]*?height: auto[\s\S]*?max-height: none[\s\S]*?margin: 0[\s\S]*?padding: 0 0 1\.5px/);
  assert.match(polishStyles, /character-identity-choices \.item-block > \.item \{[\s\S]*?min-height: 26px[\s\S]*?max-height: none[\s\S]*?align-self: stretch[\s\S]*?overflow: visible/);
  assert.match(polishStyles, /character-identity-choices \.item-name \{[\s\S]*?white-space: normal[\s\S]*?text-overflow: clip[\s\S]*?overflow-wrap: anywhere/);
  assert.match(polishStyles, /character-identity-choices \.item-body \{[\s\S]*?min-height: 26px[\s\S]*?max-height: none[\s\S]*?line-height: 1[\s\S]*?overflow: visible/);
assert.match(polishStyles, /character-identity-choices \.item-name \{[\s\S]*?line-height: 1[\s\S]*?white-space: normal[\s\S]*?overflow: visible[\s\S]*?overflow-wrap: anywhere/);
assert.match(characterStyles, /identity-choice__value \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 18px[\s\S]*?column-gap: 4px/);
assert.match(characterStyles, /character-identity-choices \.identity-choice__action \{[\s\S]*?grid-column: 2[\s\S]*?grid-row: 1[\s\S]*?position: static/);
  assert.match(styles, /identity-choice__remove \{[\s\S]*?display: inline-grid[\s\S]*?border: 0[\s\S]*?background: transparent/);
  assert.match(styles, /attributes \.attributes-container \{[\s\S]*?align-items: center[\s\S]*?min-height: 28px[\s\S]*?line-height: 1/);
  assert.match(styles, /attributes \.attribute-skill-label \{[\s\S]*?align-items: center[\s\S]*?margin-top: 0/);
  assert.match(polishStyles, /attributes \.attributes-container \{[\s\S]*?grid-template-columns: repeat\(4, 28px\) minmax\(0, 1fr\)/);
  assert.match(polishStyles, /attributes \.attributes-container button\.dot-value \{[\s\S]*?transform: none/);
  assert.match(polishStyles, /attributes \.attributes-container button\.dot-value::before \{[\s\S]*?transform: translateY\(7px\)/);
  assert.match(polishStyles, /clock-zero-label > \.nullifier[\s\S]*?display: none/);
  assert.match(actorTemplate, /class="bw-checkbox-x" type="checkbox" name="system\.armor-uses\.armor"/);
 assert.match(actorTemplate, /parts\/actor\/trait-card\.html/);
  assert.match(generalStyles, /\.bw-checkbox-x \{[\s\S]*?appearance: none !important[\s\S]*?-webkit-appearance: none !important[\s\S]*?background-color: #fff !important/);
  assert.match(generalStyles, /\.bw-checkbox-x::before,[\s\S]*?\.bw-checkbox-x::after \{[\s\S]*?content: none !important[\s\S]*?display: none !important/);
  assert.match(generalStyles, /\.bw-checkbox-x:checked \{[\s\S]*?background-color: #fff !important[\s\S]*?background-image:[\s\S]*?linear-gradient\(45deg[\s\S]*?linear-gradient\(-45deg/);
  assert.doesNotMatch(polishStyles, /background: #f39b55|border: solid #fff/);
  assert.doesNotMatch(actorTemplate, /data-tab="character-notes"[\s\S]*?class="label-stripe"[\s\S]*?prose-mirror/);
  assert.doesNotMatch(actorTemplate, /data-tab="effects"[\s\S]*?class="label-stripe"[\s\S]*?active-effects\.html/);
  assert.doesNotMatch(actorTemplate, /data-tab="downtime"[\s\S]*?class="label-stripe"[\s\S]*?parts\/actor\/downtime\.html/);
});
