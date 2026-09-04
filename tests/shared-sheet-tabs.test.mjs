import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared tab component owns character and Mask strip geometry and states", async () => {
  const [component, generalStyles, legacyEffects, legacyPolish] = await Promise.all([
    read("scss/import/sheet-tabs.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/legacy-character-effects.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
  ]);

  assert.match(generalStyles, /@import 'sheet-tabs\.scss';/);
  assert.match(component, /\.character-sheet__workspace > nav\.tabs/);
  assert.match(component, /\.sheet-tabs,[\s\S]*?width:\s*100%[\s\S]*?border:\s*1px solid var\(--bw-rule\)/);
  assert.match(component, /\.sheet-tabs \.item,[\s\S]*?flex:\s*1 1 0[\s\S]*?text-align:\s*center/);
  assert.match(component, /\.mask-sheet__tabs/);
  assert.match(component, /\.sheet-tab-workspace\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(component, /\.sheet-tab-content[\s\S]*?> \.tab\.active[\s\S]*?overflow-y:\s*auto/);
  assert.match(component, /border-bottom-color:\s*var\(--bw-accent\)/);
  assert.match(component, /\.effects-tab\s*\{[\s\S]*?transition:/);
  assert.match(component, /\.effects-tab[\s\S]*?&\.active\s*\{[\s\S]*?background:/);
  assert.match(component, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(component, /\.effects-category\[data-effect-panel\]/);
  assert.doesNotMatch(component, /grid-template-columns/);
  assert.doesNotMatch(legacyEffects, /\.effects-tab(?::hover|:focus-visible|\.active)/);
  assert.doesNotMatch(legacyPolish, /character-sheet__workspace > nav\.tabs \.item\.active/);
});
