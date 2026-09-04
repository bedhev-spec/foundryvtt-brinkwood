import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderDescriptionTooltip, renderItemTooltip } from "../module/item-tooltip.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("selected identity values use prepared shared HTML tooltips", async () => {
  const [template, identityRow, controller] = await Promise.all([
    read("templates/actor-sheet.html"), read("templates/parts/sheet-identity-row.html"), read("module/blades-actor-sheet.js"),
  ]);
  assert.equal((template.match(/parts\/sheet-identity-row\.html/g) ?? []).length, 1);
  assert.match(identityRow, /tooltip tooltip-trigger--plain/);
  assert.match(identityRow, /data-tooltip-html="\{\{row\.item\.identityTooltipHtml\}\}"/);
  assert.match(identityRow, /data-tooltip-class="brinkwood-item-tooltip-shell"/);
  assert.match(controller, /identityDefinitions[\s\S]*?itemType: "upbringing"[\s\S]*?descriptionRoot: "Actor\.Upbringings"[\s\S]*?itemType: "profession"[\s\S]*?descriptionRoot: "Actor\.Professions"[\s\S]*?itemType: "class"[\s\S]*?descriptionRoot: "Actor\.Classes"[\s\S]*?itemType: "pact"[\s\S]*?descriptionRoot: "Actor\.Pacts"/);
  assert.match(controller, /identityTooltipHtml = renderDescriptionTooltip\(/);
  assert.doesNotMatch(controller, /identityTooltipHtml = escapeHTML/);
});

test("item-picker help preserves Foundry-enriched rich text without double encoding", () => {
  const enriched = [];
  const tooltip = renderItemTooltip(
    { name: "Apprentice", type: "upbringing", system: { description: '<p>Learned &rsquo;<strong>the craft</strong>.<script>bad()</script></p>' } },
    key => key,
    value => { enriched.push(value); return value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ""); },
  );
  assert.equal(enriched.length, 1);
  assert.match(tooltip, /<p>Learned &rsquo;<strong>the craft<\/strong>\.<\/p>/);
  assert.doesNotMatch(tooltip, /&lt;p&gt;|&amp;rsquo;|<script|bad\(\)/);
});

test("description-only identity tooltips retain readable paragraph structure", () => {
  const tooltip = renderDescriptionTooltip("First sentence. Second sentence. Third sentence. Fourth sentence.");
  assert.match(tooltip, /brinkwood-item-tooltip--description-only/);
  assert.match(tooltip, /<p>First sentence\. Second sentence\.<\/p><p>Third sentence\. Fourth sentence\.<\/p>/);
});

test("the picker enriches once and delegates Mask tooltip policy", async () => {
  const [sheet, maskSheet] = await Promise.all([read("module/blades-sheet.js"), read("module/blades-mask-sheet.js")]);
  assert.match(sheet, /TextEditor\.implementation\.enrichHTML\([\s\S]*?String\(e\.system\.description \?\? ""\)[\s\S]*?this\.document[\s\S]*?this\.document\.isOwner/);
  assert.match(sheet, /const itemTooltip = escapeHTML\(this\._renderItemPickerTooltip\(e, enrichedDescription\)\)/);
  assert.match(sheet, /_renderItemPickerTooltip\(item, enrichedDescription\)[\s\S]*?renderItemTooltip\([\s\S]*?\(\) => enrichedDescription/);
  assert.match(maskSheet, /_renderItemPickerTooltip\(item, enrichedDescription\)[\s\S]*?renderMaskPickerTooltip\(item, enrichedDescription\)/);
});

test("item-picker tooltip styles preserve paragraph spacing", async () => {
  const styles = await read("scss/import/tooltip.scss");
  assert.match(styles, /\.tooltip\[data-tooltip-html\]:not\(\.tooltip-trigger--plain\)\s*\{[\s\S]*?padding:\s*4px/);
  assert.doesNotMatch(styles, /\.tooltip\[data-tooltip-html\]\s*\{[\s\S]*?padding:\s*4px/);
  assert.match(styles, /brinkwood-item-tooltip-shell[\s\S]*?font-size:\s*17px[\s\S]*?line-height:\s*1\.35/);
  assert.match(styles, /\.brinkwood-item-tooltip\s*\{\s*font-size:\s*inherit;/);
  assert.match(styles, /\.brinkwood-item-tooltip header\s*\{[\s\S]*?font-size:\s*calc\(1\.15rem \+ 2px\)/);
  assert.doesNotMatch(styles, /aside#tooltip\.brinkwood-tooltip\s*\{[^}]*font-size:\s*17px/);
  assert.match(styles, /\.brinkwood-item-tooltip__description\s*\{[\s\S]*?margin-top:\s*8px/);
  assert.match(styles, /\.brinkwood-item-tooltip__description[\s\S]*?p\s*\{[\s\S]*?margin:\s*0 0 \.8em/);
});
