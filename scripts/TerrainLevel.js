/* globals
canvas
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS } from "./const.js";
import { TerrainKey } from "./TerrainPixelCache.js";

/**
 * Represent the terrain at a specific level.
 * Meant to be duplicated so that the underlying Terrain is not copied.
 * Stores the level information for this terrain.
 */
export class TerrainLevel {

  /** @type {TerrainKey} */
  key = new TerrainKey(0);

  constructor(terrain, level) {
    this.terrain = terrain ?? canvas.terrain.controls.currentTerrain;
    this.level = level ?? canvas.terrain.controls.currentLevel;
    this.scene = canvas.scene;
    this.key = TerrainKey.fromTerrainValue(this.terrain.pixelValue, this.level);
  }

  // Simple getters used to pass through terrain values.

  /** @type {string} */
  get name() { return this.terrain.name; }

  /** @type {number} */
  get pixelValue() { return this.terrain.pixelValue; }

  /** @type {FLAGS.ANCHOR.CHOICES} */
  get anchor() { return this.terrain.anchor; }

  /** @type {boolean} */
  get userVisible() { return this.terrain.userVisible; }

  /**
   * Retrieve the anchor elevation of this level in this scene.
   * @returns {number}
   */
  _layerElevation() {
    const layerElevations = canvas.scene.getFlag(MODULE_ID, FLAGS.LAYER_ELEVATIONS) ?? (new Array(8)).fill(0);
    return layerElevations[this.level];
  }

  /**
   * Retrieve the elevation of the terrain at this point.
   * @returns {number}
   */
  _canvasElevation(location) { return canvas.elevation?.elevationAt(location) ?? 0; }

  /**
   * Determine the anchor elevation for this terrain.
   * @param {Point} [location]    Location on the map. Required if the anchor is RELATIVE_TO_TERRAIN and EV is present.
   * @returns {number}
   */
  getAnchorElevation(location) {
    const CHOICES = FLAGS.ANCHOR.CHOICES;
    switch ( this.anchor ) {
      case CHOICES.ABSOLUTE: return 0;
      case CHOICES.RELATIVE_TO_TERRAIN: return location ? this._canvasElevation(location) : 0;
      case CHOICES.RELATIVE_TO_LAYER: return this._layerElevation;
    }
  }

  /**
   * Elevation range for this terrain at a given canvas location.
   * @param {Point} [location]    Location on the map. Required if the anchor is RELATIVE_TO_TERRAIN and EV is present.
   * @returns {min: {number}, max: {number}}
   */
  elevationRange(location) {
    const anchorE = this.getAnchorElevation(location);
    return this.terrain._elevationMinMaxForAnchorElevation(anchorE);
  }

  /**
   * Determine if the terrain is active at the provided elevation.
   * @param {number} elevation    Elevation to test
   * @param {Point} [location]    Location on the map. Required if the anchor is RELATIVE_TO_TERRAIN and EV is present.
   * @returns {boolean}
   */
  activeAt(elevation, location) {
    const minMaxE = this.elevationRange(location);
    return elevation.between(minMaxE.min, minMaxE.max);
  }
}
