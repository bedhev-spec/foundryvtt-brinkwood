import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("branch package and test manifests target version 0.6.10", async () => {
  const [manifest, testManifest] = await Promise.all(
    ["system.json", "system-test.json"].map(async file =>
      JSON.parse(await readFile(new URL(file, root), "utf8"))
    )
  );

  assert.equal(manifest.version, "0.6.10");
  assert.equal(testManifest.version, "0.6.10");
  assert.match(manifest.manifest, /codex\/redesign-character-sheet-ui\/system-test\.json$/);
  assert.match(manifest.download, /codex\/redesign-character-sheet-ui\.zip$/);
  assert.match(testManifest.manifest, /codex\/redesign-character-sheet-ui\/system-test\.json$/);
  assert.match(testManifest.download, /codex\/redesign-character-sheet-ui\.zip$/);
});
