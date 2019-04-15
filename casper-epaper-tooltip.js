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

class CasperEpaperTooltip extends PolymerElement {

  static get template () {
    return html`
      <style>
        :host {
          display: block;
          position: absolute;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-user-select: none;
          user-select: none;
          width: 50px;
        }

        .visible {
          visibility: visible;
          opacity: 1;
          transition: visibility 0.1s, opacity 0.1s linear;
        }

        .hidden {
          visibility: hidden;
          opacity: 0;
          transition: visibility 0.5s, opacity 0.5s ease-in;
        }

        #canvas {
          position: absolute;
        }

        #text {
          text-transform: uppercase;
          text-align: center;
          position: absolute;
          padding: 5px;
          font-size: 10px;
          color: white;
          cursor: pointer;
        }

      </style>
      <canvas id="canvas"></canvas>
      <div id="text"></div>
    `;
  }

  static get is () {
    return 'casper-epaper-tooltip';
  }

  static get properties () {
    return {
      radius: {
        type: Number,
        value: 5
      },
      tipHeight: {
        type: Number,
        value: 5
      },
      tipBase: {
        type: Number,
        value: 10
      },
      tipLocation: {
        type: Number,
        value: 0.5
      },
      positionTarget: {
        type: Element
      },
      fitInto: {
        type: Element
      },
      _showing: {
        type: Boolean,
        value: false
      }
    };
  }

  ready () {
    this._ctx = this.$.canvas.getContext('2d');
    this._tipEdge = 'N';
    this._setupPixelRatio();
  }

  attached () {
    this.listen(this, 'tap', 'hide');
    this._showing = true;
  }

  detached () {
    this.unlisten(this, 'tap', 'hide');
  }

  /**
   * Define the tooltip location
   *
   * @param left horizontal position
   * @param top vertical position
   */
  setLocation (left, top) {
    this.style.left = left + 'px';
    this.style.top = top + 'px';
    this.updateStyles();
  }

  setVisible (visible) {
    this.toggleClass('hidden' , !visible, this.$.canvas);
    this.toggleClass('hidden' , !visible, this.$.text);
    this.toggleClass('visible',  visible, this.$.canvas);
    this.toggleClass('visible',  visible, this.$.text);
  }

  /**
   * Layout tool tip and set text
   *
   * The bounding box of the "controlling" area is used to position the tooltip below. The arrow
   * is centered along the lower edge of the controller and body of the tooltip is adjusted to
   * fit inside the central 90% of the page.
   *
   * @param content The tooltip message to show
   */
  show (content, positionTarget) {
    var tooltipWidth, tooltipArrowX, tooltipLeft, arrowLoc, fitInto;

    fitInto = this.fitInto.getBoundingClientRect();
    if ( positionTarget === undefined ) {
      positionTarget = this.positionTarget.getBoundingClientRect();
    } else {
      positionTarget.left  += fitInto.left;
      positionTarget.top   += fitInto.top;
      positionTarget.bottom = positionTarget.top + positionTarget.height;
      positionTarget.right  = positionTarget.left + positionTarget.width;
    }

    this._showing = true;
    this.setVisible(true);

    // ... set text and size the tooltip, max width up to 90% of page width ...
    this.style.width = (fitInto.width * 0.9) + 'px';
    this.$.text.style.margin = '0px';
    this.$.text.style.marginTop = this.tipHeight + 'px';
    Polymer.dom(this.$.text).innerHTML = content;

    // ... layout the tooltip so that it's stays inside the page (90% central column) ...
    tooltipWidth  = this.$.text.getBoundingClientRect().width;
    tooltipArrowX = positionTarget.left + positionTarget.width / 2;
    tooltipLeft   = tooltipArrowX - tooltipWidth / 2;
    arrowLoc      = 0.5;

    if ( tooltipLeft < fitInto.left + fitInto.width * 0.05 ) {
      tooltipLeft = fitInto.left + fitInto.width * 0.05;
      arrowLoc = (tooltipArrowX - tooltipLeft) / tooltipWidth;
    } else if ( tooltipLeft + tooltipWidth > fitInto.left + fitInto.width * 0.95 ) {
      tooltipLeft = fitInto.left + fitInto.width * 0.95 - tooltipWidth;
      arrowLoc = (tooltipArrowX - tooltipLeft) / tooltipWidth;
    }

    // ... position relative to fitInto and show the tooltip ...
    this.tipLocation = arrowLoc;
    this.style.left = tooltipLeft - fitInto.left + 'px';
    this.style.top  = positionTarget.bottom - fitInto.top  + 'px';
    this._updateBalloon();
  }

  hide () {
    // If the tooltip is already hidden, there's nothing to do.
    if (!this._showing) {
      return;
    }
    this._showing = false;
    this.setVisible(false);
  }

  _updateBalloon () {
    var width, height, bb;

    bb = this.$.text.getBoundingClientRect();
    switch(this._tipEdge) {
      case 'N':
      case 'S':
        height = bb.height + this.tipHeight;
        width  = bb.width;
        break;
      case 'W':
      case 'E':
        height = bb.height;
        width  = bb.width + this.tipHeight + this.radius;
        break;
    }
    this.$.canvas.width = width * this._ratio;
    this.$.canvas.height = height * this._ratio;
    this.$.canvas.style.width  = width + 'px';
    this.$.canvas.style.height = height + 'px';
    this._paintBalloon(width - 1, height -1);
  }

  /**
   * @brief Determine the device pixel ratio: 1 on classical displays 2 on retina/UHD displays
   */
  _setupPixelRatio () {
    var devicePixelRatio  = window.devicePixelRatio || 1;
    if (devicePixelRatio > 1.6) {
      devicePixelRatio = 2;
    } else {
      devicePixelRatio = 1;
    }
    var backingStoreRatio = this._ctx.webkitBackingStorePixelRatio ||
                            this._ctx.mozBackingStorePixelRatio ||
                            this._ctx.msBackingStorePixelRatio ||
                            this._ctx.oBackingStorePixelRatio ||
                            this._ctx.backingStorePixelRatio || 1;
    this._ratio = devicePixelRatio / backingStoreRatio;
  }

  /**
   * @brief Prepares a rounded rect path, does not paint or stroke it
   *
   * @param x upper left corner
   * @param y upper left corner
   * @param w width of the round rectangle
   * @param h height of the round rectangle
   * @param r corner radius
   */
  _makeRoundRectPath (x, y, w, h, r) {
    this._ctx.moveTo( x + r, y );
    this._ctx.arcTo(  x + w, y    , x + w    , y + r    , r);
    this._ctx.arcTo(  x + w, y + h, x + w - r, y + h    , r);
    this._ctx.arcTo(  x    , y + h, x        , y + h - r, r);
    this._ctx.arcTo(  x    , y    , x + r    , y        , r);
  }

  _paintBalloon (width, height) {
    var tipLocation, tipHeight, tipBase, radius;

    this._ctx.fillStyle = '#000';
    this._ctx.globalAlpha = 0.75;

    radius    = this.radius    * this._ratio;
    tipHeight = this.tipHeight * this._ratio;
    tipBase   = this.tipBase   * this._ratio;
    width    *= this._ratio;
    height   *= this._ratio;
    this._ctx.beginPath();
    switch (this._tipEdge) {
      case 'N':
      default:
        this._makeRoundRectPath(0, 0 + tipHeight, width, height - tipHeight, radius);
        tipLocation = Math.round(0 + width * this.tipLocation);
        this._ctx.moveTo(tipLocation, 0);
        this._ctx.lineTo(tipLocation + Math.round(tipBase / 2), 0 + tipHeight);
        this._ctx.lineTo(tipLocation - Math.round(tipBase / 2), 0 + tipHeight);
        this._ctx.lineTo(tipLocation, 0);
        break;
      case 'E':
        this._makeRoundRectPath(0, 0, width - tipHeight, height, radius);
        tipLocation = Math.round(0 + height * this.tipLocation);
        this._ctx.moveTo(0 + width, tipLocation);
        this._ctx.lineTo(0 + width - tipHeight, Math.round(tipLocation - tipBase/ 2));
        this._ctx.lineTo(0 + width - tipHeight, Math.round(tipLocation + tipBase/ 2));
        this._ctx.lineTo(0 + width, tipLocation);
        break;
      case 'S':
        this._makeRoundRectPath(0, 0, width, height - tipHeight, radius);
        tipLocation = Math.round(0 + width * this.tipLocation);
        this._ctx.moveTo(tipLocation, 0 + height);
        this._ctx.lineTo(tipLocation + Math.round(tipBase / 2), 0 + height - tipHeight);
        this._ctx.lineTo(tipLocation - Math.round(tipBase / 2), 0 + height - tipHeight);
        this._ctx.lineTo(tipLocation, 0 + height);
        break;
      case 'W':
        this._makeRoundRectPath(0 + tipHeight, 0, width - tipHeight, height, radius);
        tipLocation = Math.round(0 + height * this.tipLocation);
        this._ctx.moveTo(0, tipLocation);
        this._ctx.lineTo(0 + tipHeight, Math.round(tipLocation - tipBase/ 2));
        this._ctx.lineTo(0 + tipHeight, Math.round(tipLocation + tipBase/ 2));
        this._ctx.lineTo(0, tipLocation);
        break;
    }
    this._ctx.closePath();
    this._ctx.fill();
  }
}

window.customElements.define(CasperEpaperCombolist.is, CasperEpaperCombolist);
