/*
  - Copyright (c) 2016 Neto Ranito & Seabra LDA. All rights reserved.
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

import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';

class CasperEpaperServertipHelper extends PolymerElement {

  static get is () {
    return 'casper-epaper-servertip-helper';
  }

  static get properties () {
    return {
      /** Mouse move threshold, movement bellow this treshold is ignored */
      threshold: {
        type: Number,
        value: 4
      },
      /** Time the mouse has to stay in overing inside the threshold to trigger a request */
      hoveringTime: {
        type: Number,
        value: 500
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
        type: Boolean,
        value: false
      }
    };
  }

  ready () {
    this._last_x          = undefined;
    this._last_y          = undefined;
    this._center_x        = undefined;
    this._center_y        = undefined;
    this._left            = undefined;
    this.threshold        = 4;
    this.hoveringTime     = 500;
    this._scalePxToServer = 1.0;
    this._timer           = undefined;
  }

  detached () {
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
        this.input.hideTooltip();
        this._left = undefined;
        this._resetTimer();
      }
    }
    this._last_x = x;
    this._last_y = y;
  }

  /**
   * Requests the server side hint for the current hovering point
   *
   * @param {number} x coordinate where the mouse is overing
   * @param {number} y coordinate where the mouse is overing
   */
  _getHint (x, y) {
    var hintCallback = function (a_epaper, a_message) {
        var x, y, w, h, l, t;

        a_epaper._message = a_message;
        a_epaper._r_idx   = 'S:ok:hint:'.length;
        x = a_epaper._getDouble() / this._scalePxToServer;
        y = a_epaper._getDouble() / this._scalePxToServer;
        w = a_epaper._getDouble() / this._scalePxToServer;
        h = a_epaper._getDouble() / this._scalePxToServer;
        l = a_epaper._getDouble();
        if ( l ) {
          t = a_message.substring(a_epaper._r_idx, a_epaper._r_idx + l);

          // Update the bounding box
          this._left   = x;
          this._top    = y;
          this._width  = w;
          this._height = h;

          this.input.showTooltip(t.toUpperCase(), { left: x, top: y, width: w, height: h });
        }
    };

    this.epaper._callRpc('hint', 'get hint ' + (this._scalePxToServer * x).toFixed(2) + ',' + (this._scalePxToServer * y).toFixed(2) + ';',
                          hintCallback.bind(this));
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
      this.cancelAsync(this._timer);
    }
    this._timer = this.async(this._onOverHandler.bind(this), this.hoveringTime);
  }

  /**
   * Resets the mouse over control timer
   */
  _resetTimer () {
    if ( this._timer !== undefined ) {
      this.cancelAsync(this._timer);
      this._timer = undefined;
    }
  }

  /**
   * Checks if the mouse has stayed inside the threshold
   *
   * If the mouse has stayed within the threshold get the hint, if not just update the reference point.
   */
  _onOverHandler () {
    if ( Math.abs(this._center_x - this._last_x) <= this.threshold &&
         Math.abs(this._center_y - this._last_y) <= this.threshold ) {
      this._getHint(this._center_x, this._center_y);
      this._resetTimer();
    } else {
      this._updateCenter(this._last_x, this._last_y);
    }
  }
}