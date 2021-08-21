/*
  - Copyright (c) 2014-2019 Cloudware S.A. All rights reserved.
  -
  - This file is part of casper-epaper.
  -
  - casper-epaper is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - casper-epaper  is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with casper-epaper.  If not, see <http://www.gnu.org/licenses/>.
  -
 */

import { LitElement } from 'lit';

export class CasperEpaperWidget extends LitElement {

  static get properties() {
    return {
      /**
       * The icon's name.
       *
       * @type {String}
       */
      overlay: {
        type: String,
        reflect: true
      }
    };
  }

  constructor () {
    super();
    this.overlay  = 'closed'; 
    this._binding = undefined; // or a prop called binding
    this._tag     = undefined;
    this.addEventListener('keypress', e => this._onKeypress(e));
    this.addEventListener('keydown', e => this._onKeyDown(e));
    //this.addEventListener('tap', e => this._onTap(e));
  }

  attach (binding) {
    //console.log("+++ attach ", this.tagName);
    this._binding = binding;
  }

  detach () {
    if ( this.overlay === 'open' ) {
      this._overlay.hidePopover();
      this.overlay = 'closed';
    }
    //console.log("--- detach ", this.tagName);
  }

  /**
   * Show or hide the input control
   *
   * @param {boolean} visible
   */
  setVisible (visible) {
    if (this._visible !== visible) {
      if (visible) {
        this.style.display = 'flex';
      } else {
        this.style.display = 'none';
      }
      this._visible = visible;
    }
    // TODO requestUpdate();
  }

  /**
   * Position and size the input overlay on top the editable element
   *
   * @param {number} x Upper left corner (x)
   * @param {number} y Upper left corner (y)
   * @param {number} w box width in px
   * @param {number} h box height in px
   */
  alignPosition (x, y, w, h) {
    // can we do this in a more litish way ?
    this.style.left = x + 'px';
    this.style.top = y + 'px';
    this.style.width = w + 'px';
    this.style.height = h + 'px';
  }

  _toogleOverlay (event) {
    if ( this.overlay === 'open' ) {
      this.overlay = 'closed';
      this._overlay.hidePopover(event);
    } else {
      this.overlay = 'open';
      this._textArea.value = undefined;
      this._overlay.showPopover(event);
    }
    this._textArea.focus();
  }

  hideOverlays (hideButtons) {
    //this.hideTooltip();
    // TODO this.$.combo.setVisible(false);
    //this.$.date.setVisible(false);
    if (hideButtons) {
    }
  }

  setCasperBinding (binding) {
    // this will most likely die to (painfull death)
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                             ~~~ Input helper functions ~~~                            */
  /*                                                                                       */
  /*****************************************************************************************/

  grabFocus () {
    // to nothing if don't know what to do 
  }

  _onKeypress (event) {
    /* do nothing */
  }

  /**
   * Convert keycode to virtual key code that is understood by the server
   *
   * @param event The Keyboard event
   *
   * @return the virtual key name or null if there no mapping
   */
  _keycodeToVkey (event) {
    switch (event.keyCode) {
      case 8: // backspace
        return 'backspace';
      case 9: // tab
        if (event.shiftKey === true) {
          return 'shift+tab';
        } else {
          return 'tab';
        }
        break;
      case 13: // enter
        return 'enter';
      case 27: // escape
        return 'esc';
      case 32: // space
        return ' ';
      case 37: // left
        return 'left';
      case 39: // right
        return 'right';
      case 38: // up
        if (event.shiftKey === true) {
          return 'shift+up';
        } else {
          return 'up';
        }
        break;
      case 40: // down
        if (event.shiftKey === true) {
          return 'shift+down';
        } else {
          return 'down';
        }
        break;
      case 46:
        return 'delete';
      case 65:
        if (event.ctrlKey) {
          return 'ctrl+a';
        }
        break;
      case 69:
        if (event.ctrlKey) {
          return 'ctrl+e';
        }
        break;
      case 75:
        if (event.ctrlKey) {
          return 'ctrl+k';
        }
        break;
      case 113:
        return 'F2';
      case 16:
        return 'shift';
      case 17:
        return 'ctrl';
      case 18:
        return 'alt';
      case 91:
        return 'window+left';
      case 92:
        return 'window+right';
      default:
        break;
    }
    return null;
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                            ~~~ Tooltip management ~~~                                 */
  /*                                                                                       */
  /*****************************************************************************************/

  /**
   * Called when the server updates the tooltip, passes the bounding box and text
   *
   * If the mid point of the server bounding box is not inside the current input bounds discard the update, this
   * test discards tooltip updates that came too late and are no longer related to the focused field
   *
   * @param left leftmost corner of server's field bounding box
   * @param top upper corner of server's field bounding box
   * @param width of the server's field bounding box
   * @param height of the server's field bounding box
   * @param content the new tooltip content
   */
  serverTooltipUpdate (left, top, width, height, content) {
    let mid_x, mid_y, bbi, bbc;

    bbc = this.epaper.__canvas.getBoundingClientRect();
    if ( this._textArea === undefined ) {
      return; // TODO
    }
    bbi = this._textArea.getBoundingClientRect();
    mid_x = bbc.left + left + width / 2;
    mid_y = bbc.top + top + height / 2;

    // ... if the mid point of the tooltip hint is outside the editor bounding box discard it ...
    if (mid_x < bbi.left || mid_x > bbi.right || mid_y < bbi.top || mid_y > bbi.bottom) {
      return;
    } 
    if (content.length) {
      console.log('Show tooltip:', content); // TODO port to casper-app
      //this.epaper.$.tooltip.show(content); // TODO port to casper-app
    } else {
      this.hideTooltip();
    }
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                            ~~~ Tooltip management ~~~                                 */
  /*                                                                                       */
  /*****************************************************************************************/

  /**
   * Called when the server updates the tooltip, passes the bounding box and text
   *
   * If the mid point of the server bounding box is not inside the current input bounds discard the update, this
   * test discards tooltip updates that came too late and are no longer related to the focused field
   *
   * @param left leftmost corner of server's field bounding box
   * @param top upper corner of server's field bounding box
   * @param width of the server's field bounding box
   * @param height of the server's field bounding box
   * @param content the new tooltip content
   */
  serverTooltipUpdate (left, top, width, height, content) {

  }

  showTooltip (content, positionTarget) {
    // TODO remove hard coded app
    const prect = this.epaper.getBoundingClientRect();
    window.app.tooltip.show(content, {
      height: positionTarget.height,
      left: positionTarget.left + prect.left,
      top: positionTarget.top + prect.top,
      width: positionTarget.width
    });
  }

  hideTooltip () {
    // TODO port to casper-app
    //window.app.tooltip.hide();
    //if (this.epaper.$.tooltip.hide !== undefined) {
    //  this.epaper.$.tooltip.hide();
    //}
    // [AG] - don't know why the above code is disabled - but epaper v2 needs this
    if ( 2.0 === this.epaper._socket._version ) {
      window.app.tooltip.hide();
    }
  }
}

//window.customElements.define('casper-epaper-widget', CasperEpaperWidget);
