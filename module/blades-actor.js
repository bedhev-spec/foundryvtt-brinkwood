import { bladesRoll } from "./blades-roll.js";
import { readRollDialogValues } from "./roll-resolution.js";
import { BladesHelpers } from "./blades-helpers.js";
import { maskActorImage, npcActorImage } from "./actor-images.js";
import {
  compendiumSourceMetadata,
  normalizedTraitSourceName,
  traitHasCompendiumProvenance,
} from "./trait-grant-matching.js";

const TRAIT_SOURCE_TYPES = new Set(["upbringing", "profession", "mask"]);
const ACTION_POINT_SOURCE_TYPES = new Set([...TRAIT_SOURCE_TYPES, "class"]);
const isTraitSource = item => TRAIT_SOURCE_TYPES.has(item?.type);

// Multiple document callbacks can request the same grant before the first
// embedded-document create has synchronized back to this actor. Serialize that
// read/check/create sequence per actor and source item so a later request sees
// the first request's authoritative embedded documents.
const traitGrantQueues = new WeakMap();
function serializeTraitGrant(actor, sourceItemId, operation) {
  let queues = traitGrantQueues.get(actor);
  if (!queues) {
    queues = new Map();
    traitGrantQueues.set(actor, queues);
  }

  const prior = queues.get(sourceItemId) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  queues.set(sourceItemId, next);
  return next.finally(() => {
    if (queues.get(sourceItemId) === next) queues.delete(sourceItemId);
    if (!queues.size) traitGrantQueues.delete(actor);
  });
}

// Mask configuration is a single actor-level choice. Unlike ordinary item
// creation, competing picker submissions must observe the previous complete
// replacement before deciding which embedded Mask to retain.
const maskConfigurationQueues = new WeakMap();
function serializeMaskConfiguration(actor, operation) {
  const prior = maskConfigurationQueues.get(actor) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(operation);
  maskConfigurationQueues.set(actor, next);
  return next.finally(() => {
    if (maskConfigurationQueues.get(actor) === next) {
      maskConfigurationQueues.delete(actor);
    }
  });
}

function sameMaskChoice(existing, requested) {
  const existingSource = compendiumSourceMetadata(existing);
  const requestedSource = compendiumSourceMetadata(requested);
  return existing.name === requested.name
    && (!existingSource.length || !requestedSource.length
      || existingSource.some(source => requestedSource.includes(source)));
}

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends foundry.documents.Actor {

  /** @override */
  static async create(data, options={}) {

    data.prototypeToken = data.prototypeToken || {};

    if (data.type === "mask") {
      data.img = maskActorImage(data.img);
    }

    if (data.type === "npc") {
      data.img = npcActorImage(data.img);
    }

    // Characters use linked tokens so their token and sheet stay in sync.
    if (data.type === "character") {
      data.prototypeToken.actorLink = true;
    }
    return super.create(data, options);
  }

  async _onCreate( data, options, userId ) {
    await super._onCreate(data, options, userId);

    //load basic items for characters
    if ( data.type == "character" ) {
      await this._loadBasicItems();
    }

  }

  /** @override */

  /* -------------------------------------------- */

  rollAttributePopup(attribute_name, attribute_label, attribute_value) {

    let content = `
        <h2>${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}</h2>
        <form>
          <div class="form-group">
            <label>${game.i18n.localize('BITD.Modifier')}:</label>
            <select id="mod" name="mod">
              ${this.createListOfDiceMods(-3,+3,0)}
            </select>
          </div>`;
    if (BladesHelpers.isAttributeAction(attribute_label)) {
      content += `
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Position')}:</label>
              <select id="pos" name="pos">
                <option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option>
                <option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option>
                <option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Effect')}:</label>
              <select id="fx" name="fx">
                <option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option>
                <option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option>
                <option value="great">${game.i18n.localize('BITD.EffectGreat')}</option>
              </select>
            </div>`;
    } else {
        content += `
            <input id="pos" name="pos" type="hidden" value="">
            <input id="fx" name="fx" type="hidden" value="">`;
    }
    content += `
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
        </form>
      `;

    // Replace legacy Dialog with DialogV2
    foundry.applications.api.DialogV2.prompt({
      window: { title: `${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}` },
      content: content,
      ok: {
        icon: "<i class='fas fa-check'></i>",
        label: game.i18n.localize('BITD.Roll'),
        callback: async (_event, _button, dialog) => {
          const { modifier, position, effect, note } = readRollDialogValues(dialog);
          await this.rollAttribute(attribute_label, modifier, attribute_value, position, effect, note);
        },
      },
      rejectClose: false,
    });

  }

  /* -------------------------------------------- */

  async rollAttribute(attribute_label = "", additional_dice_amount = 0, attribute_value = 0, position, effect, note) {
    let dice_amount = 0;
    if (attribute_label !== "") {
			dice_amount = attribute_value;
    }
    else {
      dice_amount = 1;
    }

    await bladesRoll(dice_amount, attribute_label, position, effect, note, {
      modifiers: [{ label: "BITD.Modifier", value: additional_dice_amount }]
    });
  }

  /* -------------------------------------------- */

  /**
   * Create <options> for available actions
   *  which can be performed.
   */
  createListOfActions() {

    let text, attribute, skill;
    let attributes = this.system.attributes;

    for ( attribute in attributes ) {

      const skills = attributes[attribute].skills;

      text += `<optgroup label="${attribute} Actions">`;
      text += `<option value="${attribute}">${attribute} (Resist)</option>`;

      for ( skill in skills ) {
        text += `<option value="${skill}">${skill}</option>`;
      }

      text += `</optgroup>`;

    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs
   *  Min die modifier
   * @param {int} re
   *  Max die modifier
   * @param {int} s
   *  Selected die
   */
  createListOfDiceMods(rs, re, s) {

    var text = ``;
    var i = 0;

    if ( s == "" ) {
      s = 0;
    }

    for ( i  = rs; i <= re; i++ ) {
      var plus = "";
      if ( i >= 0 ) { plus = "+" };
      text += `<option value="${i}"`;
      if ( i == s ) {
        text += ` selected`;
      }

      text += `>${plus}${i}d</option>`;
    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Create source items, then synchronize their grants. Once Foundry has
   * committed the source, a grant failure is recoverable through
   * repairTraitGrantsForSourceIds and must not make callers recreate it.
   */
  async createEmbeddedDocuments(embeddedName, data, operation={}) {
    const created = await super.createEmbeddedDocuments(embeddedName, data, operation);
    const traitSources = embeddedName === "Item"
      ? Array.from(created ?? []).filter(isTraitSource)
      : [];
    if (!traitSources.length) return created;

    try {
      await this.syncTraitGrantsForSources(traitSources);
    } catch (error) {
      const sourceIds = traitSources.map(source => source.id ?? source._id).filter(Boolean);
      console.error("Brinkwood trait grant synchronization failed after source creation", {
        actorId: this.id,
        sourceIds,
        error
      });
      globalThis.ui?.notifications?.warn?.(
        "The selected source was saved, but its traits could not be loaded. Please retry the trait repair."
      );
    }
    return created;
  }

  async _onCreateEmbeddedDocuments( name, ...args ) {
    await super._onCreateEmbeddedDocuments(name, ...args);
    for (const newItem of args[0] ?? []) {
      if (ACTION_POINT_SOURCE_TYPES.has(newItem.type)) {
        await this._modActionPoints(newItem);
      }
    }
  }

  async deleteEmbeddedDocuments(embeddedName, ids, operation={}) {
    const removedItems = embeddedName === "Item" && Array.isArray(ids)
      ? ids.map(id => this.items.get?.(id)
        ?? this.items.find?.(entry => (entry.id ?? entry._id) === id)).filter(Boolean)
      : [];
    const sourceKeys = new Set(removedItems
      .filter(isTraitSource)
      .map(item => `${item.type}:${item.id ?? item._id}`));
    const grantIds = embeddedName === "Item"
      ? this.items.filter(item => {
        const grant = item.flags?.brinkwood?.traitGrant;
        return item.type === "trait"
          && sourceKeys.has(`${grant?.sourceItemType}:${grant?.sourceItemId}`);
      }).map(item => item.id ?? item._id)
      : [];
    const deleteIds = [...new Set([...ids, ...grantIds])];

    // The sheet awaits this public deletion path. Include exact source-tagged
    // grants in the same Foundry database operation instead of starting a
    // second asynchronous deletion from a post-delete lifecycle callback.
    const result = await super.deleteEmbeddedDocuments(embeddedName, deleteIds, operation);
    for (const removedItem of removedItems) {
      if (ACTION_POINT_SOURCE_TYPES.has(removedItem.type)) {
        await this._modActionPoints(removedItem, true);
      }
    }
    return result;
  }

  async _modActionPoints(data, remove=false) {
		const bonus_points = data.system?.logic.replaceAll(' ','').split("\n").map(bonus => bonus.split('='));
    const max_value = 4;
		const mod = remove ? -1 : 1;
		let system = {};
		bonus_points.forEach(bonus => {
			const key = bonus[0];
			const bonus_value = parseInt(bonus[1]);
			let value = parseInt(foundry.utils.getProperty(this, key)) + mod*bonus_value;
      value = (value > max_value) ? max_value : value;
			value = (value < 0 ? 0 : value);
      foundry.utils.setProperty(system, key, value);
   	});
		await this.update(system);
	}

  async _addTraits(data, compendiumTraits = null, adoptLegacyTraits = false, traitSourceIds = null) {
    const traitPack = game.packs.get("brinkwood.trait");
    if (!traitPack) return;

    const sourceItemId = data.id ?? data._id;
    const queueKey = sourceItemId ?? `${data.type}:${data.name}`;
    return serializeTraitGrant(this, queueKey, async () => {

    // Compendium queries are indexed-field dependent in v13. Hydrate then
    // filter so every mapped automatic trait source works consistently.
    const requestedTraitSourceIds = traitSourceIds ? new Set(traitSourceIds) : null;
    const traits = (compendiumTraits ?? await traitPack.getDocuments())
      .filter(trait => trait.type === "trait"
        && (requestedTraitSourceIds
          ? requestedTraitSourceIds.has(trait.id ?? trait._id)
          : normalizedTraitSourceName(trait.system.class) === normalizedTraitSourceName(data.name)));
    const alreadyGranted = new Set(this.items
      .filter(item => item.type === "trait" && item.flags?.brinkwood?.traitGrant?.sourceItemId === sourceItemId)
      .map(item => item.flags.brinkwood.traitGrant.traitSourceId));

    // Pre-v13 grants were embedded without our source tag. Only repair a
    // legacy trait when the compendium source proves it, or its exact name and
    // class leave a single possible match. Ambiguous candidates are left alone
    // and suppress creation, so reconciliation can never duplicate a trait.
    const legacyTraits = this.items.filter(item =>
      item.type === "trait" && !item.flags?.brinkwood?.traitGrant);
    const adoptedTraitIds = new Set();
    const uncertainTraitSourceIds = new Set();
    const traitUpdates = [];
    if (adoptLegacyTraits) {
      for (const trait of traits) {
        const traitSourceId = trait.id ?? trait._id;
        if (alreadyGranted.has(traitSourceId)) continue;
        const provenanceMatches = legacyTraits.filter(item =>
          !adoptedTraitIds.has(item.id ?? item._id)
          && traitHasCompendiumProvenance(item, trait));
        const exactMatches = provenanceMatches.length ? [] : legacyTraits.filter(item =>
          !adoptedTraitIds.has(item.id ?? item._id)
          && item.name === trait.name
          && normalizedTraitSourceName(item.system?.class) === normalizedTraitSourceName(data.name));
        const matches = provenanceMatches.length ? provenanceMatches : exactMatches;
        if (matches.length === 1) {
          const legacyTrait = matches[0];
          const legacyTraitId = legacyTrait.id ?? legacyTrait._id;
          adoptedTraitIds.add(legacyTraitId);
          alreadyGranted.add(traitSourceId);
          traitUpdates.push({
            _id: legacyTraitId,
            "flags.brinkwood.traitGrant": {
              sourceItemId,
              sourceItemType: data.type,
              traitSourceId
            }
          });
        } else if (matches.length > 1) {
          uncertainTraitSourceIds.add(traitSourceId);
        }
      }
      if (traitUpdates.length) await this.updateEmbeddedDocuments("Item", traitUpdates);
    }
    const createdTraits = traits
      .filter(trait => !alreadyGranted.has(trait.id ?? trait._id)
        && !uncertainTraitSourceIds.has(trait.id ?? trait._id))
      .map(trait => {
        const traitData = trait.toObject();
        const traitSourceId = trait.id ?? trait._id;
        delete traitData._id;
        traitData.flags ??= {};
        traitData.flags.brinkwood ??= {};
        traitData.flags.brinkwood.traitGrant = {
          sourceItemId,
          sourceItemType: data.type,
          traitSourceId
        };
        return traitData;
      });

    if (createdTraits.length) await this.createEmbeddedDocuments("Item", createdTraits);
    });
  }

  /** Synchronize traits for newly embedded source choices through the actor. */
  async syncTraitGrantsForSources(sources, adoptLegacyTraits = false, traitSourceIds = null) {
    const traitSources = Array.from(sources ?? []).filter(isTraitSource);
    if (!traitSources.length) return;
    const traitPack = game.packs.get("brinkwood.trait");
    if (!traitPack) return;
    const compendiumTraits = await traitPack.getDocuments();
    for (const source of traitSources) {
      await this._addTraits(source, compendiumTraits, adoptLegacyTraits, traitSourceIds);
    }
  }

  /** Retry trait synchronization for source documents already saved on this actor. */
  async repairTraitGrantsForSourceIds(sourceIds, adoptLegacyTraits = false, traitSourceIds = null) {
    const requestedIds = new Set(
      (Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(Boolean)
    );
    const sources = this.items.filter(item =>
      requestedIds.has(item.id ?? item._id) && isTraitSource(item));
    return this.syncTraitGrantsForSources(sources, adoptLegacyTraits, traitSourceIds);
  }

  /**
   * Backfill grants for choices embedded before the v13 trait sync repair.
   * Tagged traits are deleted with their source by deleteEmbeddedDocuments.
   * Untagged traits are adopted only when their compendium provenance, or a
   * unique exact name/class match, establishes that relationship.
   */
  async reconcileTraitGrants() {
    await (this.syncTraitGrantsForSources
      ?? BladesActor.prototype.syncTraitGrantsForSources).call(this, this.items, true);
  }

  /**
   * Configure this persistent Mask sheet's sole Mask source item.
   *
   * This is deliberately not an in-play Mask switch: actor fields (including
   * XP, Essence, abilities, and notes) are never updated here. Deleting a
   * source uses the public actor deletion path, which removes only traits
   * tagged with that exact source. Foundry has no cross-document transaction,
   * so create and strictly synchronize the replacement before removing any
   * prior source. A later removal failure compensates by removing the new
   * source and its tagged grants where possible.
   */
  async configureMask(maskData) {
    if (maskData?.type !== "mask") {
      throw new TypeError("Mask configuration requires an Item of type 'mask'.");
    }

    const requested = foundry.utils.deepClone(maskData);
    delete requested._id;
    delete requested.id;

    return serializeMaskConfiguration(this, async () => {
      const masks = this.items.filter(item => item.type === "mask");
      const retained = masks.find(item => sameMaskChoice(item, requested));

      // Selecting the already configured Mask is idempotent, while still
      // repairing a legacy/failed grant and collapsing corrupted duplicates.
      if (retained && masks.length === 1) {
        await this.syncTraitGrantsForSources([retained]);
        return retained;
      }

      if (retained) {
        await this.syncTraitGrantsForSources([retained]);
        const obsoleteIds = masks
          .filter(item => item !== retained)
          .map(item => item.id ?? item._id)
          .filter(Boolean);
        if (obsoleteIds.length) await this.deleteEmbeddedDocuments("Item", obsoleteIds);
        return retained;
      }

      let created;
      try {
        [created] = await this.createEmbeddedDocuments("Item", [requested]);
        if (!created) throw new Error("Mask configuration did not create a Mask item.");
        await this.syncTraitGrantsForSources([created]);

        const createdId = created.id ?? created._id;
        const isPresent = Boolean(this.items.find(item => (item.id ?? item._id) === createdId && item.type === "mask"));
        if (!isPresent) throw new Error("Mask configuration replacement was not persisted.");

        const obsoleteIds = masks
          .map(item => item.id ?? item._id)
          .filter(Boolean);
        if (obsoleteIds.length) await this.deleteEmbeddedDocuments("Item", obsoleteIds);
        return created;
      } catch (error) {
        const createdId = created?.id ?? created?._id;
        if (createdId) {
          try {
            await this.deleteEmbeddedDocuments("Item", [createdId]);
          } catch (rollbackError) {
            console.error("Brinkwood Mask configuration rollback failed", { actorId: this.id, createdId, rollbackError });
          }
        }
        console.error("Brinkwood Mask configuration failed", {
          actorId: this.id,
          error
        });
        globalThis.ui?.notifications?.warn?.(
          "The Mask configuration could not be saved. Please retry."
        );
        throw error;
      }
    });
  }

  /** Remove the configured Mask and only traits granted by its source. */
  async clearMaskConfiguration() {
    return serializeMaskConfiguration(this, async () => {
      const ids = this.items
        .filter(item => item.type === "mask")
        .map(item => item.id ?? item._id)
        .filter(Boolean);
      return ids.length ? this.deleteEmbeddedDocuments("Item", ids) : [];
    });
  }

  async _loadBasicItems() {
    // Load and create basic items from compendium
    const basicItems = await game.packs.get("brinkwood.item").getDocuments({'system.class': ""});
    await this.createEmbeddedDocuments("Item", basicItems.map(item => item.toObject()));

    // Load and create custom basic items (convert to plain objects to avoid duplication issues)
    const customBasicItems = game.items.filter(i => i.type == "item" && i.system.class == "");
    await this.createEmbeddedDocuments("Item", customBasicItems.map(item => item.toObject()));
  }
}
