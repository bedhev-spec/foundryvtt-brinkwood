import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Legacy XP updates and framing remain blue", async () => {
  const [controller, template, styles] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("templates/actor-sheet.html"),
    read("scss/import/legacy-character-effects.scss")
  ]);

  assert.match(controller, /closest\?\.\("\.character-xp, \.character-stress"\)/);
  assert.match(controller, /classList\.contains\("character-xp"\) \? "blue" : "red"/);
  assert.match(template, /big-teeth-section character-xp-section/);
  assert.match(styles, /\.character-xp-section\s*\{[\s\S]*?border-color:\s*#315f82/);
});

test("Legacy tabs receive their final equal-width layout from the base stylesheet", async () => {
  const [source, compiled] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css")
  ]);

  for (const styles of [source, compiled]) {
  assert.match(styles, /\.character-sheet__workspace[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(styles, /nav\.tabs \.item\s*\{[\s\S]*?flex:\s*1 1 0[\s\S]*?min-width:\s*0/);
  }
});

test("Legacy Notes rerender their enriched closed state after save", async () => {
  const controller = await read("module/blades-actor-sheet.js");

  assert.match(controller, /if \(!control\.matches\("prose-mirror\[name\]"\)\)/);
  assert.match(controller, /render:\s*control\.matches\("prose-mirror\[name\]"\)/);
});

test("Legacy tall tabs leave scrolling to the sheet viewport", async () => {
  const styles = await read("scss/import/legacy-character-effects.scss");

  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /form\.actor-sheet > \.bans-armor[\s\S]*?flex:\s*0 0 auto/);
  assert.match(styles, /form\.actor-sheet > \.bans-armor\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /tab-content > \.tab\[data-tab\][\s\S]*?height:\s*auto[\s\S]*?max-height:\s*none[\s\S]*?overflow:\s*visible/);
});

test("Legacy sheets reset to Traits only when genuinely closed", async () => {
  const controller = await read("module/blades-actor-sheet.js");

  assert.match(controller, /async close\(options = \{\}\)[\s\S]*?this\._sheetViewState = undefined[\s\S]*?this\.tabGroups\.primary = "traits"[\s\S]*?super\.close\(options\)/);
});

test("Bans and Armor content meets the lower frame without excess parchment space", async () => {
  const styles = await read("scss/import/character-sheet.scss");

  assert.match(styles, /\.bans-armor\s*\{[\s\S]*?padding:\s*10px 10px 0/);
});
