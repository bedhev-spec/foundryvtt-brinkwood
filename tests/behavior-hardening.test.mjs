import assert from "node:assert/strict";
import test from "node:test";

const tokenCalls = [];

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
    TokenDocument: {
      async updateDocuments(updates, options) {
        tokenCalls.push({ updates, options });
      }
    }
  },
  utils: {
    mergeObject: (target, source) => ({ ...target, ...source }),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object)
  }
};
globalThis.CONST = { ACTIVE_EFFECT_MODES: { CUSTOM: 0 } };
globalThis.game = { user: { isGM: false }, scenes: { current: null } };

const { BladesActiveEffect } = await import("../module/blades-active-effect.js");
const { BladesClockSheet } = await import("../module/blades-clock-sheet.js");
const { BladesSheet } = await import("../module/blades-sheet.js");
const { BladesActorSheet, prepareLoadoutCapacity } = await import("../module/blades-actor-sheet.js");
const { BladesItemSheet, prepareItemSheetPermissions } = await import("../module/blades-item-sheet.js");
const { BladesMaskSheet, getMaskTypePresentation } = await import("../module/blades-mask-sheet.js");
const { syncOpenActorTrackers } = await import("../module/sheet-tracker-sync.js");
const { BladesRebelionSheet } = await import("../module/blades-rebelion-sheet.js");

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

test("clock updates preserve actor and token textures when active tokens exist", async () => {
  tokenCalls.length = 0;
  const actorUpdates = [];
  const scene = { id: "scene-1" };
  const actor = {
    system: { type: 4, value: 0 },
    getActiveTokens: (...args) => {
      assert.deepEqual(args, [false, true]);
      return [{ id: "token-1" }, { id: "token-2" }];
    }
  };
  const sheet = { actor, document: { update: async update => actorUpdates.push(update) } };
  game.scenes.current = scene;

  await BladesClockSheet.prototype._updateClock.call(sheet, { "system.type": "6", "system.value": 4 });

  const image = "systems/brinkwood/styles/assets/progressclocks-svg/Progress Clock 6-4.svg";
  assert.deepEqual(actorUpdates, [{
    "system.type": "6",
    "system.value": 4,
    img: image,
    "prototypeToken.texture.src": image
  }]);
  assert.equal(tokenCalls.length, 1);
  assert.equal(tokenCalls[0].options.parent, scene);
  assert.deepEqual(tokenCalls[0].updates.map(update => update._id), ["token-1", "token-2"]);
  assert.ok(tokenCalls[0].updates.every(update => update["texture.src"] === image));
});

test("clock updates still save actor state without active tokens or an active scene", async () => {
  for (const [tokens, scene] of [[[], { id: "scene-1" }], [[{ id: "token-1" }], null]]) {
    tokenCalls.length = 0;
    const actorUpdates = [];
    const actor = {
      system: { type: 4, value: 0 },
      getActiveTokens: () => tokens
    };
    game.scenes.current = scene;

    await BladesClockSheet.prototype._updateClock.call(
      { actor, document: { update: async update => actorUpdates.push(update) } },
      { "system.type": 4, "system.value": 3 }
    );

    assert.equal(tokenCalls.length, 0);
    assert.equal(actorUpdates.length, 1);
    assert.match(actorUpdates[0].img, /Progress Clock 4-3\.svg$/);
    assert.match(actorUpdates[0]["prototypeToken.texture.src"], /Progress Clock 4-3\.svg$/);
  }
});

test("clock size changes suppress the stale document render and force one fresh sheet render", async () => {
  tokenCalls.length = 0;
  const updates = [];
  const renders = [];
  const actor = {
    system: { type: 4, value: 1 },
    getActiveTokens: () => []
  };
  game.scenes.current = { id: "scene-1" };

  await BladesClockSheet.prototype._updateClock.call({
    actor,
    document: { update: async (data, options) => updates.push({ data, options }) },
    render: async options => renders.push(options)
  }, { "system.type": "8", "system.value": 1 });

  const image = "systems/brinkwood/styles/assets/progressclocks-svg/Progress Clock 8-1.svg";
  assert.deepEqual(updates, [{
    data: {
      "system.type": "8",
      "system.value": 1,
      img: image,
      "prototypeToken.texture.src": image
    },
    options: { render: false }
  }]);
  assert.deepEqual(renders, [{ force: true }]);
});

test("clock size selection resets progress and owns the change event", async () => {
  const clockUpdates = [];
  const sheet = {
    isEditable: true,
    _updateClock: async data => clockUpdates.push(data)
  };
  const form = { id: "clock-form" };
  const options = { render: false };

  const sizeEvent = {
    prevented: false,
    stopped: false,
    currentTarget: { value: "8" },
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; }
  };
  await BladesClockSheet.prototype._onClockSizeChange.call(sheet, sizeEvent);
  assert.equal(sizeEvent.prevented, true);
  assert.equal(sizeEvent.stopped, true);
  assert.deepEqual(clockUpdates, [{ "system.type": 8, "system.value": 0 }]);

  const result = await BladesClockSheet.prototype._processSubmitData.call(
    sheet,
    { target: { name: "system.description" } },
    form,
    { "system.description": "Updated notes" },
    options
  );
  assert.deepEqual(clockUpdates, [{ "system.type": 8, "system.value": 0 }]);
  assert.deepEqual(result, {
    event: { target: { name: "system.description" } },
    form,
    submitData: { "system.description": "Updated notes" },
    options
  });
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
  const tooth = { src: "" };
  const output = { textContent: "0 / 8" };
  const dot = {
    dataset: { path: "experience.value", value: "2", max_value: "8" },
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
  assert.equal(output.textContent, "2 / 8");
  assert.match(tooth.src, /stresstooth-blue\.png$/);
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
