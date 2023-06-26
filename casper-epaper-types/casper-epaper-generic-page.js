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

import { templatize } from '@polymer/polymer/lib/utils/templatize.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';

class CasperEpaperGenericPage extends PolymerElement {

  static get is () {
    return 'casper-epaper-generic-page';
  }

  static get template () {
    return html`
      <style>
        #template-container {
          background-color: white;
          width: 100%;
          height: 100%;
        }
      </style>
      <div id="template-container"></div>
    `;
  }

  static get properties () {
    return {
      /**
       * The data that will be used for binding on template.
       *
       * @type {Object}
       */
      data: {
        type: Object,
        value: {}
      },
      /**
       * The template that will be stamped by this component.
       *
       * @type {Object}
       */
      template: {
        type: Object,
        observer: '__templateChanged'
      }
    };
  }

  /**
   * Method that gets called as soon as the template changes and stamps it in the DOM.
   *
   * @param {Object} template The template that will be stamped by this component.
   */
  __templateChanged (template) {
    const templateClass = templatize(template);
    const templateClassInstance = new templateClass(this.data);

    this.$['template-container'].innerHTML = '';
    this.$['template-container'].appendChild(templateClassInstance.root);
  }
}

customElements.define(CasperEpaperGenericPage.is, CasperEpaperGenericPage);
