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

import { CasperBrowser } from '@cloudware-casper/casper-utils/casper-utils.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import { afterNextRender } from '@polymer/polymer/lib/utils/render-status.js';

class CasperEpaperPdf extends PolymerElement {

  static get is () {
    return 'casper-epaper-pdf';
  }

  static get properties () {
    return {
      /**
       * The TOConline's app object.
       *
       * @type {Object}
       */
      app: Object,
      /**
       * The PDF document source url.
       *
       * @type {String}
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
        :host,
        #main {
          position: relative;
          z-index: 0;
          height: 100%;
        }
        #main, #main iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }

        #main iframe {
          position: absolute;
          left: 0;
          top: 0;
          /* border: 2px yellow solid; */
        }


        #main iframe.active {
          display: inline-block;
          z-index: 2;
          opacity: 1;
          transition: opacity 600ms ease;

          /* height: 30%; */
          /* border: 6px green solid; */
        }

        #main iframe.loader {
          z-index: 1;
          opacity: 0;
          transition: opacity 600ms ease;

          /* height: 30%; */
          /* top: 400px; */
          /* border: 6px red solid; */
        }

      </style>
      <div id='main'>
        <iframe class='active'></iframe>
        <iframe class='loader'></iframe>
      </div>
      </div>
    `;
  }

  ready () {
    super.ready();
  }


  reset () {
    this.shadowRoot.querySelector('#main > .active').removeAttribute("src");
    this.shadowRoot.querySelector('#main > .loader').removeAttribute("src");
    this.source = undefined
    this.__currentSource = undefined
    console.log("PDF RESET")
  }

  /**
   * Opens a PDF document specified in the source property.
   */
  async open () {

    if (!this.source) return;

    this.__iframeElement       = this.shadowRoot.querySelector('#main > .active');
    this.__iframeElementLoader = this.shadowRoot.querySelector('#main > .loader');

    let cacheTimestamp = Date.now();
    const newSource = this.source.includes('?')
      ? `${this.source}&timestamp=${cacheTimestamp}&content-disposition=inline#view=Fit&toolbar=0&pagemode=none`
      : `${this.source}?timestamp=${cacheTimestamp}&content-disposition=inline#view=Fit&toolbar=0&pagemode=none`;

    return new Promise(async (resolve, reject) => {
      this.__rejectCallback = reject;
      this.__resolveCallback = resolve;

      try {
        // if (CasperBrowser.isFirefox) {
        //   // Since we can't inspect the iframe contents in Firefox, send a pre-flight request to see if we have access to the file.
        //   const response = await fetch(newSource, {
        //     method: 'HEAD',
        //     headers: { 'Authorization': `Bearer ${this.app.socket.sessionCookie}` }
        //   });

        //   if (!response.ok) return this.__rejectCallback();

        // }


        // console.log('after src => ', this.source)
        this.__iframeElementLoader.src = newSource
        this.__currentSource = newSource;

        if (CasperBrowser.isFirefox) return this.displayIframeAfterLoaded();

        if (this.checkTimer) clearInterval(this.checkTimer);

        let counter = 0;
        this.checkTimer = setInterval(async () => {
          counter += 1;
          let iframeLoader = this.shadowRoot.querySelector('#main > .loader');

          let iframeDoc = iframeLoader?.contentDocument || iframeLoader?.contentWindow?.document ||  iframeLoader?.contentDocument?.getElementsByTagName('body')[0];
          console.log(`checking.... ${counter} -> ${this.checkTimer}`, iframeDoc, iframeDoc.readyState);
          if (counter > 7) {
            this.loading = true;
          }
          if (counter > 2 && (iframeDoc.readyState == 'complete' || iframeDoc.readyState == 'interactive')) {
              console.log(`checking.... ${counter}`, iframeDoc.readyState);
              clearInterval(this.checkTimer);
              this.displayIframeAfterLoaded();
              return;
          }
        }, 100);

      } catch (exception) {
        this.__rejectCallback();
    }
    });
  }


  displayIframeAfterLoaded() {

    let active = this.shadowRoot.querySelector('#main > .active');
    let loader = this.shadowRoot.querySelector('#main > .loader');

    // console.log("ACTIVE", active)
    // console.log("LOADER", loader)

    loader.classList.remove('loader')
    loader.classList.add('active')

    active.classList.remove('active')
    active.classList.add('loader')

    // setTimeout( async () => {
    //   this.__currentSource = undefined
    //   this.shadowRoot.querySelector('.loader').removeAttribute("src")
    //   console.log("CLEAR SRC")
    // },500);


    this.loading = false;
    this.__resolveCallback('pdf loaded');
  }

  /**
   * Prints the currently rendered PDF document.
   */
  print () {
    if (CasperBrowser.isSafari) return this._openOnTab(this.shadowRoot.querySelector('#main > .active').src);
    this.shadowRoot.querySelector('#main > .active').contentWindow.print();
  }

  _openOnTab (publicLink) {
    try {
      let win = window.open(publicLink, 'printing_tab');
      win.focus();
      this.close();
    } catch (e) {
      this.close();
      console.error("PDF blocked");
    }
  }

}

customElements.define(CasperEpaperPdf.is, CasperEpaperPdf);
