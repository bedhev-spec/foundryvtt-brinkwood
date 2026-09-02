import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("release and branch manifests target version 0.6.11", async () => {
  const [manifest, testManifest] = await Promise.all(
    ["system.json", "system-test.json"].map(async file =>
      JSON.parse(await readFile(new URL(file, root), "utf8"))
    )
  );

  assert.equal(manifest.version, "0.6.11");
  assert.equal(testManifest.version, "0.6.11");
  assert.match(manifest.manifest, /master\/system\.json$/);
  assert.match(manifest.download, /tags\/v0\.6\.11\.zip$/);
  assert.match(testManifest.manifest, /codex\/legacy-sheet-fixes\/system-test\.json$/);
  assert.match(testManifest.download, /codex\/legacy-sheet-fixes\.zip$/);
});
