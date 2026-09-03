import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Mask sheet uses compact, accessible, controller-compatible markup", async () => {
  const [sheet, attributes] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/mask-attributes.html")
  ]);

  assert.match(sheet, /class="\{\{cssClass\}\} actor-sheet mask-sheet"/);
  assert.match(sheet, /data-action="editImage" data-edit="img"/);
  assert.match(sheet, /class="dot-value" data-path="experience\.value"/);
  assert.match(sheet, /class="dot-value" data-path="essence\.value"/);
  assert.match(sheet, /data-group="primary" role="tablist"/);
  assert.match(sheet, /data-action="tab"[^>]*role="tab"[^>]*aria-controls="mask-\{\{_id\}\}-panel-traits"/);
  assert.match(sheet, /data-tab="traits"[^>]*role="tabpanel"[^>]*aria-labelledby="mask-\{\{_id\}\}-tab-traits"/);
  assert.match(sheet, /class="tab mask-sheet__panel mask-sheet__notes[^>]*data-tab="mask-notes"/);
  assert.match(sheet, /data-tab="effects"[\s\S]*?parts\/active-effects\.html/);
  assert.match(sheet, /class="item-body mask-sheet__item-open"/);
  assert.match(sheet, /class="item-control item-delete identity-choice__remove"[\s\S]*?<span aria-hidden="true">&times;<\/span>/);
  assert.doesNotMatch(sheet, /item-control item-delete"[^>]*><i class="fas fa-trash"/);
  assert.match(sheet, /class="item-select mask-trait-card__select"/);
  assert.match(sheet, /class="mask-sheet__section-heading"[\s\S]*?class="item-add-popup" data-item-type="trait"/);
  assert.doesNotMatch(sheet, /id="mask-\{\{_id\}\}-traits"/);
  assert.doesNotMatch(attributes, /character-\{\{/);
  assert.match(attributes, /localize maskAttributesLabel/);
  assert.doesNotMatch(attributes, /concat system\.type_lang 'Short'/);
  assert.match(attributes, /data-path="attributes\.\{\{\.\.\/\.\.\/system\.type\}\}\.skills/);
  assert.match(attributes, /class="attribute-skill-label roll-die-attribute rollable-text"/);
});

test("Mask sheet delegates encumbrance policy to the shared calculation", async () => {
  const controller = await read("module/blades-mask-sheet.js");

  assert.match(controller, /from "\.\/encumbrance\.js"/);
  assert.match(controller, /encumbranceLevelForLoadout\(loadout, hasMuleAbility\(context\.items\)\)/);
  assert.doesNotMatch(controller, /const load_level\s*=/);
  assert.doesNotMatch(controller, /\(C\) Mule/);
});

test("Mask styles are scoped and adapt to the sheet container", async () => {
  const [entrypoint, source, compiled, sheet] = await Promise.all([
    read("scss/style.scss"),
    read("scss/import/mask-sheet.scss"),
    read("styles/blades.css"),
    read("templates/mask-sheet.html")
  ]);

  assert.match(entrypoint, /&\.actor\.mask\s*\{\s*@import 'import\/mask-sheet\.scss'/);
  assert.match(source, /form\.mask-sheet\s*\{[\s\S]*container-type:\s*inline-size/);
  assert.match(source, /@container \(max-width: 620px\)/);
  assert.match(source, /@container \(max-width: 390px\)/);
  assert.match(source, /\.mask-sheet__layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?width:\s*100%/);
  assert.match(source, /\.mask-sheet__main\s*\{[\s\S]*?box-sizing:\s*border-box[\s\S]*?width:\s*100%/);
  assert.match(source, /\.mask-sheet__panel\s*\{[\s\S]*?width:\s*100%[\s\S]*?\.effects-groups\s*\{[\s\S]*?width:\s*100%/);
  assert.match(source, /\.mask-sheet__traits-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(190px, 0\.42fr\)/);
  assert.match(sheet, /data-tab="traits"[\s\S]*?class="mask-sheet__traits-workspace"[\s\S]*?parts\/mask-attributes\.html/);
  assert.match(source, /\.editor,[\s\S]*?\.editor-content,[\s\S]*?prose-mirror\s*\{[\s\S]*?min-height:\s*180px/);
  assert.match(source, /\.mask-sheet__notes\s*\{[\s\S]*?min-height:\s*160px/);
  assert.match(source, /\.mask-attributes > h2\s*\{/);
  assert.match(source, /\.mask-sheet__section-heading\s*\{[\s\S]*?justify-content:\s*space-between/);
  assert.match(source, /\.mask-sheet__panel\[data-tab="effects"\][\s\S]*?\.effects-category\s*\{[\s\S]*?display:\s*block/);
  assert.match(source, /\.mask-sheet__item \.identity-choice__remove\s*\{/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(compiled, /\.brinkwood\.actor\.mask \.mask-sheet__header/);
  assert.match(compiled, /@container \(max-width: 620px\)/);
});
