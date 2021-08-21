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
import { CasperEpaperTextWidget } from './casper-epaper-text-widget.js';
import '@cloudware-casper/casper-icons/casper-icon-class.js';
import '@cloudware-casper/casper-select-lit/casper-select-lit.js';
import '@cloudware-casper/casper-select-lit/components/casper-highlightable.js';

export class CasperEpaperSelectWidget extends CasperEpaperTextWidget {
    
  constructor () {
    super();
    this.glFilterFields = [
      'id',
      'description'
    ];
    this.lineCss = `
      .postal-code {
        color: #A60C11;
        font-size: 14px;
      }
      .location-name {
        font-size: 14px;
        color: #333;
      }
      .small-text {
        font-size: 12px;
        color: #666;
      }
      .item-row {
        cursor: pointer;
        border-bottom: 1px solid #333;;
      }
      .item-row:hover {
        background-color: orange;
      }
      .item-row[active] {
        background-color: yellow;
      }
      .item-row[active]:hover {
        background-color: orange;
      }
    `;
  }

  firstUpdated () {
    this._textArea = this.renderRoot.getElementById('textarea');
    this.requestUpdate();   
  }

  updated () {
    super.updated();
    this._overlay  = this.renderRoot.getElementById('overlay');
    if ( this._overlay && ! this._pig ) {
      this._pig = true;
      this._overlay.addEventListener('change', (event) => {
        //this.overlay = 'closed';
        this.epaper._socket.setText(this.epaper.documentId, event.detail.value);
        console.log(`SET ${event.detail.value}`);
      });
      this._overlay.addEventListener('foobar-closed', (event) => this.overlay = 'closed');
      this._overlay.addEventListener('foobar-opened', (event) => this.overlay = 'open');
    }
  }

  render2 () {
    return html`<input id="textarea" type="text" autocomplete="off" tabindex="1" placeholder="pesquisa"></input>
                <casper-icon icon="fa-regular:angle-down" class="overlay-icon" overlay="${this.overlay}" @click="${this._toogleOverlay}"></casper-icon>
                ${this._textArea ? html`
                  <casper-select-lit id="overlay" highlight .customInput="${this._textArea}" .autoOpen="false">
                    <option value="Saab">Saab</option>
                    <option value="Opel">Opel</option>
                    <option value="Audi">Audi</option>
                    <option value="Mercedes">Mercedes</option>
                    <option value="BMW">BMW</option>
                    <option value="Tesla">Tesla</option>
                  </casper-select-lit>` : ''}`;
  }

  render2 () {
    return html`<input id="textarea" type="text" autocomplete="off" tabindex="1" placeholder="pesquisa"></input>
                <casper-icon icon="fa-regular:angle-down" class="overlay-icon" overlay="${this.overlay}" @click="${this._toogleOverlay}"></casper-icon>
                ${this._textArea ? html`
                  <casper-select-lit id="overlay" .customInput="${this._textArea}" .autoOpen="false"
                  idColumn="id"
                  textProp="description"
                  initialId="2211"
                  highlight
                  maxWidth=600
                  tableName="general_ledger"
                  sortColumn="id"
                  extraColumn="parent_id"
                  tableSchema="subentity"
                  .socket="${app.socket2}"
                  .fitInto="${ep}"
                  lazyloadResource="general_ledger"
                  .lazyLoadFilterFields=${this.glFilterFields}>
                  </casper-select-lit>` : ''}`;
  }

  render () {
    return html`<input id="textarea" type="text" autocomplete="off" tabindex="1" placeholder="pesquisa"></input>
                <casper-icon icon="fa-regular:angle-down" class="overlay-icon" overlay="${this.overlay}" @click="${this._toogleOverlay}"></casper-icon>
                ${this._textArea ? html`
                  <casper-select-lit id="overlay" .customInput="${this._textArea}" .autoOpen="false"
                  unsafeRender
                  idColumn="id"
                  textProp="description"
                  initialId="2211"
                  highlight
                  maxWidth=600
                  tableName="general_ledger"
                  sortColumn="id"
                  extraColumn="parent_id"
                  tableSchema="subentity"
                  .socket="${app.socket2}"
                  .fitInto="${ep}"
                  lazyloadResource="general_ledger"
                  .resourceFormatter="${this.resourceFormatterGL}"
                  .lineCss="${this.lineCss}"
                  .lazyLoadFilterFields=${this.glFilterFields}>
                  </casper-select-lit>` : ''}`;
  }

  resourceFormatterGL (item, included, search) {
    item.unsafeHTML = `
                    <div class="line-container">
                    <casper-highlightable highlight="${search}" class="postal-code">
                      ${item.id}
                    </casper-highlightable> <casper-highlightable highlight="${search}" class="location-name">
                      ${item.description}
                    </casper-highlightable><br>
                    <span class="small-text">olá gente pequena</span>
                    </div>
                  `;
  }

//  .renderLine="${this.renderLineGL}"
//  .renderPlaceholder="${this.renderPlaceholderGL}">

  render2 () {
    return html`<casper-select-lit id="cs-post-codes"
                          unsafeRender
                          height=400
                          initialId="95602"
                          idColumn="id"
                          textProp="postal_code"
                          tableSchema="payroll"
                          tableName="post_codes_with_districts_counties"
                          .socket="${this.socket2}"
                          .lineCss="${this.lineCss}"
                          .fitInto="${this.mcontainer}"
                          .lazyLoadFilterFields=${this.pcFilterFields}
                          .renderPlaceholder="${this.renderPlaceholderPC}"

                          lazyloadResource="post_codes_with_districts_counties">
              </casper-select-lit>`;
  }

  _onKeyDown (event) {
    const vkey = this._keycodeToVkey(event);

    console.log(`vkey=${vkey}`);

    if ( ['down', 'up'].includes(vkey) ) {
      return;
    }
    if ( ['shift+tab', 'left'].includes(vkey) ) {
      this.epaper._socket.sendKey(this.epaper.documentId, 'tab', 'shift');
    }
    if ( ['right', 'enter', 'tab'].includes(vkey) ) {
      this.epaper._socket.sendKey(this.epaper.documentId, 'tab');
    }
  }

  renderPlaceholderGL () {
    return html`
      <style>
        .blured-span {
          filter: blur(4px);
          color: green;
          font-size: 14px;
        }
      </style>
      <span class="postal-code">
        <span class="blured-span">Loadin<span class="location-name"> - Loadin</span></span>
      </span>
    `;
  }
  renderLineGL (item, highlight) {
    return html`
      <style>
        .postal-code {
          font-family: Tahoma,Geneva,Verdana;
          color: green;
          font-size: 14px;
        }
        .location-name {
          font-family: Tahoma,Geneva,Verdana;
          font-size: 14px;
          color: #333;
        }
        .item-row:hover {
          cursor: pointer;
          background-color: orange;
        }
        .item-row[active] {
          background-color: yellow;
        }
        .item-row[active]:hover {
          background-color: orange;
        }
      </style>
      <div class="line-container">
        ${item.id ? html`
        <casper-highlightable highlight="${highlight}" class="postal-code">
          ${item.id}
        </casper-highlightable>
        <casper-highlightable highlight="${highlight}" class="location-name">
          ${item.description}
        </casper-highlightable><br>
        ` : this.renderPlaceholder()}
      </div>
    `
  }
}

window.customElements.define('casper-epaper-select-widget', CasperEpaperSelectWidget);