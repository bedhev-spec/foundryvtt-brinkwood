import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("active effect cards use native compact disclosure with safe prepared details", async () => {
  const [template, controller, sheetController, styles, lateStyles, actorSheet, maskSheet, itemSheet, locale] = await Promise.all([
    read("templates/parts/active-effects.html"),
    read("module/blades-active-effect.js"),
    read("module/blades-sheet.js"),
    read("scss/import/general-styles.scss"),
    read("styles/legacy-effects-tabs.css"),
    read("module/blades-actor-sheet.js"),
    read("module/blades-mask-sheet.js"),
    read("module/blades-item-sheet.js"),
    read("lang/en.json")
  ]);

  assert.match(template, /<article class="effect-card[\s\S]*?data-effect-id="\{\{effect\.id\}\}"/);
  assert.match(template, /<div class="effect-card__header">[\s\S]*?<div class="effect-card__summary">[\s\S]*?<div class="effect-card__actions"/);
  assert.doesNotMatch(template, /<details class="effect-card|<summary class="effect-card__summary"/);
  assert.match(template, /id="\{\{effect\.detailsId\}\}" class="effect-card__details" data-effect-details hidden/);
  assert.match(template, /\{\{#each effect\.statuses as \|status\|\}\}<li>\{\{status\}\}<\/li>/);
  assert.match(template, /class="effect-card__detail-group effect-card__status-group"/);
  assert.match(template, /\{\{\{effect\.enrichedDescription\}\}\}/);
  assert.doesNotMatch(template, /\{\{\{effect\.description\}\}\}/);
  assert.match(template, /data-effect-action="edit"[\s\S]*?data-effect-details-toggle[\s\S]*?data-effect-action="delete"/);
  assert.match(template, /data-effect-details-toggle[^>]*aria-expanded="false"/);
  assert.match(template, /data-effect-action="toggle"[^>]*?EffectEnable[\s\S]*?EffectDisable/);
  assert.match(sheetController, /_captureEffectDisclosureState[\s\S]*?new Map[\s\S]*?\.effect-card\[data-effect-id\][\s\S]*?!card\.querySelector\('\[data-effect-details\]'\)\?\.hidden/);
  assert.match(sheetController, /_restoreEffectDisclosureState[\s\S]*?details\.hidden = !expanded[\s\S]*?aria-expanded/);
  assert.match(sheetController, /_bindEffectDisclosureState[\s\S]*?data-effect-details-toggle[\s\S]*?addEventListener\("click"[\s\S]*?_captureEffectDisclosureState/);
  assert.match(sheetController, /const listenerOptions[\s\S]*?this\._bindEffectDisclosureState\(html, listenerOptions\)/);

  assert.match(controller, /static async prepareActiveEffectCategories\(effects, \{ owner \} = \{\}\)/);
  assert.match(controller, /Array\.from\(effect\.statuses \?\? \[\]/);
  assert.match(controller, /typeof effect\.description === "string"/);
  assert.match(controller, /TextEditor\?\.implementation\?\.enrichHTML/);
  assert.match(actorSheet, /await BladesActiveEffect\.prepareActiveEffectCategories\(this\.actor\.effects, \{ owner: this\.actor \}\)/);
  assert.match(maskSheet, /await BladesActiveEffect\.prepareActiveEffectCategories\(this\.actor\.effects, \{ owner: this\.actor \}\)/);
  assert.match(itemSheet, /await BladesActiveEffect\.prepareActiveEffectCategories\(doc\.effects, \{ owner: doc \}\)/);

  assert.match(styles, /\.effect-card__summary\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.effect-card__metadata[\s\S]*?font-family:\s*Georgia/);
  assert.match(styles, /\.effect-card__actions\s*\{[\s\S]*?border:\s*1px solid var\(--bw-rule\)/);
  assert.match(styles, /\.effect-card__statuses li\s*\{[\s\S]*?font-size:\s*0\.9rem/);
  assert.match(styles, /\.effect-card__status-group\s*\{[\s\S]*?flex:\s*0 1 100%/);
  assert.match(styles, /\.effect-card__description\s*\{[\s\S]*?flex:\s*1 1 100%[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /&:focus-within\s*\{[\s\S]*?border-color:\s*var\(--bw-accent\)/);
  assert.match(styles, /\.effect-card__disclosure\s*\{[\s\S]*?display:\s*grid[\s\S]*?place-items:\s*center[\s\S]*?line-height:\s*1/);
  assert.match(styles, /\.effect-card__disclosure\s*\{[\s\S]*?&:hover,[\s\S]*?&:active,[\s\S]*?\[aria-expanded="true"\][\s\S]*?background:\s*transparent/);
  assert.match(styles, /\.effect-card__disclosure\s*\{[\s\S]*?&:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--bw-ink-soft\)/);
  assert.match(styles, /\.effect-card:has\(\.effect-card__details-toggle:focus\)\s*\{[\s\S]*?border-color:\s*var\(--bw-rule\)/);
  assert.match(styles, /button\.effect-control\.effect-card__details-toggle,[\s\S]*?border-color:\s*transparent !important[\s\S]*?border-left-color:\s*var\(--bw-rule\) !important[\s\S]*?background:\s*transparent !important[\s\S]*?box-shadow:\s*none !important/);
  assert.match(styles, /button\.effect-control\.effect-card__details-toggle i\s*\{[\s\S]*?top:\s*50%[\s\S]*?left:\s*50%[\s\S]*?transform:\s*translate\(-50%, -50%\)/);
  assert.match(styles, /button\.effect-control\.effect-card__details-toggle:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--bw-ink-soft\) !important/);
  assert.match(lateStyles, /effect-card__details-toggle:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--bw-ink-soft\) !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  for (const key of ["EffectDetails", "EffectStatuses", "EffectDescription", "EffectNoDetails", "EffectEnable", "EffectDisable"]) {
    assert.match(locale, new RegExp(`"BITD\\.${key}"`));
  }
});
