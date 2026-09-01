import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("release manifests target version 0.6.6", async () => {
  const [manifest, testManifest] = await Promise.all(
    ["system.json", "system-test.json"].map(async file =>
      JSON.parse(await readFile(new URL(file, root), "utf8"))
    )
  );

  assert.equal(manifest.version, "0.6.6");
  assert.equal(testManifest.version, "0.6.6");
  assert.match(manifest.download, /\/v0\.6\.6\.zip$/);
});
