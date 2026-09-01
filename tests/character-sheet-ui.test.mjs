import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("character notes use a declared persistent v13 editor field", async () => {
  const [model, defaults, template] = await Promise.all([
    read("module/data/actor-data-models.js"),
    read("template.json").then(JSON.parse),
    read("templates/actor-sheet.html"),
  ]);

  assert.match(model, /description:\s+new fields\.HTMLField\(\{ required: false, initial: "" \}\)/);
  assert.equal(defaults.Actor.character.description, "");
  assert.match(template, /id="character-\{\{_id\}\}-notes"[^>]+role="tabpanel"/);
  assert.match(template, /\{\{#if editable\}\}[\s\S]*?<prose-mirror name="system\.description" value="\{\{system\.description\}\}" document-uuid="\{\{actor\.uuid\}\}" collaborate toggled>/);
  assert.match(template, /\{\{else\}\}[\s\S]*?<div class="editor editor-content">\{\{\{enrichedDescription\}\}\}<\/div>/);
  assert.doesNotMatch(template, /\{\{editor\b/);
});

test("shared clock and effect controls adapt to sheet size and editability", async () => {
  const [mixin, characterStyles, effectStyles, effectTemplate] = await Promise.all([
    read("scss/import/mixin.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/general-styles.scss"),
    read("templates/parts/active-effects.html"),
  ]);

  assert.match(mixin, /&:has\(input\[value="0"\]:focus-visible\)/);
  assert.match(characterStyles, /container-type:\s*inline-size/);
  assert.match(characterStyles, /@container \(max-width: 760px\)/);
  assert.match(effectStyles, /container-type:\s*inline-size/);
  assert.match(effectStyles, /@container \(max-width: 600px\)/);
  assert.match(effectTemplate, /\{\{#if section\.canCreate\}\}[\s\S]*?\{\{#if \.\.\/editable\}\}[\s\S]*?data-effect-action="create"[\s\S]*?\{\{\/if\}\}/);
  assert.match(effectTemplate, /\{\{#if \.\.\/\.\.\/editable\}\}[\s\S]*?data-effect-action="toggle"[\s\S]*?\{\{\/if\}\}/);
});

test("character workspace gives effects the full pane and uses flat accessible skill pips", async () => {
  const [template, attributes, styles, compiled] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/parts/attributes.html"),
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(template, /class="character-sheet__workspace"/);
  assert.match(styles, /\.character-sheet__workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(200px, 240px\)/);
  assert.match(styles, /:has\(\.tab\[data-tab="loadout"\]\.active\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /:has\(\.tab\[data-tab="character-notes"\]\.active\)[\s\S]*?display:\s*none/);
  assert.match(styles, /@container \(max-width: 620px\)[\s\S]*?\.character-sheet__workspace/);
  assert.match(styles, /@container \(max-width: 480px\)[\s\S]*?\.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(attributes, /button type="button" class="dot-value \{\{#if \(lt skill\.value this\)\}\}dot-value--empty/);
  assert.match(attributes, /aria-pressed=/);
  assert.match(attributes, /\{\{#unless @root\.editable\}\} disabled/);
  assert.match(styles, /button\.dot-value\s*\{[\s\S]*?width:\s*28px[\s\S]*?background:\s*transparent/);
  assert.match(styles, /\.dot-value--filled::before\s*\{[\s\S]*?background:\s*var\(--bw-ink\)/);
  assert.match(styles, /nav\.tabs[\s\S]*?&\.active\s*\{[\s\S]*?box-shadow:\s*inset 0 -3px var\(--bw-accent\)/);
  assert.match(styles, /\.tab\[data-tab="character-notes"\][\s\S]*?prose-mirror\s*\{[\s\S]*?min-height:\s*260px/);
  assert.match(template, /button type="button" class="dot-value" data-path="system\.experience\.value"[\s\S]*?aria-pressed=/);
  assert.match(template, /button type="button" class="dot-value" data-path="system\.stress\.value"[\s\S]*?aria-pressed=/);
  assert.doesNotMatch(template, /for="character-\{\{_id\}\}-(?:xp|stress)-0"/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character \.character-sheet__workspace/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character \.attributes \.attributes-container button\.dot-value/);
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
  assert.match(compiledStyles, /\.brinkwood \.effect-card__metadata/);
});

test("downtime actions use explicit readable cards", async () => {
  const [template, sourceStyles, compiledStyles] = await Promise.all([
    read("templates/parts/actor/downtime.html"),
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(template, /<article class="downtime-action">/);
  assert.match(sourceStyles, /\.downtime-action\s*\{[\s\S]*?h3\s*\{[\s\S]*?color: var\(--bw-ink\)/);
  assert.match(compiledStyles, /\.brinkwood\.actor\.pc\.character \.downtime-action h3\s*\{[\s\S]*?color: var\(--bw-ink\)/);
});

test("character clocks expose readable progress and keyboard focus", async () => {
  const [helper, sourceMixin, sourceStyles, compiledStyles] = await Promise.all([
    read("module/blades.js"),
    read("scss/import/mixin.scss"),
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(helper, /class="clock-progress" aria-live="polite"/);
  assert.match(helper, /aria-label="\$\{clockLabel\} \$\{i\}\/\$\{type\}"/);
  const clockMixin = sourceMixin.slice(
    sourceMixin.indexOf("@mixin clock"),
    sourceMixin.indexOf("@mixin turf_block"),
  );
  assert.doesNotMatch(clockMixin, /display:\s*none/);
  assert.match(clockMixin, /&:focus-visible \+ label/);
  assert.match(sourceStyles, /@include clock\(4, 72\)/);
  assert.match(compiledStyles, /\.character-scars-clock \.blades-clock,[\s\S]*?width: 72px;[\s\S]*?height: 72px;/);
});
