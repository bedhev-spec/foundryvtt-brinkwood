import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Legacy and V2 Character sheets are independently selectable", async () => {
  const [registration, controller, legacyTemplate, v2Template, styles] = await Promise.all([
    read("module/blades.js"),
    read("module/blades-actor-sheet-v2.js"),
    read("templates/actor-sheet.html"),
    read("templates/actor-sheet-v2.html"),
    read("scss/style.scss"),
  ]);

  assert.match(controller, /class BladesActorSheetV2 extends BladesActorSheet/);
  assert.match(controller, /classes:\s*\["brinkwood", "sheet", "actor", "pc", "character", "character-v2"\]/);
  assert.match(controller, /template:\s*"systems\/brinkwood\/templates\/actor-sheet-v2\.html"/);
  assert.match(registration, /BladesActorSheet,[\s\S]*?makeDefault:\s*true,[\s\S]*?label:\s*"Brinkwood Character Sheet \(Legacy\)"/);
  assert.match(registration, /BladesActorSheetV2,[\s\S]*?makeDefault:\s*false,[\s\S]*?label:\s*"Brinkwood Character Sheet V2"/);
  assert.match(legacyTemplate, /<prose-mirror[^>]+data-document-uuid="\{\{actor\.uuid\}\}"/);
  assert.match(v2Template, /data-sheet-version="2"/);
  assert.match(v2Template, /<prose-mirror[^>]+data-document-uuid="\{\{actor\.uuid\}\}"/);
  assert.match(styles, /&\.character-v2\s*\{\s*@import 'import\/character-sheet-v2\.scss'/);
});

test("V2 preserves every persisted Character status field exactly once", async () => {
  const template = await read("templates/actor-sheet-v2.html");
  const fields = [
    "name",
    "system.alias",
    "system.experience.value",
    "system.stress.value",
    "system.bans.heavy.one",
    "system.bans.medium.one",
    "system.bans.medium.two",
    "system.bans.light.one",
    "system.bans.light.two",
    "system.armor-uses.armor",
    "system.armor-uses.heavy",
    "system.armor-uses.special",
    "system.selected_load_level",
    "system.description",
  ];

  for (const field of fields) {
    const attribute = field === "system.experience.value" || field === "system.stress.value" ? "data-path" : "name";
    assert.equal(template.match(new RegExp(`${attribute}="${field.replaceAll(".", "\\.")}"`, "g"))?.length, 1, field);
  }
  assert.equal(template.match(/blades-clock "system\.scars"/g)?.length, 1);
  assert.equal(template.match(/blades-clock "system\.oath"/g)?.length, 1);
});

test("V2 item interactions use one activation source and keyboard-openable bodies", async () => {
  const template = await read("templates/actor-sheet-v2.html");

  assert.doesNotMatch(template, /<label[^>]+class="[^"]*item-select/);
  assert.equal(template.match(/<input[^>]+class="dot item-select"[^>]+data-item-id=/g)?.length, 2);
  assert.equal(template.match(/class="item-body"\{\{#if \.\.\/editable\}\} role="button" tabindex="0"/g)?.length, 5);
});

test("V2 Bans inputs have distinct accessible labels", async () => {
  const template = await read("templates/actor-sheet-v2.html");

  assert.match(template, /for="character-\{\{_id\}\}-bans-2-1">\{\{localize "BITD\.Bans"\}\} 2, 1 \/ 2/);
  assert.match(template, /for="character-\{\{_id\}\}-bans-2-2">\{\{localize "BITD\.Bans"\}\} 2, 2 \/ 2/);
  assert.match(template, /for="character-\{\{_id\}\}-bans-1-1">\{\{localize "BITD\.Bans"\}\} 1, 1 \/ 2/);
  assert.match(template, /for="character-\{\{_id\}\}-bans-1-2">\{\{localize "BITD\.Bans"\}\} 1, 2 \/ 2/);
});
