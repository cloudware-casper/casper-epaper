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

import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import { afterNextRender } from '@polymer/polymer/lib/utils/render-status.js';

class CasperEpaperImage extends PolymerElement {

  static get is () {
    return 'casper-epaper-image';
  }

  static get properties () {
    return {
      /**
       * The image's source url.
       */
      source: String,
      /**
       * This flag states if the epaper component is currently loading or not.
       *
       * @type {Boolean}
       */
      loading: {
        type: Boolean,
        notify: true
      }
    }
  }

  static get template () {
    return html`
      <style>
        :host {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: white;
        }

        iframe {
          display: none;
        }
      </style>
      <iframe></iframe>
    `;
  }

  /**
   * Observer that gets fired when the image's source changes.
   */
  open () {
    return new Promise((resolve, reject) => {
      this.__imageElement = document.createElement('img');

      this.__imageElement.onerror = error => reject(error);
      this.__imageElement.onload = event => {

        this.__originalWidth = event.composedPath().shift().width;
        this.__originalHeight = event.composedPath().shift().height;

        // Remove the existing image if there is any.
        const existingImage = this.shadowRoot.querySelector('img');
        if (existingImage) {
          this.shadowRoot.removeChild(existingImage);
        }

        this.__recalculateImageDimensions();
        this.shadowRoot.appendChild(this.__imageElement);

        this.loading = false;
        resolve();
      };

      // Trigger the image load.
      this.loading = true;
      this.__imageElement.src = this.source;
    })
  }

  /**
   * This method gets manually invoked when the epaper container is resized.
   */
  _zoomChanged () {
    this.__recalculateImageDimensions();
  }

  /**
   * This method re-calculates the image dimensions taking into account the available space
   * plus the image dimensions.
   */
  __recalculateImageDimensions () {
    const availableWidth = this.parentElement.offsetWidth - 30;
    const availableHeight = this.parentElement.offsetHeight - 30;

    const widthRatio = parseFloat(this.__originalWidth / availableWidth);
    const heightRatio = parseFloat(this.__originalHeight / availableHeight);

    // This means it's a horizontal image.
    if (widthRatio > heightRatio) {
      // Check if the original image fits within the available horizontal space, otherwise adjust its size.
      this.__imageElement.width = Math.min(availableWidth, this.__originalWidth);
      this.__imageElement.height = Math.min(this.__originalHeight / widthRatio, this.__originalHeight);
    } else {
      // Check if the original image fits within the available vertical space, otherwise adjust its size.
      this.__imageElement.height = Math.min(availableHeight, this.__originalHeight);
      this.__imageElement.width = Math.min(this.__originalWidth / heightRatio, this.__originalWidth);
    }
  }

  /**
   * Prints the current image being displayed.
   */
  print () {
    this.__iframeElement = this.__iframeElement || this.shadowRoot.querySelector('iframe');
    this.__iframeElement.contentWindow.document.open();
    this.__iframeElement.contentWindow.document.write(`
      <html>
        <body onload="this.print(); this.close();">
          <img src="${this.source}" />
        </body>
      </html>
    `);
    this.__iframeElement.contentWindow.document.close();
  }
}

customElements.define(CasperEpaperImage.is, CasperEpaperImage);
