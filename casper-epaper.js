/*
  - Copyright (c) 2014-2016 Cloudware S.A. All rights reserved.
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

import '@cloudware-casper/casper-icons/casper-icon-button.js';
import { CasperBrowser } from '@cloudware-casper/casper-utils/casper-utils.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import { afterNextRender } from '@polymer/polymer/lib/utils/render-status.js';

import './casper-epaper-servertip-helper.js';
import './casper-epaper-types/casper-epaper-pdf.js';
import './casper-epaper-types/casper-epaper-image.js';
import './casper-epaper-types/casper-epaper-iframe.js';
import './casper-epaper-types/casper-epaper-upload.js';
import './casper-epaper-types/casper-epaper-generic-page.js';
import './casper-epaper-types/casper-epaper-server-document.js';

class CasperEpaper extends PolymerElement {

  static get EPAPER_MAX_ZOOM () { return 2; }
  static get EPAPER_MIN_ZOOM () { return 0.5; }

  static get template () {
    return html`
      <style>
        :host {
          width: 100%;
          height: 100%;
          display: flex;
          position: relative;
          flex-direction: column;
        }

        .shadow {
          top: 0;
          left: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          position: absolute;
          pointer-events: none;
          -moz-box-shadow:    inset 0 0 10px #00000080;
          -webkit-box-shadow: inset 0 0 10px #00000080;
          box-shadow:         inset 0 0 10px #00000080;
        }

        .desktop {
          width: 100%;
          height: 100%;
          overflow: auto;
          display: flex;
        }

        .toolbar {
          padding: 15px;
          z-index: 2;
          display: flex;
          width: 100%;
          overflow-x: auto;
          position: absolute;
          align-items: center;
          box-sizing: border-box;
          justify-content: space-between;
        }

        .toolbar > div {
          display: flex;
        }

        .toolbar casper-icon-button,
        ::slotted(casper-icon-button),
        ::slotted(casper-tabs) {
          margin-left: 8px;
        }

        ::slotted(casper-tabs) {
          box-shadow: 0px 2px 12px -1px rgba(0, 0, 0, 0.6);
        }

        .toolbar casper-icon-button,
        ::slotted(casper-icon-button) {
          width: 32px;
          height: 32px;
          padding: 7px;
          box-sizing: border-box;
          box-shadow: 0px 2px 12px -1px rgba(0, 0, 0, 0.6);
        }

        .toolbar casper-icon-button[has-text],
        ::slotted(casper-icon-button[has-text]) {
          padding: 5px 10px;
        }

        .epaper {
          display: flex;
          overflow: auto;
          height: 100%;
          padding: 60px 30px 0;
        }

        .epaper .spacer {
          flex-grow: 1;
        }

        .epaper #next-attachment,
        .epaper #previous-attachment {
          top: calc(50% - 37.5px);
          width: 75px;
          height: 150px;
          z-index: 1;
          opacity: 0.5;
          position: absolute;
          display: none;
          flex-direction: column;
          padding: 25px 0;
          box-sizing: border-box;
          justify-content: space-between;
          background-color: darkgray;
          transition: opacity 200ms linear;
        }

        .epaper #next-attachment casper-icon,
        .epaper #previous-attachment casper-icon {
          width: 40px;
          height: 40px;
          color: white;
        }

        .epaper #previous-attachment {
          left: 0;
          padding-left: 5px;
          align-items: flex-start;
          border-top-right-radius: 100px;
          border-bottom-right-radius: 100px;
        }

        .epaper #next-attachment {
          right: 0;
          padding-right: 5px;
          align-items: flex-end;
          border-top-left-radius: 100px;
          border-bottom-left-radius: 100px;
        }

        .epaper #next-attachment:hover,
        .epaper #previous-attachment:hover {
          opacity: 1;
          cursor: pointer;
        }

        .epaper #epaper-container {
          display: flex;
          margin: 0 auto;
          height: fit-content;
          flex-direction: column;
          position: relative;
        }

        .epaper #epaper-container h3 {
          margin: 0;
          height: 30px;
          line-height: 30px;
          text-align: center;
          color: white;
          text-overflow: ellipsis;
          overflow: hidden;
          font-size: 14px;
          margin: 10px;
          font-weight: normal;
          flex-shrink: 0;
        }

        .epaper #epaper-container #epaper-component-container {
          display: none;
          position: relative;
          background-color: transparent;
        }

        .epaper #epaper-container #epaper-component-sticky {
          z-index: 1;
          opacity: 0.2;
          overflow: auto;
          display: none;
          position: absolute;
          box-sizing: border-box;
          flex-direction: column;
          background-size: cover;
          background-repeat: no-repeat;
          background-image: url('/node_modules/@cloudware-casper/casper-epaper/static/epaper-sticky.svg');
          transition: opacity 200ms linear;
        }

        .epaper #epaper-container #epaper-component-sticky .bold { font-weight: bold; }
        .epaper #epaper-container #epaper-component-sticky .italic { font-style: italic; }
        .epaper #epaper-container #epaper-component-sticky .line-through { text-decoration: line-through; }
        .epaper #epaper-container #epaper-component-sticky .text-small { font-size: 0.5em; }
        .epaper #epaper-container #epaper-component-sticky .text-bigger { font-size: 1.25em; }
        .epaper #epaper-container #epaper-component-sticky .text-biggest { font-size: 1.5em; }

        .epaper #epaper-container .cta-button {
          position: absolute;
          right: -10px;
          top: 6px;
          z-index: 5;
          margin: 0;
          height: 40px;
        }

        #epaper-component-loading-overlay {
          top: 0;
          right: 0;
          width: 0;
          height: 0;
          opacity: 0;
          z-index: 2;
          display: none;
          color: white;
          position: absolute;
          align-items: center;
          flex-direction: column;
          justify-content: center;
          transition: opacity 200ms linear;
          background-color: rgba(0, 0, 0, 0.8);
        }

        #epaper-component-loading-overlay[visible] {
          opacity: 1;
        }

        #epaper-component-loading-overlay paper-spinner {
          width: 100px;
          height: 100px;
          margin-bottom: 10px;
          --paper-spinner-stroke-width: 8px;
          --paper-spinner-layer-1-color: white;
          --paper-spinner-layer-2-color: white;
          --paper-spinner-layer-3-color: white;
          --paper-spinner-layer-4-color: white;
        }

        .label {
          border: 0;
          display: inline;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: #525659;
          padding: 5px;
          background-color: #fff;
          transition: color 100ms linear, background-color 100ms linear;
        }

        .document-checklist {
          width: 320px;
          position: absolute;
          background: var(--status-red);
          box-shadow: 0 2px 9px 0 rgba(0,0,0,0.50);
          border-radius: 4px;
          z-index: 2;
          font-size: 13px;

          left: 0;
          right: 0;
          top: 12px;
          margin-left: auto;
          margin-right: auto;
          transition: all 200ms linear;
          transition: background 10ms linear;
        }

        .document-checklist:hover {
          background: #ffffff;
          top: 7px;
          transition: top 200ms linear;
        }






        .document-checklist:hover .expanded{
          display: initial;
        }

        .document-checklist:hover .collapsed, .document-checklist .expanded {
          display: none;
        }

        .document-checklist .title-tasks {
          color: #ffffff;
        }

        .document-checklist:hover .title-tasks {
          color: var(--primary-color);
          margin: 10px;
        }

        .document-checklist .title-tasks {
          font-weight: bold;
          margin: 5px;
          text-transform: uppercase;
        }

        .document-checklist .collapsed > p > span {
          display: inline-flex;
          height: 18px;
          vertical-align: bottom;
        }

        .document-checklist .collapsed > p > casper-icon {
          color: white;
          padding-right: 6px;
        }

        .document-checklist > p, .document-checklist > div {
          text-align: center;
        }


        .document-checklist ul {
          list-style: none;
          padding: 0;
          margin: 0;
          color: #5F5F5F;
        }

        .document-checklist li {
          padding: 10px;
          border-top: 1px #D8D8D8 solid;
          display: flex;
          justify-content: space-between;
        }

        .document-checklist li span {
          line-height: 20px;
        }

        .document-checklist .button{
          border-top: 1px #D8D8D8 solid;
          padding: 10px;
        }

        .document-checklist .button button {
          width: 100%;
          padding: 10px;

          color: #5F5F5F;
          background: #F9F9F9;
          border: 1px solid #CCCCCC;
          border-radius: 4px;
          text-transform: uppercase;
          transition: all 200ms linear;
        }

        .document-checklist .button button:hover {
          cursor: pointer;
          background: #2AABBF;
          border: 1px solid #2192A3;
          border-radius: 4px;
          color: white;
          transition: all 200ms linear;
        }

        .filled-parent {
            display: block;
            width: 18px;
            height: 18px;
            position: relative;
            border-radius: 18px;
            border: 2px #d6d6d6 solid;
        }

        .filled-centered-child {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            margin: auto auto;
            background-color: #62E044;
            width: 12px;
            height: 12px;
            border-radius: 12px;
        }

        .filled-centered-child[error] {
          background-color: #ff2600;
        }


      </style>
      <div id="epaper-component-loading-overlay">
        <paper-spinner active></paper-spinner>
        A carregar o documento
      </div>

      <div class="toolbar">
        <div>
          <casper-icon-button on-click="zoomOut"          id="zoomOut"      tooltip="Reduzir"         icon="fa-light:minus" reverse></casper-icon-button>
          <casper-icon-button on-click="zoomIn"           id="zoomIn"       tooltip="Ampliar"         icon="fa-light:plus" reverse></casper-icon-button>
          <casper-icon-button on-click="goToPreviousPage" id="previousPage" tooltip="Página anterior" icon="fa-light:arrow-left"></casper-icon-button>
          <casper-icon-button on-click="goToNextPage"     id="nextPage"     tooltip="Página seguinte" icon="fa-light:arrow-right"></casper-icon-button>
          <!--Casper-epaper-tabs-->
          <slot name="casper-epaper-tabs"></slot>
        </div>

        <div>
          <!--Casper-epaper-actions-->
          <slot name="casper-epaper-actions"></slot>

          <casper-icon-button on-click="print"    id="print"    tooltip="Imprimir"                    icon="fa-light:print"></casper-icon-button>
          <casper-icon-button on-click="download" id="download" tooltip="[[__epaperDownloadTooltip]]" icon="[[__epaperDownloadIcon]]"></casper-icon-button>

          <!--Context menu-->
          <template is="dom-if" if="[[__hasContextMenu]]">
            <casper-icon-button icon="fa-light:bars" class="toolbar-white" id="context-menu-trigger" reverse></casper-icon-button>
          </template>
        </div>

      </div>

      <div class="shadow"></div>

      <div class="epaper">
        <!--Previous attachment button-->
        <div id="previous-attachment" on-click="__onPreviousAttachmentClick">
          <casper-icon icon="[[__previousAttachmentIcon]]"></casper-icon>
          <casper-icon icon="fa-light:arrow-left"></casper-icon>
        </div>


        <!--Next attachment button-->
        <div id="next-attachment" on-click="__onNextAttachmentClick">
          <casper-icon icon="[[__nextAttachmentIcon]]"></casper-icon>
          <casper-icon icon="fa-light:arrow-right"></casper-icon>
        </div>

        <div id="epaper-container">
          <!--Epaper title-->
          <h3 inner-h-t-m-l="[[__currentAttachmentName]]"></h3>

          <!--Casper-cta-button-->
          <p class='cta-button'><slot name='casper-cta-button'></slot></p>

          <!--Epaper checklist tasks-->
          <template is="dom-if" if="[[__currentAttachmentCheckList.tasks]]">

            <div class="document-checklist">

              <div class='collapsed'>
                <p class='title-tasks' inner-h-t-m-l="[[__currentAttachmentCheckList.title]]"></p>
              </div>

              <div class='expanded'>
                <p class='title-tasks'inner-h-t-m-l="[[__currentAttachmentCheckList.checklistTitle]]"></p>

                <ul>
                  <template is="dom-repeat" items="[[__currentAttachmentCheckList.tasks]]" index-as="index">
                    <li>
                      <span>[[item.prop]]</span>
                      <span>
                        <div class='filled-parent'>
                          <div class='filled-centered-child' error$=[[!item.filled]]></div>
                        </div>
                      </span>
                    </li>
                  </template>
                </ul>

                <div class='button'>
                  <button on-click="__tasksTrigger">[[__currentAttachmentCheckList.triggerButton]]</button>
                </div>

              </div>

            </div>
          </template>



          <!--Sticky that will be used to display information about the component-->
          <div id="epaper-component-sticky"></div>
          <div id="epaper-component-container">

            <!--Server Document Epaper-->
            <casper-epaper-server-document
              id="serverDocument"
              app="[[app]]"
              zoom="[[zoom]]"
              epaper="[[__epaper]]"
              loading="{{__loading}}"
              scroller="[[scroller]]"
              landscape="{{__landscape}}"
              current-page="{{__currentPage}}"
              total-page-count="{{__totalPageCount}}">
              <slot name="casper-epaper-line-menu" slot="casper-epaper-line-menu"></slot>
            </casper-epaper-server-document>

            <!--PDF Epaper-->
            <casper-epaper-pdf id="pdf" app="[[app]]" loading="{{__loading}}"></casper-epaper-pdf>

            <!--Iframe Epaper-->
            <casper-epaper-iframe id="iframe"></casper-epaper-iframe>

            <!--Image Epaper-->
            <casper-epaper-image
              id="image"
              loading="{{__loading}}">
            </casper-epaper-image>

            <!--Upload Epaper-->
            <casper-epaper-upload id="upload" app="[[app]]"></casper-epaper-upload>

            <!--Generic Page Epaper-->
            <casper-epaper-generic-page id="genericPage"></casper-epaper-generic-page>
          </div>
        </div>
      </div>
      <slot name="casper-epaper-context-menu"></slot>

      <!-- Blank page template-->
      <template id="blank-page-template">
        <style>
          #page-container {
            height: 100%;
            display: flex;
            align-items: center;
            flex-direction: column;
            justify-content: center;
            color: var(--status-gray);
          }

          #page-container casper-icon {
            width: 100px;
            height: 100px;
            margin-bottom: 10px;
          }
        </style>
        <div id="page-container">
          <casper-icon icon="fa-light:clipboard"></casper-icon>
          Sem resultado
        </div>
      </template>

      <!--Error loading attachment template-->
      <template id="error-opening-attachment-page-template">
        <style>
          #page-container {
            height: 100%;
            display: flex;
            font-size: 20px;
            font-weight: bold;
            align-items: center;
            flex-direction: column;
            justify-content: center;
            color: var(--status-red);
          }

          #page-container casper-icon {
            width: 100px;
            height: 100px;
            margin-bottom: 10px;
            color: var(--status-red);
          }
        </style>
        <div id="page-container">
          <casper-icon icon="fa-light:exclamation-triangle"></casper-icon>
          Ocorreu um erro a carregar o documento pretendido
        </div>
      </template>

      <template id="download-generic-file-template">
        <style>
          #page-container {
            height: 100%;
            display: flex;
            font-size: 20px;
            font-weight: bold;
            align-items: center;
            flex-direction: column;
            justify-content: center;
            color: var(--primary-color);
          }

          #page-container casper-icon {
            width: 125px;
            height: 125px;
            margin-bottom: 25px;
            color: var(--primary-color);
            transition: color 200ms linear;
          }

          #page-container casper-icon:hover {
            cursor: pointer;
            color: var(--dark-primary-color);
          }
        </style>
        <div id="page-container">
          <casper-icon icon="fa-light:download" on-click="download"></casper-icon>
          Clique aqui para descarregar o ficheiro
        </div>
      </template>
    `;
  }

  static get EPAPER_TYPES () {
    return {
      PDF: 'PDF',
      IMAGE: 'IMAGE',
      UPLOAD: 'UPLOAD',
      IFRAME: 'IFRAME',
      GENERIC_PAGE: 'GENERIC_PAGE',
      SERVER_DOCUMENT: 'SERVER_DOCUMENT'
    }
  }

  static get properties () {
    return {
      /**
       * The casper application.
       *
       * @type {Object}
       */
      app: Object,
      currentAttachment: {
        type: Object,
        notify: true
      },
      stickyMaximumHeight: {
        type: Number,
        observer: '__updateStickyDimensions'
      },
      disableStickyAnimation: {
        type: Boolean,
        value: false,
        observer: '__updateStickyDimensions'
      },
      /** id of the containing element that can be scrolled */
      scroller: {
        type: String,
        value: undefined
      },
      __landscape: {
        type: Boolean,
        observer: '__recalculateEpaperDimensions'
      },
      __epaperComponentWidth: {
        type: Number,
        value: 595.0
      },
      __epaperComponentHeight: {
        type: Number,
        value: 842.0
      },
      __epaperComponentStickyStyle: {
        type: Object,
        value: {
          clipSize: 19,
          right: 15,
          width: 150,
          height: 100,
          fontSize: 10,
          fullHeight: 180,
          paddingTop: 45,
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 10
        }
      },
      __epaperComponentStickyPosition: {
        type: Object,
        value: {
          align: 'left'
        }
      },
      /** zoom factor when zoom is 1 one pt in report is one px in the screen */
      zoom: {
        type: Number,
        observer: '__zoomChanged'
      },
      __totalPageCount: {
        type: Number,
        observer: '__enableOrDisablePageButtons'
      },
      __currentPage: {
        type: Number,
        observer: '__enableOrDisablePageButtons'
      },
      __loading: {
        type: Boolean,
        observer: '__loadingChanged'
      }
    };
  }

  ready () {
    super.ready();

    this.__epaper = this;
    this.__currentPage = 1;
    this.__totalPageCount = 0;
    this.__socket = this.app.socket;
    this.openBlankPage();

    // Adjust the background color depending on the vendor due to the PDF viewer.
    if (CasperBrowser.isFirefox) {
      this.style.backgroundColor = 'rgb(64, 64, 64)';
    } else if (CasperBrowser.isChrome || CasperBrowser.isOpera) {
      this.style.backgroundColor = 'rgb(82, 86, 89)';
    } else if (CasperBrowser.isSafari) {
      this.style.backgroundColor = 'rgb(128, 128, 128)';
    } else {
      this.style.backgroundColor = 'var(--casper-moac-paper-background-color, #DDD)';
      this.$['epaper-component-container'].style.boxShadow = `
        rgba(0, 0, 0, 0.24) 0px 5px 12px 0px,
        rgba(0, 0, 0, 0.12) 0px 0px 12px 0px;
      `;
    }

    afterNextRender(this, () => {
      this.__handleContextMenu();

      // If the zoom was already provided, no need to fit into the container.
      if (this.zoom) return;

      const initialZoom = Number(((this.shadowRoot.host.clientWidth - 80) / this.__epaperComponentWidth).toFixed(2));

      this.zoom = initialZoom > 0 ? initialZoom : 1;

    });

    this.__socket.addEventListener('casper-signed-in', () => {
      if (this.__currentAttachment) this.__openAttachment();
    });

    this.__nextAttachment = this.$['next-attachment'];
    this.__previousAttachment = this.$['previous-attachment'];


    this.__epaperContainer = this.$['epaper-container'];
    this.__epaperComponentSticky = this.$['epaper-component-sticky'];
    this.__epaperComponentContainer = this.$['epaper-component-container'];
    this.__epaperComponentLoadingOverlay = this.$['epaper-component-loading-overlay'];

    this.__epaperComponentSticky.addEventListener('mouseleave', () => {
      if (!this.disableStickyAnimation) {
        this.__epaperComponentSticky.style.opacity = 0.2;
        this.__epaperComponentSticky.style.height = `${parseInt(this.__epaperComponentStickyStyle.height * this.zoom)}px`;
      } else {
        this.__epaperComponentSticky.style.opacity = 1;
      }
    });

    this.__epaperComponentSticky.addEventListener('mouseover', () => {
      if (!this.disableStickyAnimation) {
        this.__epaperComponentSticky.style.opacity = 1;
        this.__epaperComponentSticky.style.height = `${parseInt((this.stickyMaximumHeight || this.__epaperComponentStickyStyle.fullHeight) * this.zoom)}px`;
      } else {
        this.__epaperComponentSticky.style.opacity = 0.2;
      }
    });

  }

  //***************************************************************************************//
  //                                                                                       //
  //                                  ~~~ Public API ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

  openBlankPage () {
    this.openGenericPage(this.$['blank-page-template']);
  }

  openGenericPage (template) {
    // Reset the current attachment settings.
    this.__landscape = false;

    if (!this.__customAttachmentFileType) {
      this.__currentAttachmentName = '';
      this.__currentAttachment = this.currentAttachment = undefined;
      this.__currentAttachments = undefined;
    }

    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.GENERIC_PAGE);
    this.__enableOrDisableControlButtons({ zoom: true, print: false, paging: false, download: false });
    this.__handleAttachmentNavigationButtons();

    this.$.genericPage.template = template;
  }

  /**
   * Opens a new uplaod page.
   *
   * @param {Object} options
   */
  openUploadPage (options) {
    // Reset the current attachment settings.
    this.__landscape = false;
    this.__currentAttachmentName = '';
    this.__currentAttachment = this.currentAttachment = undefined;
    this.__currentAttachments = undefined;

    if (options) Object.keys(options).forEach(option => this.$.upload[option] = options[option]);

    this.$.upload.clearUploadedFiles();
    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.UPLOAD);
    this.__enableOrDisableControlButtons({ zoom: true, print: false, paging: false, download: false });
    this.__handleAttachmentNavigationButtons();
  }

  /**
   * Opens an attachment with the correct "type" of epaper.
   *
   * @param {Object} attachment The attachment's metadata. This object should contain the attachment's identifier, type and name.
   */
  openAttachment (attachment, attachmentIndex, controlButtonsOptions = {}) {
    this.__controlButtonsOptions = controlButtonsOptions;

    if (Array.isArray(attachment) && attachment.length > 0) {
      this.__currentAttachments = attachment;
      this.__currentAttachmentIndex = attachmentIndex !== undefined && attachmentIndex < attachment.length ? attachmentIndex : 0;
      this.__currentAttachment = this.currentAttachment = { ...this.__currentAttachments[this.__currentAttachmentIndex] };
    } else {
      this.__currentAttachments = undefined;
      this.__currentAttachmentIndex = undefined;
      this.__currentAttachment = this.currentAttachment = { ...attachment };
    }

    this.__currentAttachmentCheckList = attachment.tasks;

    this.__handleAttachmentNavigationButtons();
    this.__openAttachment();
  }

  /**
   * Navigate to the previous page.
   */
  goToPreviousPage () {
    if (this.__currentPage > 1) {
      this.__currentPage--;
    }
  }

  /**
   * Navigate to the next page.
   */
  goToNextPage () {
    if (this.__currentPage < this.__totalPageCount) {
      this.__currentPage++;
    }
  }

  /**
   * Sets the epaper's zoom to a specific value.
   */
  setZoom (zoom) {
    if (this.zoom >= CasperEpaper.EPAPER_MIN_ZOOM && this.zoom <= CasperEpaper.EPAPER_MAX_ZOOM) {
      this.zoom = zoom;
    }
  }

  /**
   * Decreases the epaper's zoom.
   */
  zoomOut () {
    if (this.zoom > CasperEpaper.EPAPER_MIN_ZOOM) {
      this.zoom *= 0.8;
    }
  }

  /**
   * Increases the epaper's zoom.
   */
  zoomIn () {
    if (this.zoom < CasperEpaper.EPAPER_MAX_ZOOM) {
      this.zoom *= 1.2;
    }
  }

  clearUploadedFiles () {
    this.$.upload.clearUploadedFiles();
  }

  print () {
    if (typeof this.__epaperActiveComponent.print === 'function') {
      this.__epaperActiveComponent.print();
    }
  }

  download () {
    // Check if the current component has a specific download function.
    if (typeof this.__epaperActiveComponent.download === 'function') {
      this.__epaperActiveComponent.download();
    } else {
      const downloadLink = document.createElement('a');

      if (this.__currentAttachment.name) {
        const stripedName = this.__currentAttachment.name.match(/.+\.\D{3}/)[0]
        downloadLink.setAttribute('href', `/file/${this.__currentAttachment.id}?filename=${stripedName}`);
      } else {
        downloadLink.setAttribute('href', `/file/${this.__currentAttachment.id}`);
      }
      downloadLink.setAttribute('download', true);
      downloadLink.setAttribute('target', '_blank');
      downloadLink.style.display = 'none';
      this.shadowRoot.appendChild(downloadLink);
      downloadLink.click();
      this.shadowRoot.removeChild(downloadLink);
    }
  }

  /**
   * Open specified chapter, page can also be specified.
   *
   * @param {number} chapterIndex zero page index of the chapter in the document model
   * @param {number} pageNumber page to open, 1 for 1st page
   */
  gotoChapter (chapterIndex, pageNumber) {
    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.SERVER_DOCUMENT);

    if (this._document && this._document.chapters && this._document.chapters.length >= 1) {
      this._chapterIndex = chapterIndex;
      this._chapter = this._document.chapters[chapterIndex];
      return this._openChapter(pageNumber);
    } else {
      // warning
    }
  }

  /**
   * Open document and highlight field or parameter on the specified chapter
   *
   * @param {object} documentModel an object that specifies the layout and data of the document
   * @param {string} chaperReport name of the chapter's JRXML report
   * @param {string} fieldName name field or parameter to highlight
   * @param {string} rowIndex undefined to highlight a parameter or the rowIndex to highligth a field
   */
  openAndGotoParamOrField (documentModel, chapterReport, fieldName, rowIndex) {
    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.SERVER_DOCUMENT);

    this.$.serverDocument.openAndGotoParamOrField(documentModel, chapterReport, fieldName, rowIndex);
  }

  /**
   * Highlight field or parameter on the specified chapter
   *
   * @param {string} chaperReport name of the chapter's JRXML report
   * @param {string} fieldName name field or parameter to highlight
   * @param {string} rowIndex undefined to highlight a parameter or the rowIndex to highligth a field
   */
  gotoParamOrField (chapterReport, fieldName, rowIndex) {
    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.SERVER_DOCUMENT);

    this.$.serverDocument.gotoParamOrField(chapterReport, fieldName, rowIndex);
  }

  previousChapter () {
    if (this._document && this._document.chapters && this._document.chapters.length >= 1) {
      if (this._chapterIndex >= 1) {
        this._chapterIndex -= 1;
        this.gotoChapter(this._chapterIndex, -1);
        return true;
      }
    }
    return false;
  }

  nextChapter () {
    if (this._document && this._document.chapters && this._document.chapters.length >= 1) {
      if (this._chapterIndex < (this._document.chapters.length - 1)) {
        this._chapterIndex += 1;
        this.gotoChapter(this._chapterIndex, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * @brief Retrieve the number of pages in the document
   *
   * @return page count
   */
  getPageCount () {
    return this.__totalPageCount;
  }

  async closeDocument () {
    this._clear();
    this._hideWidgets(true);
    this._resetCommandData();
    this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_COUNT,1;' });  // TODO needed by whom?
    this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_NUMBER,1;' }); // TODO needed by whom?
    this._document = undefined;
    await this.__socket.closeDocument(this._documentId);
    return true;
  }

  getBatchPrintJob (print, documents) {
    let name;
    documents = documents || [];

    first_document = documents[0];

    if (first_document !== undefined) {
      name = first_document.name || this.i18n.apply(this, first_document.filename_template)
      title = first_document.title || name
    }

    name = name || this.i18n.apply(this, this._document.filename_template);
    title = title || name;

    if (this.isPrintableDocument()) return undefined;

    let job = {
      tube: 'casper-print-queue',
      name: name,
      validity: 3600,
      locale: this._locale,
      continous_pages: true,
      auto_printable: print == true,
      documents: [],
      public_link: {
        path: print ? 'print' : 'download'
      },
    }

    for (let i = 0; i < documents.length; i++) {
      _document = documents[i]
      _document_name = this.i18n.apply(this, _document.filename_template)

      for (let j = 0; j < _document.chapters.length; j++) {
        _chapter = _document.chapters[j]

        _print_document = {
          name: _document.name || _document_name || name,
          title: _document.title || _document_name || title,
          jrxml: _chapter.jrxml + '.jrxml',
          jsonapi: {
            urn: _chapter.path + '?include=lines', // Make this optional on CPQ???
            prefix: null,
            user_id: null,
            company_id: null,
            company_schema: null,
            sharded_schema: null,
            accounting_schema: null,
            accounting_prefix: null
          }
        }

        job.documents.push(_print_document);
      }
    }

    return job;
  }

  //***************************************************************************************//
  //                                                                                       //
  //                             ~~~ Private methods ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

  __onNextAttachmentClick () {
    this.__currentAttachmentIndex++;
    this.__currentAttachment = this.currentAttachment = { ...this.__currentAttachments[this.__currentAttachmentIndex] };

    this.__handleAttachmentNavigationButtons();
    this.__openAttachment();
  }

  __onPreviousAttachmentClick () {
    this.__currentAttachmentIndex--;
    this.__currentAttachment = this.currentAttachment = { ...this.__currentAttachments[this.__currentAttachmentIndex] };

    this.__handleAttachmentNavigationButtons();
    this.__openAttachment();
  }


  __tasksTrigger () {
    this.__currentAttachmentCheckList.trigger_action(this.__currentAttachment)
  }

  __handleAttachmentNavigationButtons () {
    afterNextRender(this, () => {
      if (!Array.isArray(this.__currentAttachments)) {
        this.__nextAttachment.style.display = 'none';
        this.__previousAttachment.style.display = 'none';
        return;
      }

      if (this.__currentAttachmentIndex > 0) {
        this.__previousAttachment.style.display = 'flex';
        this.__previousAttachmentIcon = this.__getIconForFileType(this.__currentAttachments[this.__currentAttachmentIndex - 1].type);
      } else {
        this.__previousAttachment.style.display = 'none';
      }

      if (this.__currentAttachments.length > this.__currentAttachmentIndex + 1) {
        this.__nextAttachment.style.display = 'flex';
        this.__nextAttachmentIcon = this.__getIconForFileType(this.__currentAttachments[this.__currentAttachmentIndex + 1].type);
      } else {
        this.__nextAttachment.style.display = 'none';
      }
    });
  }

  async __openAttachment () {
    this.__customAttachmentFileType = false;
    this.__currentAttachmentName = this.__currentAttachment.name ? this.__currentAttachment.name : '';
    this.__updateDownloadIconAndTooltip();

    // Open the attachment.
    try {
      switch (this.__currentAttachment.type) {
        case 'file/pdf':
          await this.__openPDF();
          break;
        case 'file/xml':
        case 'file/txt':
        case 'file/htm':
        case 'file/html':
        case 'file/email':
          this.__landscape = false;
          await this.__openIframe();
          break;
        case 'file/png':
        case 'file/jpg':
        case 'file/jpeg':
          this.__landscape = false;
          await this.__openImage();
          break;
        case 'epaper':
          await this.__openServerDocument();
          break;
        case 'html':
          this.__landscape = this.__currentAttachment.landscape;
          await this.__openIframe();
          break;
        default:
          if (this.__currentAttachment.type.startsWith('file/')) {
            this.__customAttachmentFileType = true;
            this.openGenericPage(this.$['download-generic-file-template']);
          }
          break;
      }
    } catch (error) {
      console.error(error);

      this.__displayErrorPage();
    }
  }

  /**
   * Open server document
   */
  async __openServerDocument () {
    this.$.pdf.reset();
    await this.$.serverDocument.open(this.__currentAttachment);

    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.SERVER_DOCUMENT);
    this.__enableOrDisableControlButtons({ ...{ zoom: true, print: true, paging: true, download: true }, ...this.__controlButtonsOptions });
  }

  /**
   * Open a new image.
   */
  async __openImage () {
    this.$.pdf.reset();
    this.$.image.source = `/file/${this.__currentAttachment.id}`;
    await this.$.image.open();

    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.IMAGE);
    this.__enableOrDisableControlButtons({ ...{ zoom: true, print: true, paging: false, download: true }, ...this.__controlButtonsOptions });
  }

  /**
   * Open an iframe.
   *
   * @param {String} iframeSource The iframe's source URL.
   */
  async __openIframe () {
    this.$.pdf.reset();
    if (this.__currentAttachment.type === 'html') {
      this.$.iframe.$.iframe.srcdoc = this.__currentAttachment.html;
    } else {
      this.$.iframe.source = `/file/${this.__currentAttachment.id}`;
      this.$.iframe.contentType = this.__currentAttachment.type;
      await this.$.iframe.open();
    }
    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.IFRAME);
    this.__enableOrDisableControlButtons({ ...{ zoom: true, print: false, paging: false, download: true }, ...this.__controlButtonsOptions });
  }


  checkKey(e) {
    e = e || window.event;

    if (e.keyCode == '37') {
      if (this.__previousAttachment.style.display != 'none') this.__onPreviousAttachmentClick(e)
    }
    else if (e.keyCode == '39') {
      if (this.__nextAttachment.style.display != 'none') this.__onNextAttachmentClick(e)
    }

}

  /**
   * Open a PDF file.
   */
  async __openPDF () {
    this.$.pdf.source = `/file/${this.__currentAttachment.id}`;
    console.log("BEFORE pdf open", this.$.pdf.source);
    this.__toggleBetweenEpaperTypes(CasperEpaper.EPAPER_TYPES.PDF);
    await this.$.pdf.open();
    console.log("AFTER pdf open", this.$.pdf.source);
    this.__enableOrDisableControlButtons({ ...{ zoom: true, print: true, paging: false, download: true }, ...this.__controlButtonsOptions });
  }

  __handleContextMenu () {
    let contextMenu;
    const contextMenuSlotElements = this.__fetchAssignedElementsRecursively(this.shadowRoot.querySelector('slot[name="casper-epaper-context-menu"]'));

    if (contextMenuSlotElements && contextMenuSlotElements.length > 0) {
      contextMenu = contextMenuSlotElements[0];
      this.__hasContextMenu = true;
    }

    if (this.__hasContextMenu) {
      afterNextRender(this, () => {
        const contextMenuTrigger = this.shadowRoot.querySelector('#context-menu-trigger');
        contextMenu.positionTarget = contextMenuTrigger;
        contextMenu.verticalAlign = 'top';
        contextMenu.horizontalAlign = 'right';
        contextMenu.verticalOffset = contextMenuTrigger.offsetHeight + 10;

        contextMenuTrigger.addEventListener('click', () => {
          contextMenu.toggle();
        });
        contextMenu.addEventListener('iron-overlay-canceled', event => {
          if (event.detail.path.includes(contextMenuTrigger)) {
            event.preventDefault();
          }
        })
      });
    }
  }

  __fetchAssignedElementsRecursively (slot) {
    const assignedElements = slot.assignedElements();

    if (assignedElements && assignedElements.length === 1 && assignedElements[0].nodeName.toLowerCase() === 'slot') {
      return this.__fetchAssignedElementsRecursively(assignedElements[0]);
    }

    return assignedElements;
  }

  __enableOrDisablePageButtons () {
    this.$.previousPage.disabled = this.__currentPage === 1;
    this.$.nextPage.disabled = this.__currentPage === this.__totalPageCount;
  }

  __enableOrDisableZoomButtons () {
    this.$.zoomIn.disabled = this.zoom >= CasperEpaper.EPAPER_MAX_ZOOM;
    this.$.zoomOut.disabled = this.zoom <= CasperEpaper.EPAPER_MIN_ZOOM;
  }

  __enableOrDisableControlButtons (options, saveCurrentState = true) {
    if (saveCurrentState) this.__currentActionButtonsOptions = options;

    // Paging buttons.
    if (options.paging) {
      this.__enableOrDisablePageButtons();
    } else {
      this.$.nextPage.disabled = true;
      this.$.previousPage.disabled = true;
    }

    // Zoom buttons.
    if (options.zoom) {
      this.__enableOrDisableZoomButtons();
    } else {
      this.$.zoomIn.disabled = true;
      this.$.zoomOut.disabled = true;
    }

    // Print button.
    this.$.print.disabled = !options.print;

    // Download button.
    this.$.download.disabled = !options.download;
  }

  __toggleBetweenEpaperTypes (epaperType) {
    this.__epaperType = epaperType;
    this.__epaperActiveComponent = this.$[epaperType.toLowerCase().replace(/([-_][a-z])/ig, lowercase => lowercase.toUpperCase().replace('_', ''))];

    this.$.pdf.style.display = epaperType === CasperEpaper.EPAPER_TYPES.PDF ? 'flex' : 'none';
    this.$.image.style.display = epaperType === CasperEpaper.EPAPER_TYPES.IMAGE ? '' : 'none';
    this.$.upload.style.display = epaperType === CasperEpaper.EPAPER_TYPES.UPLOAD ? '' : 'none';
    this.$.iframe.style.display = epaperType === CasperEpaper.EPAPER_TYPES.IFRAME ? '' : 'none';
    this.$.genericPage.style.display = epaperType === CasperEpaper.EPAPER_TYPES.GENERIC_PAGE ? '' : 'none';
    this.$.serverDocument.style.display = epaperType === CasperEpaper.EPAPER_TYPES.SERVER_DOCUMENT ? '' : 'none';
    // console.log("%c__toggleBetweenEpaperTypes", "padding:10px;background-color:black;color:pink;",epaperType, CasperEpaper.EPAPER_TYPES.PDF, this.__currentAttachment?.id, this.$.pdf.style.display);
    // console.groupCollapsed(`VISIBLITY ${this.__currentAttachment?.id}`)
    // console.log(" @ pdf => ", this.$.pdf.style.display);
    // console.log(" @ image => ", this.$.image.style.display);
    // console.log(" @ upload => ", this.$.upload.style.display);
    // console.log(" @ iframe => ", this.$.iframe.style.display);
    // console.log(" @ genericPage => ", this.$.genericPage.style.display);
    // console.log(" @ serverDocument => ", this.$.serverDocument.style.display);
//
    // console.groupEnd();

  }

  __zoomChanged () {
    this.__enableOrDisableZoomButtons();
    this.__recalculateEpaperDimensions();
    afterNextRender(this, () => this.__epaperComponentContainer.style.display = 'block');

    if (this.__epaperActiveComponent && typeof this.__epaperActiveComponent.__zoomChanged === 'function') {
      afterNextRender(this, () => this.__epaperActiveComponent.__zoomChanged());
    }
  }

  __updateStickyDimensions () {
    afterNextRender(this, () => {
      this.__epaperComponentSticky.style.height     = 'auto';
      this.__epaperComponentSticky.style.minHeight  = `${parseInt(this.__epaperComponentStickyStyle.height * this.zoom)}px`

      if (this.disableStickyAnimation) {
        this.__epaperComponentSticky.style.opacity = 1;
        this.__epaperComponentSticky.style.transition = '';
      } else {
        this.__epaperComponentSticky.style.opacity = 0.2;
        this.__epaperComponentSticky.style.transition = `
          height 100ms linear,
          opacity 200ms linear
        `;
      }
    });
  }

  __recalculateEpaperDimensions () {
    afterNextRender(this, () => {
      // Scale the epaper component container.
      this.__epaperContainer.style.maxWidth = `${parseInt((this.__landscape ? this.__epaperComponentHeight : this.__epaperComponentWidth) * this.zoom)}px`;
      this.__epaperComponentContainer.style.width = `${parseInt((this.__landscape ? this.__epaperComponentHeight : this.__epaperComponentWidth) * this.zoom)}px`;
      this.__epaperComponentContainer.style.height = `${parseInt((this.__landscape ? this.__epaperComponentWidth : this.__epaperComponentHeight) * this.zoom)}px`;

      // Scale the post-it dimensions and position.
      this.__epaperComponentSticky.style.top = `${parseInt(50 - this.__epaperComponentStickyStyle.clipSize * this.zoom)}px`;

      if (this.__epaperComponentStickyPosition.align == 'left') {
        this.__epaperComponentSticky.style.left = `${parseInt(this.__epaperComponentStickyStyle.right * this.zoom)}px`;
      }

      if (this.__epaperComponentStickyPosition.align == 'right') {
        this.__epaperComponentSticky.style.right = `${parseInt(this.__epaperComponentStickyStyle.right * this.zoom)}px`;
      }

      this.__epaperComponentSticky.style.width = `${parseInt(this.__epaperComponentStickyStyle.width * this.zoom)}px`;
      this.__epaperComponentSticky.style.fontSize = `${parseInt(this.__epaperComponentStickyStyle.fontSize * this.zoom)}px`;
      this.__epaperComponentSticky.style.paddingTop = `${parseInt(this.__epaperComponentStickyStyle.paddingTop * this.zoom)}px`;
      this.__epaperComponentSticky.style.paddingLeft = `${parseInt(this.__epaperComponentStickyStyle.paddingLeft * this.zoom)}px`;
      this.__epaperComponentSticky.style.paddingRight = `${parseInt(this.__epaperComponentStickyStyle.paddingRight * this.zoom)}px`;
      this.__epaperComponentSticky.style.paddingBottom = `${parseInt(this.__epaperComponentStickyStyle.paddingBottom * this.zoom)}px`;

      this.__updateStickyDimensions();
    });
  }

  displayOrHideSticky (sticky) {
    this.__epaperComponentSticky.innerHTML = '';

    if (!sticky) {
      this.__epaperComponentSticky.style.display = 'none';
      return;
    }

    this.__updateStickyDimensions();

    this.__epaperComponentSticky.style.display = 'flex';
    this.__epaperComponentSticky.innerHTML = sticky.constructor === String ? sticky : Object.values(sticky).join('');
  }

  __displayErrorPage () {
    this.__loading = false;
    this.openGenericPage(this.$['error-opening-attachment-page-template']);
  }

  __loadingChanged (loading) {
    if (loading) {
      this.__displayLoadingOverlayTimeout = setTimeout(() => {
        this.__displayLoadingOverlay();
        this.__displayLoadingOverlayTimeout = undefined;

        // Hide the sticky container if it has contents while the epaper is loading something.
        if (!!this.__epaperComponentSticky.innerHTML) {
          this.__epaperComponentSticky.style.display = 'none';
        }
      }, 250);
    } else {
      // Display the sticky container if it has contents since the epaper has finished loading.
      if (!!this.__epaperComponentSticky.innerHTML) {
        this.__epaperComponentSticky.style.display = 'flex';
      }

      this.__displayLoadingOverlayTimeout
        ? clearTimeout(this.__displayLoadingOverlayTimeout)
        : this.__hideLoadingOverlay();
    }
  }

  __displayLoadingOverlay () {
    this.__epaperComponentLoadingOverlay.style.display = 'flex';
    this.__epaperComponentLoadingOverlay.style.width = '100%';
    this.__epaperComponentLoadingOverlay.style.height = '100%';
    this.__epaperComponentLoadingOverlay.setAttribute('visible', true);

    this.__enableOrDisableControlButtons({ zoom: true, print: false, paging: false }, false);
  }

  __hideLoadingOverlay () {
    this.__epaperComponentLoadingOverlay.removeAttribute('visible');
    this.__enableOrDisableControlButtons(this.__currentActionButtonsOptions);

    // Set the loading overlay dimensions to zero after the animation is finished.
    setTimeout(() => {
      this.__epaperComponentLoadingOverlay.style.display = 'none';
      this.__epaperComponentLoadingOverlay.style.width = 0;
      this.__epaperComponentLoadingOverlay.style.height = 0;
    }, 200);
  }

  __updateDownloadIconAndTooltip () {
    if (!this.__currentAttachment || !this.__currentAttachment.type) return;

    this.__epaperDownloadIcon = this.__getIconForFileType(this.__currentAttachment.type);
    this.__epaperDownloadTooltip = this.__currentAttachment.type === 'epaper'
      ? 'Download ficheiro PDF'
      : `Download ficheiro ${this.__currentAttachment.type.split('/').pop().toUpperCase()}`;
  }

  __getIconForFileType (fileType) {
    switch (fileType) {
      case 'epaper':
      case 'file/pdf':
        return 'fa-light:file-pdf';
      case 'file/txt':
        return 'fa-light:file-alt';
      case 'file/xml':
      case 'file/htm':
      case 'file/html':
        return 'fa-light:file-code';
      case 'file/png':
      case 'file/jpg':
      case 'file/jpeg':
        return 'fa-light:file-image';
      default:
        return 'fa-light:file-alt';
    }
  }
}

window.customElements.define('casper-epaper', CasperEpaper);
