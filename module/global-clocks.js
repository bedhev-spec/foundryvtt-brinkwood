/*
 * Clock-overlay behavior adapted from Global Progress Clocks by
 * Carlos Fernandez (Supe), copyright 2023, under the MIT License.
 * See THIRD_PARTY_NOTICES.md. This adaptation intentionally excludes the
 * upstream point-counter and horizontal-tracker systems.
 */

import {
  GLOBAL_CLOCK_MAX_SIZE,
  GLOBAL_CLOCK_SIZES,
  nextGlobalClockValue,
  normalizeGlobalClock,
  previousGlobalClockValue,
} from "./global-clock-utils.js";
import { escapeHTML } from "./html-utils.js";

const SYSTEM_ID = "brinkwood";
const SETTING_KEYS = Object.freeze({
  clocks: "globalClocks",
  location: "globalClockLocation",
  offset: "globalClockOffset",
});

class GlobalClockStore extends Collection {
  #mutationQueue = Promise.resolve();

  #enqueue(operation) {
    const mutation = this.#mutationQueue.then(operation);
    this.#mutationQueue = mutation.catch(() => {});
    return mutation;
  }

  refresh() {
    this.clear();
    for (const data of Object.values(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {})) {
      const clock = normalizeGlobalClock(data);
      if (clock.id && clock.name) this.set(clock.id, clock);
    }
    game.brinkwood?.clockOverlay?.refresh();
  }

  create(data) {
    if (!game.user.isGM) return false;
    const clock = normalizeGlobalClock({ ...data, id: foundry.utils.randomID() });
    if (!clock.name) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      clocks[clock.id] = clock;
      this.set(clock.id, clock);
      game.brinkwood?.clockOverlay?.refresh();
      await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
      return true;
    });
  }

  update(id, changes) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      const clock = normalizeGlobalClock({ ...clocks[id], ...changes, id });
      clocks[id] = clock;
      this.set(id, clock);
      game.brinkwood?.clockOverlay?.refresh();
      await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
      return true;
    });
  }

  step(id, direction) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      const clock = normalizeGlobalClock(clocks[id]);
      clock.value = direction < 0
        ? previousGlobalClockValue(clock.value, clock.max)
        : nextGlobalClockValue(clock.value, clock.max);
      clocks[id] = clock;
      this.set(id, clock);
      game.brinkwood?.clockOverlay?.refresh();
      await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
      return true;
    });
  }

  togglePrivate(id) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      const clock = normalizeGlobalClock(clocks[id]);
      clock.private = !clock.private;
      clocks[id] = clock;
      this.set(id, clock);
      game.brinkwood?.clockOverlay?.refresh();
      await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
      return true;
    });
  }

  delete(id) {
    if (!game.user.isGM) return false;
    return this.#enqueue(async () => {
      const clocks = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, SETTING_KEYS.clocks) ?? {});
      if (!clocks[id]) return false;
      delete clocks[id];
      this.remove(id);
      game.brinkwood?.clockOverlay?.refresh();
      await game.settings.set(SYSTEM_ID, SETTING_KEYS.clocks, clocks);
      return true;
    });
  }
}

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

class GlobalClockDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "brinkwood-global-clock-dialog",
    classes: ["brinkwood-global-clock-dialog", "standard-form"],
    tag: "form",
    position: { width: 420, height: "auto" },
    window: { icon: "fa-solid fa-clock", title: "BITD.GlobalClock.DialogCreate" },
    actions: { cancel: GlobalClockDialog.#onCancel },
    form: { handler: GlobalClockDialog.#onSubmit, closeOnSubmit: true },
  };

  static PARTS = {
    main: { template: "systems/brinkwood/templates/overlay/global-clock-dialog.html", root: true },
  };

  constructor({ clock = null, onSubmit } = {}) {
    super();
    this.clock = clock;
    this.onSubmit = onSubmit;
  }

  get title() {
    return game.i18n.localize(this.clock ? "BITD.GlobalClock.DialogEdit" : "BITD.GlobalClock.DialogCreate");
  }

  async _prepareContext(options) {
    const clock = normalizeGlobalClock(this.clock ?? {});
    return {
      ...(await super._prepareContext(options)),
      clock,
      editing: Boolean(this.clock),
      sizes: Object.fromEntries(GLOBAL_CLOCK_SIZES.map(size => [size, size])),
      maxSize: GLOBAL_CLOCK_MAX_SIZE,
      defaultSize: clock.max,
    };
  }

  static #onCancel(_event, _target) {
    return this.close();
  }

  static async #onSubmit(_event, _form, formData) {
    const data = normalizeGlobalClock(formData.object);
    if (!data.name) {
      ui.notifications.warn("BITD.GlobalClock.NameRequired", { localize: true });
      return;
    }
    await this.onSubmit?.(data);
  }
}

class GlobalClockOverlay extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "brinkwood-global-clock-overlay",
    classes: ["brinkwood-global-clocks"],
    window: { frame: false, positioned: false },
    actions: {
      addClock: GlobalClockOverlay.#onAddClock,
      toggleVisibility: GlobalClockOverlay.#onToggleVisibility,
      editClock: GlobalClockOverlay.#onEditClock,
      deleteClock: GlobalClockOverlay.#onDeleteClock,
    },
  };

  static PARTS = {
    main: {
      template: "systems/brinkwood/templates/overlay/global-clocks.html",
      scrollable: [".global-clock-list"],
    },
  };

  constructor(store) {
    super();
    this.store = store;
    this.refresh = foundry.utils.debounce(() => this.render({ force: true }), 100);
  }

  async _prepareContext(options) {
    const location = game.settings.get(SYSTEM_ID, SETTING_KEYS.location);
    return {
      ...(await super._prepareContext(options)),
      editable: game.user.isGM,
      location,
      horizontalEdge: location === "topRight" ? "right" : "left",
      verticalEdge: location === "topRight" ? "top" : "bottom",
      verticalOffset: `${game.settings.get(SYSTEM_ID, SETTING_KEYS.offset)}px`,
      clocks: this.store.contents
        .filter(clock => game.user.isGM || !clock.private)
        .map(clock => ({ ...clock, spokes: Array.from({ length: clock.max }, (_, index) => index) })),
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;
    html.dataset.location = context.location;
    const column = document.querySelector(context.location === "topRight" ? "#ui-right-column-1" : "#ui-left-column-1");
    if (!column) return;
    if (!column.contains(html)) {
      if (context.location === "topRight") column.prepend(html);
      else column.insertBefore(html, column.querySelector("#players"));
    }

    if (!game.user.isGM) return;
    html.querySelectorAll(".global-clock__face[data-clock-id]").forEach(face => {
      face.addEventListener("click", event => {
        this.store.step(event.currentTarget.dataset.clockId, 1);
      });
      face.addEventListener("contextmenu", event => {
        event.preventDefault();
        this.store.step(event.currentTarget.dataset.clockId, -1);
      });
    });
  }

  static #onAddClock() {
    new GlobalClockDialog({ onSubmit: data => this.store.create(data) }).render({ force: true });
  }

  static #onEditClock(_event, target) {
    const clock = this.store.get(target.closest("[data-clock-id]")?.dataset.clockId);
    if (!clock) return;
    new GlobalClockDialog({
      clock,
      onSubmit: data => this.store.update(clock.id, data),
    }).render({ force: true });
  }

  static #onToggleVisibility(_event, target) {
    const clock = this.store.get(target.closest("[data-clock-id]")?.dataset.clockId);
    if (clock) this.store.togglePrivate(clock.id);
  }

  static async #onDeleteClock(_event, target) {
    const clock = this.store.get(target.closest("[data-clock-id]")?.dataset.clockId);
    if (!clock) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "BITD.GlobalClock.DeleteTitle" },
      content: `<p>${game.i18n.format("BITD.GlobalClock.DeleteMessage", { name: escapeHTML(clock.name) })}</p>`,
      modal: true,
    });
    if (confirmed) await this.store.delete(clock.id);
  }
}

export function registerGlobalClockSystem() {
  const refreshOverlay = () => game.brinkwood?.clockOverlay?.refresh();
  game.settings.register(SYSTEM_ID, SETTING_KEYS.clocks, {
    name: "Global Clocks",
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => game.brinkwood?.clocks?.refresh(),
  });
  game.settings.register(SYSTEM_ID, SETTING_KEYS.location, {
    name: "BITD.GlobalClock.LocationName",
    hint: "BITD.GlobalClock.LocationHint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      bottomLeft: "BITD.GlobalClock.LocationBottomLeft",
      topRight: "BITD.GlobalClock.LocationTopRight",
    },
    default: "bottomLeft",
    onChange: refreshOverlay,
  });
  game.settings.register(SYSTEM_ID, SETTING_KEYS.offset, {
    name: "BITD.GlobalClock.OffsetName",
    hint: "BITD.GlobalClock.OffsetHint",
    scope: "world",
    config: true,
    type: Number,
    default: 0,
    onChange: refreshOverlay,
  });

  game.brinkwood ??= {};
  game.brinkwood.clocks = new GlobalClockStore();
  game.brinkwood.clockOverlay = new GlobalClockOverlay(game.brinkwood.clocks);
  Hooks.on("canvasReady", () => game.brinkwood.clockOverlay.render({ force: true }));
}

export function startGlobalClockSystem() {
  game.brinkwood.clocks.refresh();
  return game.brinkwood.clockOverlay.render({ force: true });
}
