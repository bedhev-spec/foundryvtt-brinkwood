import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderDescriptionTooltip, renderItemTooltip } from "../module/item-tooltip.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("identity labels expose only documented grant summaries", async () => {
  const template = await read("templates/actor-sheet.html");

  for (const [type, key] of [
    ["upbringing", "BITD.UpbringingGrantSummary"],
    ["profession", "BITD.ProfessionGrantSummary"],
    ["class", "BITD.ClassGrantSummary"],
  ]) {
    assert.match(template, new RegExp(`data-item-type="${type}"[\\s\\S]*?data-tooltip="${key}"`));
  }
  assert.match(template, /data-item-type="pact"/);
  assert.doesNotMatch(template, /data-item-type="pact"[\s\S]*?GrantSummary/);
});

test("item-picker help preserves Foundry-enriched rich text without double encoding", async () => {
  const enriched = [];
  const tooltip = renderItemTooltip(
    {
      name: "Apprentice",
      type: "upbringing",
      system: { description: '<p>Learned &rsquo;<strong>the craft</strong>.<script>bad()</script></p>' },
    },
    key => key,
    value => {
      enriched.push(value);
      return value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    },
  );

  assert.deepEqual(enriched, ['<p>Learned &rsquo;<strong>the craft</strong>.<script>bad()</script></p>']);
  assert.match(tooltip, /<p>Learned &rsquo;<strong>the craft<\/strong>\.<\/p>/);
  assert.doesNotMatch(tooltip, /&lt;p&gt;|&amp;rsquo;/);
  assert.doesNotMatch(tooltip, /<script|bad\(\)/);
  assert.doesNotMatch(tooltip, /GrantSummary/);
});

test("item-picker help omits empty stats and breaks long prose into real paragraphs", () => {
  const tooltip = renderItemTooltip(
    {
      name: "Alchemist",
      type: "profession",
      system: {
        description: "<p>First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.</p>",
      },
    },
    key => key,
    value => value,
  );

  assert.doesNotMatch(tooltip, /brinkwood-item-tooltip__stats/);
  assert.match(tooltip, /<p>First sentence\. Second sentence\.<\/p><p>Third sentence\. Fourth sentence\.<\/p><p>Fifth sentence\.<\/p>/);
});

test("selected identity tooltip reuses the shared paragraph renderer", () => {
  const tooltip = renderDescriptionTooltip(
    "First sentence. Second sentence. Third sentence. Fourth sentence.",
  );

  assert.match(tooltip, /brinkwood-item-tooltip--description-only/);
  assert.match(tooltip, /<p>First sentence\. Second sentence\.<\/p><p>Third sentence\. Fourth sentence\.<\/p>/);
});

test("picker uses Foundry rich-text enrichment before safely transporting tooltip HTML", async () => {
  const sheet = await read("module/blades-sheet.js");

  assert.match(sheet, /TextEditor\.implementation\.enrichHTML\([\s\S]*?String\(e\.system\.description \?\? ""\)[\s\S]*?this\.document[\s\S]*?this\.document\.isOwner/);
  assert.match(sheet, /renderItemTooltip\([\s\S]*?\(\) => enrichedDescription/);
  assert.match(sheet, /const itemTooltip = escapeHTML\(renderItemTooltip/);
});

test("item-picker tooltip descriptions keep readable paragraph spacing", async () => {
  const styles = await read("scss/import/tooltip.scss");

  assert.match(styles, /brinkwood-item-tooltip-shell[\s\S]*?line-height:\s*1\.35/);
  assert.match(styles, /\.brinkwood-item-tooltip__description\s*\{[\s\S]*?margin-top:\s*8px/);
  assert.match(styles, /\.brinkwood-item-tooltip__description[\s\S]*?p\s*\{[\s\S]*?margin:\s*0 0 \.8em[\s\S]*?&:last-child\s*\{[\s\S]*?margin-bottom:\s*0/);
  assert.match(styles, /\.brinkwood-item-tooltip__stats \+ \.brinkwood-item-tooltip__description\s*\{[\s\S]*?padding-top:\s*7px[\s\S]*?border-top:\s*1px solid/);
  assert.match(styles, /\.brinkwood-item-tooltip > p\s*\{/);
});

test("selected identity values use prepared shared HTML tooltips", async () => {
  const [template, controller] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("module/blades-actor-sheet.js"),
  ]);

  assert.equal((template.match(/data-tooltip-html="{{item\.identityTooltipHtml}}"/g) ?? []).length, 4);
  assert.equal((template.match(/data-tooltip-class="brinkwood-item-tooltip-shell"/g) ?? []).length, 4);
  assert.match(controller, /identityDescriptionRoots[\s\S]*?upbringing: "Actor\.Upbringings"[\s\S]*?profession: "Actor\.Professions"[\s\S]*?class: "Actor\.Classes"[\s\S]*?pact: "Actor\.Pacts"/);
  assert.match(controller, /renderDescriptionTooltip\(game\.i18n\.localize\(`/);
});
