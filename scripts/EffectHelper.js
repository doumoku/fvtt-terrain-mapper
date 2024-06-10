/* globals
CONFIG,
foundry,
fromUuidSync
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Settings } from "./settings.js";
import { FLAGS, COLORS, MODULE_ID } from "./const.js";

/**
 * Class to handle creating and storing the active effect for a given Terrain.
 */
export class EffectHelper {
  // Default colors for terrains.
  static COLORS = COLORS;

  static #colorId = 0;

  static nextColor() { return this.COLORS[this.#colorId++]; }

  /** @type {ActiveEffect} */
  effect;

  constructor(activeEffect) {
    if ( !activeEffect ) return;
    if ( !(activeEffect instanceof ActiveEffect) ) activeEffect = new CONFIG.ActiveEffect.documentClass(activeEffect);
    if ( this.constructor.terrainEffectExists(activeEffect) ) {
      this.effect = this.constructor.getTerrainEffectById(activeEffect._id);
    }
  }

  /**
   * Retrieve an active effect by id and return the EffectHelper for that effect.
   * @param {string} id         Active effect id
   * @returns {EffectHelper}
   */
  static fromId(id) {
    const effect = this.getTerrainEffectById(id);
    if ( !effect ) {
      console.error(`EffectHelper.fromId|id ${id} not found in the terrains item.`);
      return;
    }
    return new this(effect);
  }

  /**
   * @typedef {object} TerrainEffectConfig    Data passed to the active effect
   * @property {string} name
   * @property {string} description
   * @property {string} icon
   * @property {object} flags
   * @property {string} origin
   */

  /**
   * Initialize by creating a new effect or retrieving an existing effect.
   * @param {TerrainEffectConfig} config
   */
  async initialize(config) {
    this.effect = await this._createActiveEffect(config);
  }

  /**
   * Create a new active effect on the TerrainsItem.
   * @param {TerrainEffectConfig} [config]
   * @returns {ActiveEffect}
   */
  async _createActiveEffect(config = {}) {
    const item = Settings.terrainEffectsItem;

    // Set needed defaults.
    config.name ??= "New Terrain";
    config.description ??= "";
    config.img ??= "icons/svg/mountain.svg";
    config.flags ??= {};
    config.origin ??= item.uuid;

    // Store other terrain data as flags on the effect.
    const terrainFlags = {};
    const tf = terrainFlags[MODULE_ID] = {};
    tf[FLAGS.ANCHOR.VALUE] = config.anchor ?? FLAGS.ANCHOR.CHOICES.RELATIVE_TO_TERRAIN;
    tf[FLAGS.OFFSET] = config.offset ?? 0;
    tf[FLAGS.RANGE_BELOW] = config.rangeBelow ?? 0;
    tf[FLAGS.RANGE_ABOVE] = config.rangeAbove ?? 0;
    tf[FLAGS.USER_VISIBLE] = config.userVisible ?? false;
    tf[FLAGS.COLOR] = config.color ?? this.constructor.nextColor();
    config.flags = foundry.utils.mergeObject(terrainFlags, config.flags);

    // Create the active effect.
    const effect = new CONFIG.ActiveEffect.documentClass(config);

    // Add the effect to TerrainsItem.
    const effects = await item.createEmbeddedDocuments("ActiveEffect", [effect]);
    return effects[0];
  }

  /**
   * Open the configuration sheet for this effect.
   */
  async edit() { this.effect.sheet.render(true); }

  /**
   * Delete this effect from the TerrainsItem.
   */
  async delete() {
    const item = Settings.terrainEffectsItem;
    const res = await item.deleteEmbeddedDocuments("ActiveEffect", [this.effect._id]);
    this.effect = undefined;
    return res;
  }

  /**
   * Duplicate this effect. Returns a new effect helper.
   * @returns {EffectHelper}
   */
  async duplicate() {
    const item = Settings.terrainEffectsItem;
    if ( !item ) return;
    const effectData = foundry.utils.deepClone(this.effect.toObject());
    delete effectData._id;
    const effect = new CONFIG.ActiveEffect.documentClass(effectData);
    const effects = await item.createEmbeddedDocuments("ActiveEffect", [effect]);
    return new this.constructor(effects[0]);
  }

  async addToToken(tokenUUID) {
    const tokenD = fromUuidSync(tokenUUID);
    if ( !tokenD ) return;
    const actor = tokenD.object?.actor;
    if ( !actor ) return;

    // TODO: Do we need to use foundry.utils.deepClone here?
    if ( !this.effect ) return;

    const effectData = this.effect.toObject();
    effectData.origin = `TerrainMapper.${this.effect._id}`;
    effectData.flags[MODULE_ID] ??= {};
    effectData.flags[MODULE_ID][FLAGS.EFFECT_ID] = this.effect._id;
    if ( effectData.img && Settings.get(Settings.KEYS.AUTO_TERRAIN.DISPLAY_ICON) ) effectData.statuses = [effectData.img];
    return await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  async removeFromToken(tokenUUID) {
    const tokenD = fromUuidSync(tokenUUID);
    if ( !tokenD ) return;
    const actor = tokenD.object?.actor;
    if ( !actor ) return;

    // Need to find the effect that shares this id.
    const ids = actor.effects.filter(e => e.flags?.[MODULE_ID]?.effectId === this.effect._id).map(e => e._id);
    if ( !ids.length ) return;
    return await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }

  static async deleteEffectById(id) {
    const item = Settings.terrainEffectsItem;
    if ( !item ) return;

    const activeEffect = this.getTerrainEffectById(id);
    if ( !activeEffect ) return;
    await item.deleteEmbeddedDocuments("ActiveEffect", [activeEffect._id]);
  }

  /**
   * List all effects in the TerrainsItem.
   * @returns {ActiveEffect[]}
   */
  static getAll() {
    const item = Settings.terrainEffectsItem;
    return item?.effects ?? [];
  }

  /**
   * Is this active effect already in the TerrainsItem?
   * @param {ActiveEffect} effect
   * @returns {boolean}
   */
  static terrainEffectExists(effect) {
    const item = Settings.terrainEffectsItem;
    if ( !item ) return false;
    if ( item instanceof Item ) return item.effects.has(effect._id);
    return item.effects.some(e => e._id === effect._id);
  }

  /**
   * Match an existing terrain effect by name to one in TerrainsItem.
   * @param {string} name
   * @returns {ActiveEffect}
   */
  static getTerrainEffectByName(name) {
    const item = Settings.terrainEffectsItem;
    if ( !item ) return undefined;
    const effect = item.effects.find(e => e.name === name);
    if ( !effect ) return undefined;
    return effect instanceof ActiveEffect ? effect
      : new CONFIG.ActiveEffect.documentClass(effect);
  }

  /**
   * Match an existing terrain effect by id to one in TerrainsItem.
   * @param {string} id
   * @returns {ActiveEffect}
   */
  static getTerrainEffectById(id) {
    const item = Settings.terrainEffectsItem;
    if ( !item ) return undefined;
    const effect = item.effects.find(e => e._id === id); // _id for not yet instantiated effects.
    if ( !effect ) return undefined;
    return effect instanceof ActiveEffect ? effect
      : new CONFIG.ActiveEffect.documentClass(effect);
  }
}
