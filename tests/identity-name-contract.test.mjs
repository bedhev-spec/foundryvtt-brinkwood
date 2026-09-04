import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared identity Name fields use the shared focusable input and ApplicationV2 persistence seam", async () => {
  const [field, baseSheet, maskSheet, identity] = await Promise.all([
    read("templates/parts/sheet-identity-name.html"),
    read("module/blades-sheet.js"),
    read("module/blades-mask-sheet.js"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(field, /class="name bw-text-field"/);
  assert.match(identity, /\.bw-text-field\s*\{[\s\S]*?&:focus,[\s\S]*?&:focus-visible[\s\S]*?border-color:\s*#191813/);
  assert.match(baseSheet, /form:\s*\{\s*submitOnChange:\s*true\s*\}/);
  assert.match(maskSheet, /event\.currentTarget\?\.blur\(\)/);
  const handler = maskSheet.match(/export function handleMaskNameEnter\(event\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(handler);
  assert.doesNotMatch(handler, /(?:document|actor)\.update\(/);
});
