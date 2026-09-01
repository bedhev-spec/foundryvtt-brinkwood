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
  assert.match(template, /\{\{editor system\.description target="system\.description" button=true owner=owner editable=editable/);
  assert.doesNotMatch(template, /\{\{editor\s+content=/);
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
