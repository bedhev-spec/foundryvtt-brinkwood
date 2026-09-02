import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("PC traits render as static, wrapping paper-and-rule cards", async () => {
  const [template, styles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("scss/import/character-sheet.scss"),
  ]);

  const traitsPanel = template.slice(
    template.indexOf('id="character-{{_id}}-traits-tab"'),
    template.indexOf('id="character-{{_id}}-loadout"'),
  );

  assert.match(traitsPanel, /class="trait-card"/);
assert.match(traitsPanel, /class="trait-card__header\b/);
assert.match(traitsPanel, /class="trait-card__title"/);
assert.match(traitsPanel, /class="trait-card__separator" aria-hidden="true"/);
assert.match(traitsPanel, /class="trait-card__description"/);
  assert.doesNotMatch(traitsPanel, /effect-card|effect-control|disclosure|details-toggle/);

  assert.match(styles, /form\.actor-sheet \.tab\[data-tab="traits"\]/);
  assert.match(styles, /\.trait-card \{[\s\S]*?min-width:\s*0[\s\S]*?border:\s*1px solid var\(--bw-rule\)[\s\S]*?background:\s*var\(--bw-paper\)[\s\S]*?overflow:\s*visible/);
assert.match(styles, /\.trait-card__title \{[\s\S]*?min-width:\s*0[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.trait-card__purchase \{[\s\S]*?appearance:\s*none\s*!important[\s\S]*?-webkit-appearance:\s*none\s*!important[\s\S]*?background:\s*#fff/);
  assert.match(styles, /&:checked \{[\s\S]*?background-color:\s*#fff[\s\S]*?background-image:[\s\S]*?linear-gradient\(45deg[\s\S]*?linear-gradient\(-45deg/);
assert.match(styles, /\.trait-card__separator \{[\s\S]*?width:\s*75%[\s\S]*?border-top:/);
assert.match(styles, /\.trait-card__description \{[\s\S]*?max-height:\s*none[\s\S]*?overflow:\s*visible[\s\S]*?overflow-wrap:\s*anywhere/);
});
