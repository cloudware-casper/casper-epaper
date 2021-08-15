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
      display: none;
      position: absolute;
      background-color: orange;
      border: 2px solid red;
      box-sizing: border-box;
    }
    
    input {
      width: 100%;
      height: 100%;
      padding: 0px;
      margin: 0px;
      border: none;
      box-sizing: border-box;
      outline: none;
      background-color: rgba(0,0,0,0);
    }`;

  render () {
    return html`<input id="textarea" tabindex="1" autocomplete="off"></input>`;
  }

  firstUpdated () {
    this._textArea = this.renderRoot.getElementById('textarea');
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
    super.alignPosition(x,y,w,h);
    return;
    /*_input*/this._textArea.style.left = '0px';
    /*_input*/this._textArea.style.top = '0px';
    /*_input*/this._textArea.style.width = w + 'px';
    /*_input*/this._textArea.style.height = h + 'px';
    /*_input*/this._textArea.scrollTop = 0;
    /*_input*/this._textArea.scrollLeft = 0;
  }

  /**
   * Align the HTML input text size baseline and left edge with the text drawn in the canvas, also sets color
   *
   * @param {number} a_text_left   Starting point of left aligned text # TODO paddding
   * @param {number} a_baseline    Vertical baseline of the first text line # TODO remove??? or do PADDING?
   */
  alignStyle (a_text_left, a_baseline) {

    // Make baseline and edge relative to input pox
    var ratio = this.epaperDocument.__ratio;
    var tl = a_text_left / ratio - this._x;
    var bl = a_baseline / ratio - this._y;
    var top = this._f_top / ratio;
  
    /*console.log(' ==> tl=' + tl + ' bl=' + bl + ' top=' + top);*/
  
    //this._textArea.style.padding     = '0px';
    //this._textArea.style.margin      = '0px';
    //this._textArea.style.marginLeft = Math.max(tl, 1) + 'px';
    //this._textArea.style.marginRight = Math.max(tl, 1) + 'px';
    //this._textArea.style.marginTop   = Math.max(bl + top, 1) + 'px';
    this._textArea.style.fontFamily = this.epaperDocument.fontSpec[CasperEpaperServerDocument.FONT_NAME_INDEX];
    this._textArea.style.fontSize = this.epaperDocument.fontSpec[CasperEpaperServerDocument.SIZE_INDEX] / ratio + 'px';
    this._textArea.style.color = this.epaper._text_color;
  }

  setValue (value, displayValue) {
    this._textArea.value = value;
    this._textArea.selectionStart = 0;
    this._textArea.selectionEnd = value.length;
    this._initialSelection = true;
  }

  _onKeyDown (event) {
    const vkey = this._keycodeToVkey(event);

    if (this._initialSelection === true || this._textArea.value.length === 0) {
      if (['down', 'up', 'left', 'right'].indexOf(vkey) > -1) {
        this.epaperDocument.__socket.moveCursor(this.epaperDocument.documentId, vkey);
        event.preventDefault();
        return;
      } else if (['tab', 'shift+tab'].indexOf(vkey) > -1) {
        if (this._initialSelection === true) {
          this._initialSelection = false;
          if (vkey === 'shift+tab') {
            this.epaperDocument.__socket.sendKey(this.epaperDocument.documentId, 'tab', 'shift');
          } else {
            this.epaperDocument.__socket.sendKey(this.epaperDocument.documentId, vkey);
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
      this.epaperDocument.__socket.setText(this.epaperDocument.documentId,
        this._textArea.value,
        vkey === 'shift+tab' ? 'left' : 'right');
      // this._setTextResponse.bind(this)); TODO WE HAVE A PROMISE NOW
      event.preventDefault();
      return;
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
    const bbc   = this.epaper.__canvas.getBoundingClientRect();
    const bbi   = this._textArea.getBoundingClientRect();
    const mid_x = bbc.left + left + width / 2;
    const mid_y = bbc.top + top + height / 2;

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
  
}

window.customElements.define('casper-epaper-text-widget', CasperEpaperTextWidget);