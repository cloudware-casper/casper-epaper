/*
  - Copyright (c) 2016 Cloudware S.A. All rights reserved.
  -
  - This file is part of casper-combolist.
  -
  - casper-combolist is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - casper-combolist  is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with casper-combolist.  If not, see <http://www.gnu.org/licenses/>.
  -
 */

import { LitElement } from 'lit';

class CasperEpaperServertipHelper extends LitElement {

  static get properties () {
    return  {
      /** Mouse move threshold, movement bellow this treshold is ignored */
      threshold: {
        type: Number
      },
      /** Time the mouse has to stay in overing inside the threshold to trigger a request */
      hoveringTime: {
        type: Number
      },
      /** Parent casper-epaper element that owns the this helper */
      epaper: {
        type: Object
      },
      /** Associated input box */
      input: {
        type: Object
      },
      /** true to enable hint requests */
      enabled: {
        type: Boolean
      }
    };
  }

  constructor () {
    super();
    this.threshold    = 4;
    this.hoveringTime = 500;
    this.enabled      = false;
  }

  connectedCallback () {
    this._last_x          = undefined;
    this._last_y          = undefined;
    this._center_x        = undefined;
    this._center_y        = undefined;
    this._left            = undefined;
    this._scalePxToServer = 1.0;
    this._timer           = undefined;
  }

  disconnectedCallback () {
    this._resetTimer();
  }

  /**
   * Handle mouse over event
   *
   * @param {number} x horizontal coordinate of the mouse event (relative to canvas)
   * @param {number} y vertical coordinate of the mouse event (relative to canvas)
   * @param {number} s scale to convert screen px to server pt scale
   */
  onMouseMove (x, y, s) {
    var mouse_over;

    if ( ! this.enabled ) {
      return;
    }

    this._scalePxToServer = s;

    if ( this._left === undefined ) {
      if ( this._center_x === undefined               ||
        Math.abs(this._center_x - x) > this.threshold ||
        Math.abs(this._center_y - y) > this.threshold ) {
        // ... (re)initialize the reference center and (re)start the timeout ...
        this._updateCenter(x, y);
      }
    } else {
      // ... if the mouse leaves the tip's reference BB hide the tooltip ...
      if ( x < this._left || x > this._left + this._width || y < this._top || y > this._top + this._height ) {
        if ( this.input ) {
          this.input.hideTooltip();
        }
        this._left = undefined;
        this._resetTimer();
      }
    }
    this._last_x = x;
    this._last_y = y;
  }

   /**
    * Get hint response handler, receives the bbounding box and message that applies to that area
    * if there is no hint the bbox is all 0's and there is no message
    */
  _getHintResponse (response) {
    if ( response.success === true && response.hint.length > 0 ) {
      this._left   = response.bbox.x / this._scalePxToServer;
      this._top    = response.bbox.y / this._scalePxToServer;
      this._width  = response.bbox.w / this._scalePxToServer;
      this._height = response.bbox.h / this._scalePxToServer;
      if ( this.input ) {
        this.input.showTooltip(response.hint, { left: this._left, top: this._top, width: this._width, height: this._height});
      }
    }
  }

  /**
   * Update the reference point for mouse hovering, starts our re-starts the sampling timer
   *
   * @param {number} x horizontal coordinate of the new reference center
   * @param {number} y vertical coordinate of the new reference center
   */
  _updateCenter (x, y) {
    this._center_x = x;
    this._center_y = y;

    if ( this._timer !== undefined ) {
      clearTimeout(this._timer);
    }
    this._timer = setTimeout(() => this._onOverHandler(), this.hoveringTime);
  }

  /**
   * Resets the mouse over control timer
   */
  _resetTimer () {
    if ( this._timer !== undefined ) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }

  /**
   * Checks if the mouse has stayed inside the threshold
   *
   * If the mouse has stayed within the threshold get the hint, if not just update the reference point.
   */
  async _onOverHandler () {
    if ( Math.abs(this._center_x - this._last_x) <= this.threshold &&
         Math.abs(this._center_y - this._last_y) <= this.threshold ) {
      let socket;
      if ( 2.0 === this.epaper._socket._version ) { // TODO make this less hardcoded
        socket = this.epaper.app.socket2;
      } else {
        socket = this.epaper.app.socket;
      }
      let response = await socket.getHint(
        this.epaper.documentId,
        this._scalePxToServer * this._center_x,
        this._scalePxToServer * this._center_y
      );
      this._getHintResponse(response);
      this._resetTimer();
    } else {
      this._updateCenter(this._last_x, this._last_y);
    }
  }
}

window.customElements.define('casper-epaper-servertip-helper', CasperEpaperServertipHelper);
