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
import { css, html } from 'lit';
import { CasperEpaperWidget } from './casper-epaper-widget.js';
import { CasperEpaperServerDocument } from './casper-epaper-server-document.js';


export class CasperEpaperTextWidget extends CasperEpaperWidget {
  
  constructor () {
    super();
  }



  static styles = css`
    :host {
      display: flex;
      position: absolute;
      background-color: #D9E2F3;
      border-bottom: 3px solid var(--dark-primary-color);
      align-items: center;
    }

    .overlay-icon {
      align-self: flex-center;
      color: var(--dark-primary-color);
      margin: 3px;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 200ms linear;
    }

    .overlay-icon[overlay=open] {
      transform: rotate(180deg);
    }
    
    input {
      height: 100%;
      width: 100%;
      padding: 0px;
      margin: 0px;
      border: none;
      box-sizing: border-box !important;
      outline: none !important;
      background-color: transparent !important;
    }`;

  render () {
    return html`<input id="textarea" tabindex="1" autocomplete="off"></input>`;
  }

  firstUpdated () {
    this._textArea = this.renderRoot.getElementById('textarea');
  }

  updated () {
     // TODO can I do this tru style in a more litish way
    this.alignPosition(this._binding.x, this._binding.y, this._binding.w, this._binding.h);
    this._textArea.style.fontFamily = this._binding.font; 
    this._textArea.style.fontSize   = this._binding.fs / this._binding.ratio + 'px'; 
    this._textArea.style.color      = this._binding.fc;  

    console.warn('todo limit max size of overlay icon!!!');

    this._textArea.value = this._binding.t;
    this._textArea.selectionStart = 0;
    this._textArea.selectionEnd = this._binding.t.length;
    this._initialSelection = true;
  }

  _onKeyDown (event) {
    const vkey = this._keycodeToVkey(event);

    if (this._initialSelection === true || this._textArea.value.length === 0) {
      if (['down', 'up', 'left', 'right'].indexOf(vkey) > -1) {
        this.epaper._socket.moveCursor(this.epaper.documentId, vkey);
        event.preventDefault();
        return;
      } else if (['tab', 'shift+tab'].indexOf(vkey) > -1) {
        if (this._initialSelection === true) {
          this._initialSelection = false;
          if (vkey === 'shift+tab') {
            this.epaper._socket.sendKey(this.epaper.documentId, 'tab', 'shift');
          } else {
            this.epaper._socket.sendKey(this.epaper.documentId, vkey);
          }
          event.preventDefault();
          return;
        }
      } else if (['enter', 'F2'].indexOf(vkey) > -1) {
        this._textArea.selectionStart = this._textArea.value.length;
        this._textArea.selectionEnd = this._textArea.value.length;
        if (this._initialSelection === true || vkey === 'F2') {
          this._initialSelection = false;
          event.preventDefault();
          return;
        }
      } else {
        this._initialSelection = false;
      }
    }

    if (['enter', 'tab', 'shift+tab'].indexOf(vkey) > -1) {
      this.epaper._socket.setText(this.epaper.documentId,
        this._textArea.value,
        vkey === 'shift+tab' ? 'left' : 'right');
      // this._setTextResponse.bind(this)); TODO WE HAVE A PROMISE NOW
      event.preventDefault();
      return;
    }
  }



  grabFocus () {
    if ( this._textArea ) {
      if (this._initialSelection === true) {
        this._textArea.selectionStart = 0;
        this._textArea.selectionEnd = this._textArea.value.length;
      }
      this._textArea.focus();
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

    if ( this._textArea === undefined ) {
      return; // TODO
    }
    const bbc   = this.epaper._canvas.getBoundingClientRect();
    const bbi   = this._textArea.getBoundingClientRect();
    const mid_x = bbc.left + left + width / 2;
    const mid_y = bbc.top + top + height / 2;

    // ... if the mid point of the tooltip hint is outside the editor bounding box discard it ...
    if (mid_x < bbi.left || mid_x > bbi.right || mid_y < bbi.top || mid_y > bbi.bottom) {
      return;
    }
    if (content.length) {
      //console.log('Show tooltip:', content); // TODO port to casper-app
      //this.epaper.$.tooltip.show(content); // TODO port to casper-app
    } else {
      this.hideTooltip();
    }
  }
  
}

window.customElements.define('casper-epaper-text-widget', CasperEpaperTextWidget);