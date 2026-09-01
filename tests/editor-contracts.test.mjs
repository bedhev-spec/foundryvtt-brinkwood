import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

function arrayFromIndexedFields(fields, path) {
  return Object.entries(fields)
    .filter(([name]) => name.startsWith(`${path}.`))
    .sort(([left], [right]) => Number(left.slice(path.length + 1)) - Number(right.slice(path.length + 1)))
    .map(([, value]) => value);
}

test("actor rich-text fields and template defaults stay aligned", async () => {
  const [models, template] = await Promise.all([
    read("module/data/actor-data-models.js"),
    read("template.json")
  ]);
  const defaults = JSON.parse(template).Actor;

  assert.match(models, /notes:\s+new fields\.HTMLField/);
  assert.match(models, /description:\s+new fields\.HTMLField/);
  assert.equal(defaults.mask.description, "");
  assert.equal(defaults.npc.notes, "");
});

test("v13 image actions and editors are editable-only", async () => {
  const templates = await Promise.all([
    "templates/mask-sheet.html",
    "templates/npc-sheet.html",
    "templates/items/simple.html",
    "templates/items/class.html",
    "templates/items/moot_decision.html",
    "templates/items/trait.html"
  ].map(read));

  for (const template of templates) {
    assert.match(template, /\{\{#if editable\}\}\s*data-action="editImage" data-edit="img"/);
  }
  assert.match(templates[0], /\{\{editor system\.description[^}]*owner=owner editable=editable/);
  assert.match(templates[1], /\{\{editor system\.description[^}]*owner=owner editable=editable/);
  assert.match(templates[1], /\{\{editor system\.notes[^}]*owner=owner editable=editable/);
  for (const template of templates) assert.doesNotMatch(template, /\{\{editor\s+content=/);
  assert.doesNotMatch(templates[3], /\{\{editor system\.experience_clues/);
  assert.match(templates[3], /name="system\.experience_clues\.\{\{index\}\}"/);
  assert.doesNotMatch(templates[5], /system-edit="img"|\{\{item\.img\}\}/);
});

test("Class clue form paths serialize as an ordered string array, not rich HTML", async () => {
  const template = await read("templates/items/class.html");
  const names = [...template.matchAll(/name="(system\.experience_clues\.\{\{index\}\})"/g)].map(([, name]) => name);
  assert.deepEqual(names, ["system.experience_clues.{{index}}"]);
  assert.doesNotMatch(template, /target="system\.experience_clues"|editor[^}]*experience_clues/);

  const submitted = {
    "system.experience_clues.2": "Third clue",
    "system.experience_clues.0": "First clue",
    "system.experience_clues.1": "<p>Second clue remains plain text</p>"
  };
  assert.deepEqual(arrayFromIndexedFields(submitted, "system.experience_clues"), [
    "First clue",
    "<p>Second clue remains plain text</p>",
    "Third clue"
  ]);
});
