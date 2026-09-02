import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: class {} }
  }
};

const { readItemPickerSelection } = await import("../module/blades-sheet.js");

test("item picker reads checked radios from the DialogV2 element when the action button has no form", () => {
  const checked = [{ value: "upbringing-apprentice" }];
  const dialog = {
    element: {
      querySelector(selector) {
        assert.equal(selector, "form");
        return {
          querySelectorAll(inputSelector) {
            assert.equal(inputSelector, ".items-to-add input:checked");
            return checked;
          },
          querySelector(inputSelector) {
            assert.equal(inputSelector, ".items-to-add");
            return {};
          }
        };
      }
    }
  };

  assert.deepEqual(readItemPickerSelection({ form: null }, dialog), ["upbringing-apprentice"]);
});

test("item picker ignores an unrelated action-button form and uses the DialogV2 picker form", () => {
  const unrelatedForm = {
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const pickerForm = {
    querySelectorAll() { return [{ value: "upbringing-apprentice" }]; },
    querySelector(selector) { return selector === ".items-to-add" ? {} : null; }
  };
  const dialog = { element: { querySelector: () => pickerForm } };

  assert.deepEqual(readItemPickerSelection({ form: unrelatedForm }, dialog), ["upbringing-apprentice"]);
});
