import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("sheet tabs and action surfaces expose keyboard semantics", async () => {
  const [character, characterV2, mask, npc, attributes, baseSheet, actorSheet] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/actor-sheet-v2.html"),
    read("templates/mask-sheet.html"),
    read("templates/npc-sheet.html"),
    read("templates/parts/attributes.html"),
    read("module/blades-sheet.js"),
    read("module/blades-actor-sheet.js"),
  ]);

  for (const template of [character, characterV2, mask]) {
    assert.match(template, /<button type="button"[^>]*role="tab"[^>]*tabindex="\{\{#if/);
    assert.doesNotMatch(template, /<a[^>]*role="tab"/);
  }
  for (const template of [character, characterV2, mask, npc]) {
    assert.match(template, /data-action="editImage" data-edit="img" role="button" tabindex="0"/);
  }
  assert.match(character, /class="item-body flex-horizontal"\{\{#if editable\}\} role="button" tabindex="0"/);
  assert.match(characterV2, /class="item-body"\{\{#if \.\.\/editable\}\} role="button" tabindex="0"/);
  assert.match(attributes, /<button type="button" class="attribute-label roll-die-attribute/);
  assert.match(attributes, /<button type="button" class="attribute-skill-label roll-die-attribute/);
  assert.match(baseSheet, /key === "Home"[\s\S]*key === "End"[\s\S]*key === "ArrowRight"[\s\S]*key === "ArrowLeft"/);
  assert.match(baseSheet, /\[data-action="editImage"\]\[role="button"\]/);
  assert.match(actorSheet, /\.item-body\[role="button"\]/);
});

test("NPC and Clock styles support their narrow and locked states", async () => {
  const [npcStyles, clockStyles, locale] = await Promise.all([
    read("scss/import/npc-sheet.scss"),
    read("scss/import/clocks.scss"),
    read("lang/en.json"),
  ]);

  assert.match(npcStyles, /min-width:\s*320px/);
  assert.match(npcStyles, /@container \(max-width: 430px\)/);
  assert.match(clockStyles, /\.clock-sheet\.locked/);
  const translations = JSON.parse(locale);
  assert.equal(translations["BITD.Profile"], "Profile");
  assert.equal(translations["BITD.ShortDescription"], "Short description");
});
