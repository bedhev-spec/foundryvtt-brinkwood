import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production and test manifests target their intended versions", async () => {
  const [manifest, testManifest] = await Promise.all(
    ["system.json", "system-test.json"].map(async file =>
      JSON.parse(await readFile(new URL(file, root), "utf8"))
    )
  );

  assert.equal(manifest.version, "0.6.9");
  assert.equal(testManifest.version, "0.6.10");
  assert.match(manifest.download, /\/v0\.6\.9\.zip$/);
  assert.match(testManifest.manifest, /codex\/redesign-character-sheet-ui\/system-test\.json$/);
  assert.match(testManifest.download, /codex\/redesign-character-sheet-ui\.zip$/);
});
