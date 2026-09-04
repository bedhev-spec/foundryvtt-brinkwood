import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("character sheet has one bounded frame and an internally scrolling tab viewport", async () => {
  const [controller, styles, tabStyles, lateStyles, compiled] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
    read("scss/import/sheet-identity.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(controller, /position:\s*\{\s*width:\s*700,\s*height:\s*1170\s*\}/);
  assert.doesNotMatch(controller, /position:\s*\{[^}]*height:\s*["']auto["']/);
  assert.match(styles, /max-height:\s*calc\(100vh - 32px\)/);
  assert.match(styles, /\.window-content\s*\{[\s\S]*?height:\s*100%[\s\S]*?max-height:\s*100%[\s\S]*?display:\s*flex[\s\S]*?overflow-y:\s*hidden/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?height:\s*100%[\s\S]*?grid-template-rows:\s*auto auto auto auto minmax\(0, 1fr\)[\s\S]*?overflow:\s*hidden/);
  assert.match(styles, /form\.actor-sheet > \.name-alias,[\s\S]*?form\.actor-sheet > \.character-attributes,[\s\S]*?form\.actor-sheet > \.bans-armor\s*\{[\s\S]*?height:\s*auto[\s\S]*?align-self:\s*start[\s\S]*?flex:\s*0 0 auto/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?row-gap:\s*10px/);
  assert.match(styles, /form\.actor-sheet > \.bans-armor\s*\{[\s\S]*?margin:\s*0/);
  assert.match(styles, /form\.actor-sheet > \.character-attributes\s*\{[\s\S]*?margin-block-end:\s*-10px/);
  assert.match(styles, /character-sheet__workspace\s*\{[\s\S]*?min-height:\s*0[\s\S]*?height:\s*100%[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*?overflow:\s*hidden/);
  assert.match(styles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)[\s\S]*?min-height:\s*0[\s\S]*?height:\s*100%[\s\S]*?overflow:\s*hidden/);
  assert.match(tabStyles, /> \.tab\.active\s*\{[\s\S]*?overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain/);
  assert.match(styles, /character-sheet__workspace > \.tab-content > \.tab\[data-tab\]\.active\s*\{[\s\S]*?display:\s*flex[\s\S]*?min-height:\s*0[\s\S]*?height:\s*100%[\s\S]*?pointer-events:\s*auto/);
  assert.match(styles, /tab\[data-tab="loadout"\]\.active\s*\{[\s\S]*?position:\s*relative[\s\S]*?z-index:\s*0/);
  assert.doesNotMatch(lateStyles, /form\.actor-sheet\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\)[\s\S]*?overflow:\s*hidden/);
  assert.doesNotMatch(lateStyles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character form\.actor-sheet\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto auto minmax\(0, 1fr\)[\s\S]*?overflow:\s*hidden/);
});
