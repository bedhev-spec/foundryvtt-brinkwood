import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Mask uses the shared identity contract rather than an inline header implementation", async () => {
  const [sheet, portrait, name, row, tracker, styles, sharedStyles] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/sheet-identity-portrait.html"),
    read("templates/parts/sheet-identity-name.html"),
    read("templates/parts/sheet-identity-row.html"),
    read("templates/parts/sheet-identity-tracker.html"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(sheet, /class="mask-sheet__identity-block sheet-identity bw-section-frame"/);
  assert.match(sheet, /parts\/sheet-identity-portrait\.html/);
  assert.match(sheet, /parts\/sheet-identity-name\.html/);
  assert.match(sheet, /parts\/sheet-identity-row\.html" row=row editable=\.\.\/editable/);
  assert.equal((sheet.match(/parts\/sheet-identity-tracker\.html/g) ?? []).length, 2);
  assert.doesNotMatch(sheet, /mask-sheet__header|mask-sheet__portrait|mask-tracker__|mask-sheet__item-list/);
  assert.match(portrait, /data-action="editImage" data-edit="img" role="button" tabindex="0"/);
  assert.match(name, /class="name bw-text-field"/);
  assert.match(row, /class="item-delete identity-choice__remove"/);
  assert.match(row, /class="item-body item-add-popup"[\s\S]*?class="item-name identity-choice__text"/);
  assert.match(tracker, /data-path="\{\{\.\.\/trackerPath\}\}"/);
  assert.match(sharedStyles, /\.sheet-identity__portrait-frame[\s\S]*?width:\s*200px[\s\S]*?height:\s*200px/);
  assert.match(sharedStyles, /\.sheet-identity \.sheet-identity__rows\s*\{[\s\S]*?grid-auto-rows:\s*26px/);
  assert.match(styles, /\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.mask-sheet__identity\s*\{[\s\S]*?\.sheet-identity__rows\s*\{[\s\S]*?grid-auto-rows:\s*28px/);
  assert.match(styles, /\.identity-choice__value \.item-body\s*\{[\s\S]*?height:\s*28px;[\s\S]*?min-height:\s*28px/);
  assert.doesNotMatch(styles, /\.mask-sheet__(?:header|portrait|item-list|item-open)\b/);
});

test("Mask name delegates Enter and change persistence to shared helpers", async () => {
  const [controller, dom] = await Promise.all([
    read("module/blades-mask-sheet.js"),
    read("module/sheet-dom.js"),
  ]);

  assert.match(controller, /form:\s*\{\s*submitOnChange:\s*false\s*\}/);
  assert.match(controller, /"keydown",\s*handleActorNameEnter/);
  assert.match(controller, /"change", event => this\._persistFormControl\(event\)/);
  assert.match(controller, /persistActorNameChange\(this, event\)/);
  assert.match(dom, /export function handleActorNameEnter\(event\)/);
  assert.match(dom, /event\.currentTarget\?\.blur\(\)/);
  assert.match(dom, /await sheet\.document\.update\(\{ name \}, \{ render: true \}\)/);
});

test("Mask styles retain shared-tab scroll geometry without old-header compatibility rules", async () => {
  const [entrypoint, source, compiled, sheet] = await Promise.all([
    read("scss/style.scss"),
    read("scss/import/mask-sheet.scss"),
    read("styles/blades.css"),
    read("templates/mask-sheet.html"),
  ]);

  assert.match(entrypoint, /@import 'import\/sheet-identity\.scss'/);
  assert.match(entrypoint, /&\.actor\.mask\s*\{\s*@import 'import\/mask-sheet\.scss'/);
  assert.match(source, /form\.mask-sheet\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*?height:\s*100%[\s\S]*?overflow:\s*hidden/);
  assert.match(source, /\.mask-sheet__layout\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow:\s*hidden/);
  assert.match(source, /\.mask-sheet__main\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*?height:\s*100%/);
  assert.match(source, /@container \(max-width: 620px\)/);
  assert.match(source, /@container \(max-width: 410px\)/);
  assert.match(sheet, /class="mask-sheet__main sheet-tab-workspace"/);
  assert.match(sheet, /class="mask-sheet__tab-content sheet-tab-content"/);
  assert.doesNotMatch(source, /\.mask-sheet__(?:header|portrait|item-list|item-open)\b/);
  assert.match(compiled, /\.sheet-identity__portrait-frame\s*\{[\s\S]*?width:\s*200px/);
  assert.doesNotMatch(compiled, /\.brinkwood\.actor\.mask \.mask-sheet__header/);
});
