import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Character Effects retain accessible sub-tabs and shared v13 state", async () => {
  const [effects, actorTemplate, controller, sharedController, categories, styles, stylesheet, manifest] = await Promise.all([
    read("templates/parts/actor-active-effects.html"), read("templates/actor-sheet.html"), read("module/blades-actor-sheet.js"),
    read("module/blades-sheet.js"), read("module/blades-active-effect.js"), read("scss/import/legacy-character-effects.scss"),
    read("scss/style.scss"), read("system.json"),
  ]);
  assert.match(actorTemplate, /id="character-\{\{_id\}\}-tab-effects"[\s\S]*?data-action="tab"[\s\S]*?data-tab="effects"/);
  assert.match(actorTemplate, /id="character-\{\{_id\}\}-effects"[\s\S]*?role="tabpanel"[\s\S]*?actor-active-effects\.html/);
  assert.match(effects, /role="tablist" aria-label="Effect/);
  assert.match(effects, /role="tab"[\s\S]*?data-effect-tab="\{\{section\.type\}\}"/);
  assert.match(effects, /data-effect-panel="\{\{section\.type\}\}"[\s\S]*?role="tabpanel"/);
  assert.match(controller, /this\._prepareEffectTabs\(context\)/);
  assert.match(sharedController, /_captureSheetViewState[\s\S]*?effectTab: this\._activeEffectTab/);
  assert.match(sharedController, /_restoreSheetViewState[\s\S]*?this\._activateEffectTab/);
  assert.match(categories, /categories\.suppressed\.visible = categories\.suppressed\.effects\.length > 0/);
  assert.match(styles, /\.brinkwood\.actor\.pc\.character \.effects-tabs/);
  assert.match(stylesheet, /import\/legacy-character-effects\.scss/);
  assert.doesNotMatch(manifest, /legacy-effects-tabs\.css/);
});
