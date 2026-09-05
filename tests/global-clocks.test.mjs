import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GLOBAL_CLOCK_MAX_SIZE,
  nextGlobalClockValue,
  normalizeGlobalClock,
  previousGlobalClockValue,
} from "../module/global-clock-utils.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("global clocks normalize progress without tracker or point types", () => {
  assert.deepEqual(normalizeGlobalClock({ name: " Alarm ", value: 9, max: 6 }), {
    id: null,
    name: "Alarm",
    value: 6,
    max: 6,
    color: "#8f2f35",
    backgroundColor: "rgba(20, 16, 18, 0.78)",
    private: false,
  });
  assert.equal(normalizeGlobalClock({ max: 999 }).max, GLOBAL_CLOCK_MAX_SIZE);
});

test("global clock interaction wraps in both directions", () => {
  assert.equal(nextGlobalClockValue(3, 4), 4);
  assert.equal(nextGlobalClockValue(4, 4), 0);
  assert.equal(previousGlobalClockValue(1, 4), 0);
  assert.equal(previousGlobalClockValue(0, 4), 4);
});

test("the integrated overlay contains clocks only and retains attribution", async () => {
  const [controller, panel, dialog, styles, notices, bootstrap] = await Promise.all([
    read("module/global-clocks.js"),
    read("templates/overlay/global-clocks.html"),
    read("templates/overlay/global-clock-dialog.html"),
    read("scss/import/global-clocks.scss"),
    read("THIRD_PARTY_NOTICES.md"),
    read("module/blades.js"),
  ]);

  const implementation = [controller, panel, dialog, styles].join("\n");
  assert.doesNotMatch(implementation, /addTracker|addPoints|points-element|tracker-element|Sortable|gsap/);
  assert.match(controller, /Carlos Fernandez \(Supe\)/);
  assert.match(controller, /escapeHTML\(clock\.name\)/);
  assert.match(controller, /#mutationQueue/);
  assert.match(controller, /this\.store\.step\(event\.currentTarget\.dataset\.clockId, 1\)/);
  assert.match(controller, /this\.store\.step\(event\.currentTarget\.dataset\.clockId, -1\)/);
  assert.match(controller, /html\.dataset\.location = context\.location/);
  assert.match(controller, /toggleVisibility: GlobalClockOverlay\.#onToggleVisibility/);
  assert.match(controller, /togglePrivate\(id\)/);
  assert.match(controller, /clock\.private = !clock\.private/);
  assert.match(controller, /this\.store\.togglePrivate\(clock\.id\)/);
  assert.match(panel, /data-action="toggleVisibility"/);
  assert.match(panel, /data-tooltip=/);
  assert.match(panel, /BITD\.GlobalClock\.(?:Hide|Show)/);
  assert.match(styles, /@media \(hover: none\)/);
  assert.match(styles, /&\[data-location="topRight"\]/);
  assert.match(notices, /Copyright \(c\) 2023 Carlos Fernandez/);
  assert.match(notices, /Lunar-Dawn/);
  assert.match(panel, /global-clock__face/);
  assert.match(bootstrap, /registerGlobalClockSystem\(\)/);
  assert.match(bootstrap, /await startGlobalClockSystem\(\)/);
});
