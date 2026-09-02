import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("NPC sheet is a compact editable dossier with v13 editor panels", async () => {
  const template = await read("templates/npc-sheet.html");

  assert.match(template, /class="\{\{cssClass\}\} actor-sheet npc-dossier"/);
  assert.match(template, /class="npc-dossier__portrait"[\s\S]*?\{\{#if editable\}\} data-action="editImage" data-edit="img"/);
  assert.match(template, /id="npc-\{\{_id\}\}-name" name="name" value="\{\{name\}\}"\{\{#unless editable\}\} disabled/);
  for (const field of ["description_short", "associated_class", "associated_faction", "associated_crew_type"]) {
    assert.match(template, new RegExp(`name="system\\.${field}" value="\\{\\{system\\.${field}\\}\\}"\\{\\{#unless editable\\}\\} disabled`));
  }
  assert.match(template, /aria-labelledby="npc-\{\{_id\}\}-profile-heading"/);
  assert.match(template, /<prose-mirror name="system\.description" value="\{\{system\.description\}\}" data-document-uuid="\{\{actor\.uuid\}\}" collaborate toggled>/);
  assert.match(template, /<prose-mirror name="system\.notes" value="\{\{system\.notes\}\}" data-document-uuid="\{\{actor\.uuid\}\}" collaborate toggled>/);
  assert.match(template, /<div class="editor editor-content">\{\{\{enrichedDescription\}\}\}<\/div>/);
  assert.match(template, /<div class="editor editor-content">\{\{\{enrichedNotes\}\}\}<\/div>/);
  assert.doesNotMatch(template, /\{\{editor\b/);
  assert.doesNotMatch(template, /data-group=|data-tab=/);
});

test("NPC dossier styles are scoped, responsive, and keyboard visible", async () => {
  const [styles, stylesheet] = await Promise.all([
    read("scss/import/npc-sheet.scss"),
    read("scss/style.scss"),
  ]);

  assert.match(styles, /^\/\*[\s\S]*?\n& \{/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width: 560px\)/);
  assert.match(styles, /@container \(max-width: 430px\)/);
  assert.match(styles, /var\(--bw-(?:paper|ink|rule|focus)\)/);
  assert.match(styles, /&:focus-visible/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.editor,[\s\S]*?prose-mirror\s*\{[\s\S]*?min-height:\s*160px/);
  assert.match(styles, /max-width:\s*640px/);
  assert.match(styles, /grid-template-columns:\s*72px minmax\(0, 1fr\)/);
  assert.match(styles, /width:\s*72px/);
  assert.match(styles, /height:\s*72px/);
  assert.match(stylesheet, /&\.actor\.npc\s*\{\s*@import 'import\/npc-sheet\.scss';/);
});

test("NPC controller opts into the scoped dossier class without a redundant render hook", async () => {
  const source = await read("module/blades-npc-sheet.js");
  assert.match(source, /classes:\s*\[[^\]]*"npc"[^\]]*\]/);
  assert.match(source, /position:\s*\{\s*width:\s*640\s*\}/);
  assert.match(source, /static PARTS\s*=/);
  assert.doesNotMatch(source, /defaultOptions|activateListeners|render\(true\)/);
  assert.doesNotMatch(source, /async _onRender\(context, options\)/);
});
