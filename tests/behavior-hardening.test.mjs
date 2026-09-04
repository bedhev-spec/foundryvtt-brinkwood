import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.Hooks = { on() {} };
globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: {
      ActorSheetV2: class {
        async _onRender() {}
        async _processSubmitData(event, form, submitData, options) {
          return { event, form, submitData, options };
        }
      },
      ItemSheetV2: class { async _onRender() {} }
    },
  },
  data: { fields: {} },
  dice: { Roll: {} },
  documents: {
    ActiveEffect: class {},
  },
  utils: {
    mergeObject: (target, source) => ({ ...target, ...source }),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object)
  }
};
globalThis.CONST = { ACTIVE_EFFECT_MODES: { CUSTOM: 0 } };
globalThis.game = { user: { isGM: false }, scenes: { current: null } };

const { BladesActiveEffect } = await import("../module/blades-active-effect.js");
const { BladesSheet } = await import("../module/blades-sheet.js");
const { BladesActorSheet, prepareLoadoutCapacity } = await import("../module/blades-actor-sheet.js");
const { BladesItemSheet, prepareItemSheetPermissions } = await import("../module/blades-item-sheet.js");
const { BladesMaskSheet, getMaskTypePresentation, MASK_SHEET_DEFAULT_WIDTH, maskSheetWidthForAttributes } = await import("../module/blades-mask-sheet.js");
const { formControlUpdate, queueDocumentPathUpdate } = await import("../module/sheet-dom.js");
const { syncOpenActorTrackers } = await import("../module/sheet-tracker-sync.js");
const { BladesRebelionSheet } = await import("../module/blades-rebelion-sheet.js");

test("Mask context validates its primary tab immediately after the base context", async () => {
  const source = await readFile(new URL("../module/blades-mask-sheet.js", import.meta.url), "utf8");
  assert.match(source, /async _prepareContext\(options\)\s*\{\s*const context = await super\._prepareContext\(options\);\s*this\._ensureValidPrimaryTab\(context\);/);
});

test("Mask primary tabs default to Traits and preserve valid remembered selections", () => {
  const sheet = { tabGroups: { primary: undefined } };
  const initialContext = { isGM: false, tabs: { primary: undefined } };

  BladesMaskSheet.prototype._ensureValidPrimaryTab.call(sheet, initialContext);
  assert.equal(sheet.tabGroups.primary, "traits");
  assert.equal(initialContext.tabs.primary, "traits");

  // A normal tab switch survives the next context preparation.
  sheet.tabGroups.primary = "mask-notes";
  const notesContext = { isGM: false, tabs: { primary: "mask-notes" } };
  BladesMaskSheet.prototype._ensureValidPrimaryTab.call(sheet, notesContext);
  assert.equal(sheet.tabGroups.primary, "mask-notes");
  assert.equal(notesContext.tabs.primary, "mask-notes");

  // Effects is a remembered tab only while that tab is available to a GM.
  sheet.tabGroups.primary = "effects";
  const effectsContext = { isGM: true, tabs: { primary: "effects" } };
  BladesMaskSheet.prototype._ensureValidPrimaryTab.call(sheet, effectsContext);
  assert.equal(sheet.tabGroups.primary, "effects");
  assert.equal(effectsContext.tabs.primary, "effects");

  const unavailableEffectsContext = { isGM: false, tabs: { primary: "effects" } };
  BladesMaskSheet.prototype._ensureValidPrimaryTab.call(sheet, unavailableEffectsContext);
  assert.equal(sheet.tabGroups.primary, "traits");
  assert.equal(unavailableEffectsContext.tabs.primary, "traits");
});

test("Mask Type availability resizes only on transitions and preserves manual sizing during configured rerenders", async () => {
  assert.equal(MASK_SHEET_DEFAULT_WIDTH, 700);
  assert.equal(maskSheetWidthForAttributes(700, undefined), 720);
  assert.equal(maskSheetWidthForAttributes(700, 880), 720);
  assert.equal(maskSheetWidthForAttributes(980, 880), 980);

  const positions = [];
  const sheet = {
    position: { width: 700 },
    setPosition(position) {
      positions.push(position);
      this.position.width = position.width;
    },
    _expandForMaskAttributes: BladesMaskSheet.prototype._expandForMaskAttributes,
    _shrinkForMaskAttributes: BladesMaskSheet.prototype._shrinkForMaskAttributes,
    _resizeForMaskAttributes: BladesMaskSheet.prototype._resizeForMaskAttributes,
    _startMaskAttributeResizeTransition() { return null; },
  };

  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, false);
  assert.deepEqual(positions, []);

  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, true);
  assert.deepEqual(positions, [{ width: 720 }]);

  // A user can make the configured sheet narrower or wider. Re-renders must
  // preserve both instead of restoring the automatic target width.
  sheet.position.width = 760;
  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, true);
  assert.deepEqual(positions, [{ width: 720 }]);

  sheet.position.width = 980;
  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, true);
  assert.deepEqual(positions, [{ width: 720 }]);

  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, false);
  assert.deepEqual(positions, [{ width: 720 }, { width: 700 }]);
  assert.equal(sheet.position.width, 700);

  // A newly selected Mask Type may expand again after removal.
  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, true);
  assert.deepEqual(positions, [{ width: 720 }, { width: 700 }, { width: 720 }]);

  await BladesMaskSheet.prototype._syncMaskAttributeAvailability.call(sheet, false);
  assert.deepEqual(positions, [{ width: 720 }, { width: 700 }, { width: 720 }, { width: 700 }]);
});

test("automatic Mask resize transition is transient and honors reduced motion", () => {
  const classes = new Set();
  const listeners = new Map();
  const frame = {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
    },
    closest() { return this; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const sheet = { element: frame };
  const previousMatchMedia = globalThis.matchMedia;

  try {
    globalThis.matchMedia = () => ({ matches: false });
    BladesMaskSheet.prototype._startMaskAttributeResizeTransition.call(sheet);
    assert.equal(classes.has("mask-sheet--attribute-resizing"), true);
    listeners.get("transitionend")({ target: frame, propertyName: "width" });
    assert.equal(classes.has("mask-sheet--attribute-resizing"), false);

    globalThis.matchMedia = () => ({ matches: true });
    assert.equal(BladesMaskSheet.prototype._startMaskAttributeResizeTransition.call(sheet), null);
    assert.equal(classes.has("mask-sheet--attribute-resizing"), false);
  } finally {
    globalThis.matchMedia = previousMatchMedia;
  }
});

function effectEvent(action = "create", effectId = null, effectType = "passive") {
  return {
    prevented: false,
    preventDefault() { this.prevented = true; },
    currentTarget: {
      dataset: { effectAction: action },
      closest(selector) {
        if (selector === "[data-effect-type]") return { dataset: { effectType } };
        if (selector === "[data-effect-id]" && effectId) return { dataset: { effectId } };
        return null;
      }
    }
  };
}

test("character loadout context exposes normalized declared capacity without document writes", () => {
  assert.deepEqual(prepareLoadoutCapacity(3, "BITD.Light"), {
    selectedLoadLevel: "BITD.Light",
    loadoutCapacity: 3,
    isLoadoutOverloaded: false,
  });
  assert.deepEqual(prepareLoadoutCapacity(6, "BITD.Normal"), {
    selectedLoadLevel: "BITD.Normal",
    loadoutCapacity: 5,
    isLoadoutOverloaded: true,
  });
  assert.deepEqual(prepareLoadoutCapacity(6, "BITD.Heavy"), {
    selectedLoadLevel: "BITD.Heavy",
    loadoutCapacity: 6,
    isLoadoutOverloaded: false,
  });
  assert.deepEqual(prepareLoadoutCapacity(0, ""), {
    selectedLoadLevel: "BITD.Light",
    loadoutCapacity: 3,
    isLoadoutOverloaded: false,
  });
});

test("item Load remains GM-only, including owned actor items", () => {
  const embedded = {
    isEmbedded: true,
    parent: { documentName: "Actor", isOwner: true },
  };

  assert.deepEqual(prepareItemSheetPermissions(embedded, { isGM: false, sheetEditable: true }), {
    canEditFields: false,
    canEditLoad: false,
  });
  assert.deepEqual(prepareItemSheetPermissions({ isEmbedded: false }, { isGM: false, sheetEditable: true }), {
    canEditFields: false,
    canEditLoad: false,
  });
  assert.deepEqual(prepareItemSheetPermissions({ ...embedded, parent: { documentName: "Actor", isOwner: false } }, { isGM: false, sheetEditable: false }), {
    canEditFields: false,
    canEditLoad: false,
  });
  assert.deepEqual(prepareItemSheetPermissions({ isEmbedded: false }, { isGM: true, sheetEditable: true }), {
    canEditFields: true,
    canEditLoad: true,
  });
});

test("effect mutations require ownership and respect GM-only sheet policy", async () => {
  const created = [];
  const owner = {
    isOwner: true,
    uuid: "Actor.effect-owner",
    effects: new Map(),
    createEmbeddedDocuments: async (...args) => created.push(args)
  };

  const deniedByPolicy = effectEvent();
  await BladesActiveEffect.onManageActiveEffect(deniedByPolicy, owner, { gmOnly: true });
  assert.equal(deniedByPolicy.prevented, true);
  assert.equal(created.length, 0);

  const ownerAllowed = effectEvent();
  await BladesActiveEffect.onManageActiveEffect(ownerAllowed, owner);
  assert.equal(created.length, 1);

  game.user.isGM = true;
  const gmAllowed = effectEvent();
  await BladesActiveEffect.onManageActiveEffect(gmAllowed, owner, { gmOnly: true });
  assert.equal(created.length, 2);

  const nonOwner = effectEvent();
  await BladesActiveEffect.onManageActiveEffect(nonOwner, { ...owner, isOwner: false }, { gmOnly: true });
  assert.equal(created.length, 2);
});

test("item-owned effects support create, edit, toggle, and delete without blocking embedded items", async () => {
  game.user.isGM = true;
  const calls = [];
  const effect = {
    disabled: false,
    sheet: { render: options => calls.push(["edit", options]) },
    update: (...args) => calls.push(["toggle", ...args]),
    delete: (...args) => calls.push(["delete", ...args]),
  };
  const owner = {
    isOwner: true,
    isEmbedded: true,
    uuid: "Actor.owner.Item.item",
    effects: new Map([["effect-1", effect]]),
    createEmbeddedDocuments: (...args) => calls.push(["create", ...args]),
  };

  await BladesActiveEffect.onManageActiveEffect(effectEvent("create", null, "temporary"), owner, { gmOnly: true });
  await BladesActiveEffect.onManageActiveEffect(effectEvent("edit", "effect-1"), owner, { gmOnly: true });
  await BladesActiveEffect.onManageActiveEffect(effectEvent("toggle", "effect-1"), owner, { gmOnly: true });
  await BladesActiveEffect.onManageActiveEffect(effectEvent("delete", "effect-1"), owner, { gmOnly: true });

  assert.equal(calls[0][0], "create");
  assert.equal(calls[0][1], "ActiveEffect");
  assert.equal(calls[0][2][0].origin, owner.uuid);
  assert.equal(calls[0][2][0]["duration.rounds"], 1);
  assert.deepEqual(calls.slice(1), [
    ["edit", { force: true }],
    ["toggle", { disabled: true }, { render: true }],
    ["delete", { render: true }],
  ]);
  assert.deepEqual(calls[0][3], { render: true });

  calls.length = 0;
  await BladesActiveEffect.onManageActiveEffect(effectEvent("create", null, "temporary"), owner, { gmOnly: true, render: false });
  await BladesActiveEffect.onManageActiveEffect(effectEvent("toggle", "effect-1"), owner, { gmOnly: true, render: false });
  await BladesActiveEffect.onManageActiveEffect(effectEvent("delete", "effect-1"), owner, { gmOnly: true, render: false });
  assert.deepEqual(calls.map(call => call[0]), ["create", "toggle", "delete"]);
  assert.deepEqual([calls[0][3], calls[1][2], calls[2][1]], [
    { render: false },
    { render: false },
    { render: false },
  ]);
});

test("read-only sheets disable every input type while retaining read-only text areas", async () => {
  const control = () => ({ setAttribute(name, value) { this[name] = value; } });
  const inputs = [control(), control(), control()]; // text, number, and radio controls
  const textarea = control();
  const sheet = {
    isEditable: false,
    element: {
      querySelectorAll(selector) {
        if (selector === "input, select") return inputs;
        if (selector === "textarea") return [textarea];
        return [];
      }
    },
  };

  await BladesSheet.prototype._onRender.call(sheet, {}, {});

  assert.ok(inputs.every(input => input.disabled && input["aria-disabled"] === "true"));
  assert.equal(textarea.readOnly, true);
  assert.equal(textarea["aria-readonly"], "true");
});

test("read-only item sheets disable form controls while retaining readable text", async () => {
  const control = () => ({ setAttribute(name, value) { this[name] = value; } });
  const input = control();
  const select = control();
  const textarea = control();
  const sheet = {
    isEditable: false,
    element: {
      querySelectorAll(selector) {
        if (selector === "input, select") return [input, select];
        if (selector === "textarea") return [textarea];
        return [];
      }
    }
  };

  await BladesItemSheet.prototype._onRender.call(sheet, {}, {});

  assert.ok(input.disabled && select.disabled);
  assert.equal(input["aria-disabled"], "true");
  assert.equal(select["aria-disabled"], "true");
  assert.equal(textarea.readOnly, true);
  assert.equal(textarea["aria-readonly"], "true");
});

test("item sheet persists textarea changes through one explicit document update", async () => {
  game.user.isGM = true;
  const listeners = new Map();
  const description = {
    name: "system.description",
    type: "textarea",
    value: "Updated description",
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const updates = [];
  const sheet = Object.assign(Object.create(BladesItemSheet.prototype), {
    isEditable: true,
    document: {
      update: async data => updates.push(data),
    },
    element: {
      querySelectorAll(selector) {
        if (selector === 'input[name], select[name], textarea[name], prose-mirror[name]') return [description];
        return [];
      },
    },
  });

  await BladesItemSheet.prototype._onRender.call(sheet, { editable: true }, {});
  await listeners.get("change")({ currentTarget: description });

  assert.deepEqual(updates, [{ "system.description": "Updated description" }]);
});

test("shared form updates preserve checkbox state and ignore unchecked radios", () => {
  assert.deepEqual(
    formControlUpdate({ name: "system.equipped", type: "checkbox", checked: false }),
    { "system.equipped": false },
  );
  assert.equal(
    formControlUpdate({ name: "system.choice", type: "radio", checked: false }),
    null,
  );
});

test("item effect listener catches rejected mutations and ignores a rapid second click", async () => {
  const originalManage = BladesActiveEffect.onManageActiveEffect;
  const notifications = [];
  globalThis.ui = { notifications: { error: message => notifications.push(message) } };
  let rejectMutation;
  let calls = 0;
  BladesActiveEffect.onManageActiveEffect = () => {
    calls += 1;
    return new Promise((_resolve, reject) => { rejectMutation = reject; });
  };
  const listeners = new Map();
  const control = {
    disabled: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const sheet = Object.assign(Object.create(BladesItemSheet.prototype), {
    element: { isConnected: true, querySelectorAll: selector =>
      selector === ".effect-control[data-effect-action]" ? [control] : [] },
    document: {},
    render: async () => assert.fail("a rejected mutation must not reconcile"),
  });
  try {
    await BladesItemSheet.prototype._onRender.call(sheet, { editable: true }, {});
    const first = listeners.get("click")({ currentTarget: control, preventDefault() {} });
    const second = listeners.get("click")({ currentTarget: control, preventDefault() {} });
    assert.equal(calls, 1);
    rejectMutation(new Error("denied"));
    await Promise.all([first, second]);
    assert.equal(control.disabled, false);
    assert.equal(notifications.length, 1);
  } finally {
    BladesActiveEffect.onManageActiveEffect = originalManage;
  }
});

test("item effect edit opens the Effect sheet without replacing its parent", async () => {
  game.user.isGM = true;
  let effectSheetRenders = 0;
  let parentRenders = 0;
  const effect = { sheet: { render: () => { effectSheetRenders += 1; } } };
  const control = {
    disabled: false,
    dataset: { effectAction: "edit" },
    closest(selector) {
      return selector === "[data-effect-id]" ? { dataset: { effectId: "effect-1" } } : null;
    }
  };
  const sheet = Object.assign(Object.create(BladesItemSheet.prototype), {
    element: { isConnected: true, matches: () => false, closest: () => null, querySelector: () => null },
    document: { isOwner: true, effects: new Map([["effect-1", effect]]) },
    render: async () => { parentRenders += 1; },
  });

  await sheet._onItemEffectControl({ currentTarget: control, preventDefault() {} });

  assert.equal(effectSheetRenders, 1);
  assert.equal(parentRenders, 0);
});

test("item effect controls do not reconcile the parent when GM-only mutation is denied", async () => {
  game.user.isGM = false;
  let parentRenders = 0;
  const control = { disabled: false, dataset: { effectAction: "create" }, closest: () => null };
  const sheet = Object.assign(Object.create(BladesItemSheet.prototype), {
    element: { isConnected: true, matches: () => false, closest: () => null, querySelector: () => null },
    document: { isOwner: true },
    render: async () => { parentRenders += 1; },
  });

  await sheet._onItemEffectControl({ currentTarget: control, preventDefault() {} });

  assert.equal(parentRenders, 0);
  assert.equal(control.disabled, false);
});

test("legacy actor sheets retain the form viewport, wrapper viewport, and selected tabs across a render", () => {
  const makeRoot = (form, windowContent, activePanel = null) => ({
    matches: () => false,
    closest: () => null,
    querySelector(selector) {
      if (selector === "form.actor-sheet") return form;
      if (selector === ".window-content") return windowContent;
      if (selector === '.tab[data-group="primary"].active') return activePanel;
      return null;
    }
  });
  const originalForm = { scrollTop: 248, scrollLeft: 17 };
  const originalWindow = { scrollTop: 31, scrollLeft: 5 };
  const sheet = {
    _activeEffectTab: "passive",
    tabGroups: { primary: "traits" },
    element: makeRoot(originalForm, originalWindow, { dataset: { tab: "traits" } }),
    _captureSheetViewState: BladesSheet.prototype._captureSheetViewState,
    _restoreSheetViewState: BladesSheet.prototype._restoreSheetViewState,
    _activateEffectTab(type) { this.restoredEffectTab = type; }
  };

  sheet._captureSheetViewState({ primaryTab: "effects" });
  const rerenderedForm = { scrollTop: 0, scrollLeft: 0 };
  const rerenderedWindow = { scrollTop: 0, scrollLeft: 0 };
  sheet.element = makeRoot(rerenderedForm, rerenderedWindow);
  sheet._restoreSheetViewState();

  assert.deepEqual(rerenderedForm, { scrollTop: 248, scrollLeft: 17 });
  assert.deepEqual(rerenderedWindow, { scrollTop: 31, scrollLeft: 5 });
  assert.equal(sheet.tabGroups.primary, "effects");
  assert.equal(sheet.restoredEffectTab, "passive");
});


test("legacy scroll capture forwards main-tab clicks for immediate native activation", async () => {
  const listeners = new Map();
  const form = { scrollTop: 248, scrollLeft: 17, addEventListener() {} };
  const windowContent = { scrollTop: 31, scrollLeft: 5, addEventListener() {} };
  const html = {
    matches: () => false,
    closest: () => null,
    querySelector(selector) {
      if (selector === "form.actor-sheet") return form;
      if (selector === ".window-content") return windowContent;
      if (selector === '.tab[data-group="primary"].active') return { dataset: { tab: "traits" } };
      return null;
    },
    querySelectorAll: () => [],
    addEventListener(type, listener, options) { listeners.set(type, { listener, options }); }
  };
  const sheet = {
    _activeEffectTab: "passive",
    isEditable: true,
    tabGroups: { primary: "traits" },
    element: html,
    _captureSheetViewState: BladesSheet.prototype._captureSheetViewState,
    _restoreSheetViewState: BladesSheet.prototype._restoreSheetViewState,
    _bindEffectTabs: BladesSheet.prototype._bindEffectTabs,
    _bindSheetViewState: BladesSheet.prototype._bindSheetViewState
  };
  await BladesActorSheet.prototype._onRender.call(sheet, {}, {});

  const tab = {
    dataset: { tab: "effects" },
    matches: selector => selector === '[data-group="primary"][data-action="tab"]'
  };
  const event = {
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    target: { closest: () => tab }
  };
  listeners.get("click").listener(event);

  assert.equal(event.defaultPrevented, false);
  assert.equal(sheet.tabGroups.primary, "traits");
  assert.equal(sheet._sheetViewState.primaryTab, "effects");

  // This models Foundry's delegated action handler, which now receives the
  // untouched click and can activate the panel in the same event turn.
  if (!event.defaultPrevented) sheet.tabGroups.primary = tab.dataset.tab;
  assert.equal(sheet.tabGroups.primary, "effects");
});

test("unknown Mask item names use readable generic labels instead of missing localization keys", () => {
  const attributes = { lies: { skills: { deceive: { value: 0 } } } };

  assert.deepEqual(getMaskTypePresentation("qs", attributes), {
    attributes: [],
    label: "BITD.Mask",
    typeLang: "BITD.Qs",
    xpKey: null
  });
  assert.deepEqual(getMaskTypePresentation("lies", attributes), {
    attributes: attributes.lies,
    label: "BITD.LiesShort",
    typeLang: "BITD.Lies",
    xpKey: "Mask.XP.Lies"
  });
});

test("Rebellion trackers read and update fully-qualified actor paths exactly once", async () => {
  const updates = [];
  const sheet = {
    isEditable: true,
    actor: {
      system: { tyranny: { value: 2 }, heat: { value: 4 } },
      update: async update => updates.push(update)
    }
  };
  const click = async (path, value, max) => BladesRebelionSheet.prototype._onDotChange.call(sheet, {
    preventDefault() {},
    currentTarget: { dataset: { path, value: String(value), max_value: String(max) } }
  });

  await click("system.tyranny.value", 2, 4);
  await click("system.heat.value", 5, 10);

  assert.deepEqual(updates, [
    { "system.tyranny.value": 2 },
    { "system.heat.value": 5 }
  ]);
  assert.ok(updates.every(update => Object.keys(update).every(path => !path.startsWith("system.system."))));
});

test("Rebellion trackers reject mutations from a locked sheet", async () => {
  let updated = false;
  await BladesRebelionSheet.prototype._onDotChange.call({
    isEditable: false,
    actor: { update: async () => { updated = true; } }
  }, {
    preventDefault() {},
    currentTarget: { dataset: { path: "system.tyranny.value", value: "1", max_value: "4" } }
  });
  assert.equal(updated, false);
});

test("character tracker updates avoid a sheet rerender and refresh the clicked tracker", async () => {
  const updates = [];
  const tooth = { src: "" };
  const dot = {
    dataset: { value: "2" },
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) { return selector === "img.big-teeth" ? tooth : null; }
  };
  const tracker = {
    classList: { contains: name => name === "character-xp" },
    querySelectorAll(selector) { return selector === ".dot-value" ? [dot] : []; }
  };
  const sheet = {
    isEditable: true,
    document: {
      system: { experience: { value: 1 } },
      update: async (...args) => updates.push(args)
    },
    _updateTrackerDisplay: BladesActorSheet.prototype._updateTrackerDisplay
  };
  const event = {
    prevented: false,
    preventDefault() { this.prevented = true; },
    currentTarget: { dataset: { path: "system.experience.value", value: "2", max_value: "4" }, parentElement: tracker }
  };
  await BladesActorSheet.prototype._onDotChange.call(sheet, event);

  assert.equal(event.prevented, true);
  assert.deepEqual(updates, [[{ "system.experience.value": 2 }, { render: false }]]);
  assert.equal(dot["aria-pressed"], "true");
  assert.match(tooth.src, /stresstooth-blue\.png$/);
});

test("V2 character tracker updates refresh numeric progress without a sheet rerender", () => {
  const output = { textContent: "1 / 8" };
  const classes = new Set(["dot-value", "dot-value--empty"]);
  const dot = {
    dataset: { path: "system.experience.value", value: "2", max_value: "8" },
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return null; },
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      }
    }
  };
  const group = {
    querySelectorAll: selector => selector === ".dot-value" ? [dot] : [],
    querySelector: () => null,
    closest: () => null
  };
  const tracker = {
    classList: { contains: name => name === "character-xp" },
    querySelector: selector => selector === "output" ? output : null
  };
  dot.parentElement = group;
  dot.closest = selector => selector === ".character-tracker" ? tracker : null;

  BladesActorSheet.prototype._updateTrackerDisplay(dot, 2);

  assert.equal(dot["aria-pressed"], "true");
  assert.equal(classes.has("dot-value--filled"), true);
  assert.equal(output.textContent, "2 / 8");
});

test("character skill updates refresh flat pip state without a sheet rerender", async () => {
  const updates = [];
  const classes = new Set(["dot-value", "dot-value--empty"]);
  const skillLabel = { dataset: { rollValue: "1" } };
  const attributeLabel = { dataset: { rollValue: "0" } };
  const attribute = {
    querySelector(selector) { return selector === ".attribute-label" ? attributeLabel : null; },
    querySelectorAll() { return classes.has("dot-value--filled") ? [dot] : []; }
  };
  const dot = {
    dataset: { value: "2" },
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }
    },
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return null; }
  };
  const tracker = {
    classList: { contains: () => false },
    closest(selector) { return selector === ".attribute" ? attribute : null; },
    querySelector(selector) { return selector === ".attribute-skill-label" ? skillLabel : null; },
    querySelectorAll(selector) { return selector === ".dot-value" ? [dot] : []; }
  };
  const sheet = {
    isEditable: true,
    document: {
      system: { attributes: { insight: { skills: { hunt: { value: 1 } } } } },
      update: async (...args) => updates.push(args)
    },
    _updateTrackerDisplay: BladesActorSheet.prototype._updateTrackerDisplay
  };
  const event = {
    preventDefault() {},
    currentTarget: {
      dataset: {
        path: "system.attributes.insight.skills.hunt.value",
        value: "2",
        max_value: "4"
      },
      parentElement: tracker
    }
  };

  await BladesActorSheet.prototype._onDotChange.call(sheet, event);

  assert.deepEqual(updates, [[{
    "system.attributes.insight.skills.hunt.value": 2
  }, { render: false }]]);
  assert.equal(dot["aria-pressed"], "true");
  assert.equal(classes.has("dot-value--filled"), true);
  assert.equal(classes.has("dot-value--empty"), false);
  assert.equal(skillLabel.dataset.rollValue, "2");
  assert.equal(attributeLabel.dataset.rollValue, "1");
});

test("Mask trackers update without a sheet rerender and refresh their output", async () => {
  const updates = [];
  const classes = new Set(["dot-value", "dot-value--empty"]);
  const tooth = { src: "" };
  const output = { textContent: "0 / 8" };
  const dot = {
    dataset: { path: "experience.value", value: "2", max_value: "8" },
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) { return selector === "img" ? tooth : null; }
  };
  const tracker = { querySelector: selector => selector === "output" ? output : null };
  const group = {
    closest(selector) { return selector === ".mask-tracker" ? tracker : null; },
    querySelectorAll(selector) { return selector === ".dot-value" ? [dot] : []; }
  };
  dot.parentElement = group;
  const sheet = {
    isEditable: true,
    actor: {
      system: { experience: { value: 1 } },
      update: async (...args) => updates.push(args)
    },
    _updateDotDisplay: BladesMaskSheet.prototype._updateDotDisplay
  };

  await BladesMaskSheet.prototype._onDotChange.call(sheet, {
    preventDefault() {},
    currentTarget: dot
  });

  assert.deepEqual(updates, [[{ "system.experience.value": 2 }, { render: false }]]);
  assert.equal(dot["aria-pressed"], "true");
  assert.equal(classes.has("dot-value--filled"), true);
  assert.equal(classes.has("dot-value--empty"), false);
  assert.equal(output.textContent, "2 / 8");
  assert.match(tooth.src, /stresstooth-blue\.png$/);
});

test("Actor effect controls ignore a second activation while the first is pending", async () => {
  const original = BladesActiveEffect.onManageActiveEffect;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  let captures = 0;
  let restores = 0;
  const control = {};
  const sheet = {
    actor: {},
    _captureSheetViewState() { captures += 1; },
    _restoreSheetViewState() { restores += 1; },
  };

  BladesActiveEffect.onManageActiveEffect = async () => {
    calls += 1;
    await pending;
  };

  try {
    const action = () => BladesActiveEffect.onManageActiveEffect();
    const first = BladesSheet.prototype._onActorEffectControl.call(sheet, { currentTarget: control }, action);
    const second = BladesSheet.prototype._onActorEffectControl.call(sheet, { currentTarget: control }, action);
    await Promise.resolve();

    assert.equal(calls, 1);
    assert.equal(await second, false);
    release();
    assert.equal(await first, true);
    assert.deepEqual({ captures, restores }, { captures: 1, restores: 1 });

    BladesActiveEffect.onManageActiveEffect = async () => { throw new Error("expected failure"); };
    assert.equal(await BladesSheet.prototype._onActorEffectControl.call(sheet, { currentTarget: control }, action), false);
    BladesActiveEffect.onManageActiveEffect = async () => undefined;
    assert.equal(await BladesSheet.prototype._onActorEffectControl.call(sheet, { currentTarget: control }, action), true);
  } finally {
    BladesActiveEffect.onManageActiveEffect = original;
  }
});

test("Character tracker updates serialize by path and preserve click order", async () => {
  let releaseFirst;
  const firstPending = new Promise(resolve => { releaseFirst = resolve; });
  const values = [];
  const document = {
    system: { experience: { value: 0 } },
    async update(update) {
      const value = update["system.experience.value"];
      values.push(value);
      if (values.length === 1) await firstPending;
      this.system.experience.value = value;
    },
  };
  const sheet = {
    isEditable: true,
    document,
    _updateTrackerDisplay() {},
  };
  const event = () => ({
    preventDefault() {},
    currentTarget: {
      dataset: { path: "system.experience.value", value: "1", max_value: "4" },
      parentElement: null,
    },
  });

  const first = BladesActorSheet.prototype._onDotChange.call(sheet, event());
  const second = BladesActorSheet.prototype._onDotChange.call(sheet, event());
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(values, [1]);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(values, [1, 0]);
  assert.equal(document.system.experience.value, 0);
});

test("document-path queues recover after a rejected update", async () => {
  const document = {};
  await assert.rejects(queueDocumentPathUpdate(document, "system.value", async () => {
    throw new Error("expected failure");
  }));

  assert.equal(await queueDocumentPathUpdate(document, "system.value", async () => 2), 2);
});

test("actor update synchronization refreshes every open tracker renderer", () => {
  const createForm = () => {
    const tooth = { src: "" };
    const output = { textContent: "1 / 8" };
    const dot = {
      dataset: { path: "system.experience.value", value: "2", max_value: "8" },
      setAttribute(name, value) { this[name] = value; },
      querySelector(selector) { return selector === "img.big-teeth" ? tooth : null; }
    };
    const tracker = {
      classList: { contains: name => name === "character-xp" },
      querySelectorAll: selector => selector === ".dot-value" ? [dot] : [],
      querySelector: selector => selector === "output" ? output : null
    };
    dot.parentElement = tracker;
    dot.closest = selector => selector === ".character-tracker" ? tracker : null;
    return {
      dot,
      form: {
        classList: { contains: name => name === "character-sheet" },
        dataset: { actorUuid: "Actor.actor-1" },
        querySelectorAll: selector => selector === ".dot-value" ? [dot] : []
      },
      tooth,
      output
    };
  };
  const first = createForm();
  const second = createForm();
  const root = {
    querySelectorAll: selector => selector === "form[data-actor-uuid]" ? [first.form, second.form] : []
  };

  syncOpenActorTrackers({ id: "actor-1", uuid: "Actor.actor-1" }, { system: { experience: { value: 2 } } }, root);

  for (const renderer of [first, second]) {
    assert.equal(renderer.dot["aria-pressed"], "true");
    assert.match(renderer.tooth.src, /stresstooth-blue\.png$/);
    assert.equal(renderer.output.textContent, "2 / 8");
  }
});

test("actor update synchronization isolates synthetic actors sharing a base id", () => {
  const createForm = actorUuid => {
    const dot = {
      dataset: { path: "system.experience.value", value: "2", max_value: "8" },
      setAttribute(name, value) { this[name] = value; },
      querySelector() { return null; },
      classList: { toggle() {} }
    };
    dot.parentElement = {
      classList: { contains: () => false },
      querySelectorAll: () => [dot],
      querySelector: () => null
    };
    return {
      dot,
      classList: { contains: name => name === "character-sheet" },
      dataset: { actorUuid },
      querySelectorAll: selector => selector === ".dot-value" ? [dot] : []
    };
  };
  const worldActor = createForm("Actor.actor-1");
  const syntheticActor = createForm("Scene.scene-1.Token.token-1.Actor.actor-1");
  const root = {
    querySelectorAll: selector => selector === "form[data-actor-uuid]" ? [worldActor, syntheticActor] : []
  };

  syncOpenActorTrackers(
    { id: "actor-1", uuid: "Scene.scene-1.Token.token-1.Actor.actor-1" },
    { system: { experience: { value: 2 } } },
    root
  );

  assert.equal(worldActor.dot["aria-pressed"], undefined);
  assert.equal(syntheticActor.dot["aria-pressed"], "true");
});
