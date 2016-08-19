/*-------------------------------------------------------------------------*
 * Copyright (c) 2010-2016 Neto Ranito & Seabra LDA. All rights reserved.
 *
 * This file is part of casper.
 *
 * casper is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * casper  is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with casper.  If not, see <http://www.gnu.org/licenses/>.
 *-------------------------------------------------------------------------*/

"use strict";

function EPaperOverlayButton_Initialize (a_root)
{
  console.log('Hello cruel JS world');

  /**
   * @brief Overlay button constructor
   *
   * @param a_epaper     Parent EPaper object
   * @param a_image      An Image object
   * @param a_handler    An optional click handler that receives this button instance func(a_button)
   */
  a_root.EPaperOverlayButton = function (a_epaper, a_image, a_handler) {
    EPaperWidget.call(this, a_epaper, "#d7e3f4", "#009BB5");
    this._click_handler = a_handler;
    this._image         = a_image;
    this._cursor        = 'pointer';
    this._sx            = 0;
  };

  EPaperOverlayButton.prototype = Object.create(EPaperWidget.prototype, {
    constructor: {
      configurable: true,
      enumarable: true,
      value: EPaperOverlayButton.prototype,
      writable: true
    }
  });

  /*
   * Static data, preloaded images for common buttons
   */
  EPaperOverlayButton.COMBO_CLOSE  = undefined;
  EPaperOverlayButton.COMBO_OPEN   = undefined;
  EPaperOverlayButton.COMBO_EDIT   = undefined;
  EPaperOverlayButton.COMBO_DELETE = undefined;
  EPaperOverlayButton.MENU_ADD     = undefined;
  EPaperOverlayButton.MENU_DELETE  = undefined;
  EPaperOverlayButton.MENU_CLOSE   = undefined;

  /**
   * @brief Called at startup to start the deferred loading of the auxiliary graphic assets
   *
   * @param a_asset_debug when true loading errors cause a pesky alert box to appear
   * @param a_asset_url   base URL of the static asset server
   * @param a_digest      Hash generated by asset pipeline
   */
  EPaperOverlayButton.load_assets = function (a_epaper, asset_debug, a_asset_url, a_digest) {
    var suffix;

    if ( a_epaper._ratio !== 1.0) {
      suffix = '@2x' + a_digest + '.png';
    } else {
      suffix = a_digest + '.png';
    }

    EPaperOverlayButton.MENU_ADD     = a_epaper.load_asset(asset_debug, a_asset_url, 'menu_add'     + suffix);
    EPaperOverlayButton.MENU_DELETE  = a_epaper.load_asset(asset_debug, a_asset_url, 'menu_delete'  + suffix);
    EPaperOverlayButton.MENU_CLOSE   = a_epaper.load_asset(asset_debug, a_asset_url, 'menu_close'   + suffix);
    EPaperOverlayButton.COMBO_DELETE = a_epaper.load_asset(asset_debug, a_asset_url, 'combo_delete' + suffix);
    EPaperOverlayButton.COMBO_CLOSE  = a_epaper.load_asset(asset_debug, a_asset_url, 'combo_close'  + suffix);
    EPaperOverlayButton.COMBO_OPEN   = a_epaper.load_asset(asset_debug, a_asset_url, 'combo_open'   + suffix);
    EPaperOverlayButton.COMBO_EDIT   = a_epaper.load_asset(asset_debug, a_asset_url, 'combo_edit'   + suffix);
  };

  /**
   * @brief changes the button image
   *
   * @param a_image an Image object
   *
   * @return "das" widget
   */
  EPaperOverlayButton.prototype.set_image = function (a_image) {

    this._image  = a_image;
    this._state |= EPaperWidget.IS_FG_DIRTY;
    this.update_graphic();
    return this;
  };

  /**
   * @brief Update the current image offset to position the sprite
   */
  EPaperOverlayButton.prototype.update_graphic = function () {

      if ( (this._state & ~EPaperWidget.IS_ENABLED) === 0 ) {

        this._sx = 3 * this._bb_w;

      } else if ( this._state & EPaperWidget.IS_CLICKED ) {

        this._sx = 2 * this._bb_w;

      } else if ( this._state & EPaperWidget.IS_MOUSE_OVER ) {

        this._sx = 1 * this._bb_w;

      } else {

        this._sx = 0;

      }
    };

  EPaperOverlayButton.prototype.paint = function () {

    // ... auto sizing to image size
    if ( ! (this.state & ~EPaperWidget.HAS_SIZE) ) {
      if ( this._image !== undefined && this._image.width !== 0 ) {
        this.set_size(this._image.width / 5, this._image.height);
      }
    }

    EPaperWidget.prototype.paint.call(this);

    if ( (this._state & (EPaperWidget.IS_VISIBLE | EPaperWidget.IS_FG_DIRTY)) === (EPaperWidget.IS_VISIBLE | EPaperWidget.IS_FG_DIRTY) ) {
      if ( this._background !== undefined ) {
        this._epaper._ctx.putImageData(this._background, this._bg_x, this._bg_y + this._epaper._translate_y);
        this._epaper._ctx.drawImage(this._image, this._sx, 0, this._bb_w, this._bb_h, this._bb_x, this._bb_y, this._bb_w, this._bb_h);
        this._state &= ~EPaperWidget.IS_FG_DIRTY;
      }
    }
  };

}