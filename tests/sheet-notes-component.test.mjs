import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { bindRichTextPersistence, persistRichTextChange } from "../module/sheet-dom.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character and Mask consume the shared Notes component", async () => {
  const [character, mask, partial, templates] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
    read("templates/parts/sheet-notes.html"),
    read("module/blades-templates.js"),
  ]);
  const reference = /systems\/brinkwood\/templates\/parts\/sheet-notes\.html/;

  assert.match(character, reference);
  assert.match(mask, reference);
  assert.match(character, /class="tab flex-vertical sheet-notes/);
  assert.match(mask, /mask-sheet__notes sheet-notes/);
  assert.match(partial, /<prose-mirror class="sheet-notes__editor" name="\{\{fieldName\}\}" value="\{\{fieldValue\}\}" data-document-uuid="\{\{documentUuid\}\}" collaborate toggled>/);
  assert.match(partial, /class="editor editor-content sheet-notes__preview"/);
  assert.match(templates, reference);
});

test("the design system owns Notes styling once", async () => {
  const [shared, character, mask, tabs, rootStyles] = await Promise.all([
    read("scss/import/sheet-notes.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
    read("scss/import/general-styles.scss"),
  ]);

  assert.match(rootStyles, /@import 'sheet-notes\.scss';/);
  assert.match(shared, /\.sheet-notes\s*\{[\s\S]*?> prose-mirror[\s\S]*?min-height:\s*260px/);
  assert.match(shared, /prose-mirror \.ProseMirror\s*\{[\s\S]*?min-inline-size:\s*0[\s\S]*?color:\s*var\(--bw-ink\)/);
  assert.match(shared, /prose-mirror \.ProseMirror\s*\{[\s\S]*?min-block-size:\s*218px[\s\S]*?cursor:\s*text/);
  assert.doesNotMatch(character, /data-tab="character-notes"/);
  assert.doesNotMatch(mask, /mask-sheet__notes[\s\S]*?prose-mirror/);
  assert.doesNotMatch(tabs, /mask-sheet__panel prose-mirror/);
});

test("shared rich-text persistence saves Mask Notes and requests a rerender", async () => {
  const updates = [];
  const control = {
    name: "system.description",
    value: "<p>Saved Mask note</p>",
    matches: selector => selector === "prose-mirror[name]",
  };
  const sheet = {
    isEditable: true,
    document: {
      update: async (...args) => { updates.push(args); },
    },
  };

  assert.equal(await persistRichTextChange(sheet, { currentTarget: control }), true);
  assert.deepEqual(updates, [[
    { "system.description": "<p>Saved Mask note</p>" },
    { render: true },
  ]]);
});

test("the shared Notes binder owns the prose-mirror change listener", async () => {
  const listeners = new Map();
  const control = {
    addEventListener: (type, listener, options) => listeners.set(type, { listener, options }),
  };
  const html = {
    querySelectorAll: selector => {
      assert.equal(selector, "prose-mirror[name]");
      return [control];
    },
  };
  const events = [];
  const sheet = { _persistFormControl: event => events.push(event) };
  const listenerOptions = { signal: {} };

  bindRichTextPersistence(sheet, html, listenerOptions);
  const event = { currentTarget: control };
  listeners.get("change").listener(event);

  assert.equal(listeners.get("change").options, listenerOptions);
  assert.deepEqual(events, [event]);
});
