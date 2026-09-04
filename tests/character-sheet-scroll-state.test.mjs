import assert from "node:assert/strict";
import test from "node:test";
import { captureSheetViewState, restoreSheetViewState } from "../module/sheet-view-state.js";

test("character view state restores only the inner tab viewport", () => {
  const form = { scrollTop: 212, scrollLeft: 8 };
  const windowContent = { scrollTop: 61, scrollLeft: 4 };
  const tabViewport = { scrollTop: 145, scrollLeft: 2, dataset: { tab: "downtime" } };
  const root = {
    matches: () => false,
    closest: selector => selector === ".window-content" ? windowContent : null,
    querySelector(selector) {
      if (selector === ".sheet-tab-content > .tab.active") return tabViewport;
      if (selector === ".sheet-tab-content") return {};
      if (selector === "form.actor-sheet") return form;
      if (selector === '.tab[data-group="primary"].active') return tabViewport;
      return null;
    },
  };

  const state = captureSheetViewState(root);
  assert.deepEqual(state.scrollPositions, { tab: { scrollTop: 145, scrollLeft: 2 } });
  form.scrollTop = 99;
  windowContent.scrollTop = 33;
  tabViewport.scrollTop = 0;
  restoreSheetViewState(root, state);
  assert.equal(tabViewport.scrollTop, 145);
  assert.equal(form.scrollTop, 0);
  assert.equal(windowContent.scrollTop, 0);
});
