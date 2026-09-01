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
  assert.match(template, /\{\{editor content=system\.description target="system\.description" button=true owner=owner editable=editable documents=true engine="prosemirror" collaborate=true\}\}/);
  assert.match(template, /\{\{editor content=system\.notes target="system\.notes" button=true owner=owner editable=editable documents=true engine="prosemirror" collaborate=true\}\}/);
  assert.doesNotMatch(template, /data-group=|data-tab=/);
});

test("NPC dossier styles are scoped, responsive, and keyboard visible", async () => {
  const [styles, stylesheet] = await Promise.all([
    read("scss/import/npc-sheet.scss"),
    read("scss/style.scss"),
  ]);

  assert.match(styles, /^\/\*[\s\S]*?\n& \{/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width: 620px\)/);
  assert.match(styles, /@container \(max-width: 430px\)/);
  assert.match(styles, /var\(--bw-(?:paper|ink|rule|focus)\)/);
  assert.match(styles, /&:focus-visible/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(stylesheet, /&\.actor\.npc\s*\{\s*@import 'import\/npc-sheet\.scss';/);
});

test("NPC controller opts into the scoped dossier class without a redundant render hook", async () => {
  const source = await read("module/blades-npc-sheet.js");
  assert.match(source, /classes:\s*\[[^\]]*"npc"[^\]]*\]/);
  assert.doesNotMatch(source, /async _onRender\(context, options\)/);
});
