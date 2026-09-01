import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("clock defaults and schema support an optional visible GM description", async () => {
  const [template, model] = await Promise.all([
    read("template.json"),
    read("module/data/actor-data-models.js"),
  ]);
  const clock = JSON.parse(template).Actor["🕛 clock"];

  assert.equal(clock.description, "");
  assert.equal(clock.show_description, false);
  assert.match(model, /class ClockActorData[\s\S]*description:\s*new fields\.HTMLField/);
  assert.match(model, /class ClockActorData[\s\S]*show_description:\s*new fields\.BooleanField/);
});

test("standalone clock keeps viewer progress public and GM notes permission-aware", async () => {
  const [sheet, template, translations] = await Promise.all([
    read("module/blades-clock-sheet.js"),
    read("templates/actors/clock-sheet.html"),
    read("lang/en.json"),
  ]);

  assert.match(sheet, /position:\s*\{\s*width:\s*350,\s*height:\s*"auto"\s*\}/);
  assert.match(sheet, /enrichHTML\([\s\S]*relativeTo:\s*this\.document[\s\S]*secrets:\s*this\.document\.isOwner/);
  assert.doesNotMatch(sheet, /input\.disabled = true/);
  assert.match(sheet, /await super\._onRender\(context, options\)/);
  assert.match(sheet, /submitData\["prototypeToken\.texture\.src"\] = image_path/);
  assert.match(template, /clock-sheet__progress/);
  assert.match(template, /\{\{\{blades-clock "system\.value" system\.type system\.value _id \(localize "Clock\.Progress"\)\}\}\}/);
  assert.match(template, /\{\{#if isGM\}\}/);
  assert.match(template, /\{\{#if editable\}\}[\s\S]*?<prose-mirror name="system\.description" value="\{\{system\.description\}\}" document-uuid="\{\{actor\.uuid\}\}" collaborate toggled>/);
  assert.match(template, /\{\{else\}\}[\s\S]*?<div class="editor editor-content">\{\{\{enrichedDescription\}\}\}<\/div>/);
  assert.doesNotMatch(template, /\{\{editor\b/);
  assert.match(template, /name="system\.show_description"/);
  assert.match(template, /\{\{else if system\.show_description\}\}/);

  const locale = JSON.parse(translations);
  assert.equal(locale["Clock.Type"], "Clock size");
  assert.ok(locale["Clock.GMDescription"]);
  assert.ok(locale["Clock.ShowDescription"]);
  assert.ok(locale["Clock.Progress"]);
});

test("clock helper labels escape text and sanitize generated ID suffixes", async () => {
  const { prepareClockLabel } = await import("../module/clock-utils.js");
  const label = prepareClockLabel('\"><img src=x onerror=alert(1)>');

  assert.equal(label.text, "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
  assert.match(label.suffix, /^-[a-zA-Z0-9_-]+$/);
  assert.doesNotMatch(label.suffix, /[<>"']/);
});

test("standalone clock styles stay compact, scoped, and responsive", async () => {
  const [styles, stylesheet, compiled] = await Promise.all([
    read("scss/import/clocks.scss"),
    read("scss/style.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(styles, /^\/\*[\s\S]*?\n& \{/);
  assert.match(styles, /min-width:\s*320px/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width: 330px\)/);
  assert.match(styles, /@include clock\(4, 184\)/);
  assert.match(styles, /\.clock-sheet__gm-note/);
  assert.match(styles, /\.editor,[\s\S]*?prose-mirror\s*\{[\s\S]*?min-height:\s*160px/);
  assert.match(styles, /\.clock-sheet__public-description/);
  assert.match(styles, /&:focus-visible/);
  assert.match(stylesheet, /&\.actor\.clock\s*\{\s*@import 'import\/clocks\.scss';/);
  assert.match(compiled, /\.brinkwood\.actor\.clock \.clock-sheet/);
});
