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

import { LitElement, html, css } from 'lit';

import '../casper-epaper-servertip-helper.js';
import '@cloudware-casper/casper-icons/casper-icon-button.js';

export class CasperEpaperServerDocument extends LitElement {

  /*
   * Constants
   */
  static get BTN_SIZE ()        { return 24;       }
  static get KAPPA ()           { return .5522848; }
  static get BOLD_MASK ()       { return 0x01;     }
  static get ITALIC_MASK ()     { return 0x02;     }
  static get UNDERLINE_MASK ()  { return 0x04;     }
  static get STRIKEOUT_MASK ()  { return 0x08;     }
  static get BOLD_INDEX ()      { return 0;        }
  static get ITALIC_INDEX ()    { return 1;        }
  static get SIZE_INDEX ()      { return 2;        }
  static get FONT_NAME_INDEX () { return 4;        }

  static get properties () {
    return {
      /**
       * The TOConline's app object.
       *
       * @type {Object}
       */
      app: Object,
      /**
       * This flag states if the epaper document is in landscape mode or not.
       *
       * @type {Boolean}
       */
      landscape: {
        type: Boolean,
        notify: true
      },
      /**
       * This flag states if the epaper component is currently loading or not.
       *
       * @type {Boolean}
       */
      loading: {
        type: Boolean,
        notify: true
      },
      /**
       * The epaper's main component object.
       *
       * @type {Object}
       */
      epaper: Object,
      /**
       * The zoom that is currently applied.
       *
       * @type {Number}
       */
      zoom: Number,
      /**
       * The current document's page that should be displayed.
       *
       * @type {Number}
       */
      currentPage: {
        type: Number,
        observer: '__currentPageChanged',  // TODO port this to polymer
        notify: true
      },
      /**
       * The current document's total number of pages.
       *
       * @type {Number}
       */
      totalPageCount: {
        type: Number,
        notify: true
      },
    };
  }

  static styles = css`
    :host {
      height: 100%;
      display: flex;
      justify-content: center;
    }

    #canvas-container {
      height: 100%;
    }

    .line-menu-button {
      padding: 6px;
      margin-left: 4px;
      max-width: 28px;
      max-height: 28px;
      border-radius: 50%;
      -webkit-box-shadow: 0px 1px 6px -1px rgba(0, 0, 0, 0.61);
      -moz-box-shadow:    0px 1px 6px -1px rgba(0, 0, 0, 0.61);
      box-shadow:         0px 1px 6px -1px rgba(0, 0, 0, 0.61);
    }

    .delete {
      --casper-icon-button-color: white;
      --casper-icon-button-background-color: var(--status-red);
    }
  `;

  render () {
    return html`
    
    <div id="canvas-container">
      <canvas id="canvas"></canvas>
    </div>

    <casper-epaper-servertip-helper id="servertip" epaper-document=${this._epaperDocument}></casper-epaper-servertip-helper>
    <slot name="casper-epaper-line-menu">
    </slot>
    <div id="default-context-menu" class="context-menu" style="display: none;">
      <casper-icon-button icon="fa-light:plus"      class="line-menu-button"        tooltip="Adicionar linha" @click="${this.__addDocumentLine}"></casper-icon-button>
      <casper-icon-button icon="fa-light:trash-alt" class="line-menu-button delete" tooltip="Remover linha"   @click="${this.__removeDocumentLine}"></casper-icon-button>
    </div>
    `;
  }

  constructor () {
    super();

    this._epaperDocument   = this;
    this._scrollContainer  = document.getElementById(this.scroller);
    this._message          = '';
    this._r_idx            = 0.0;
    this._bands            = undefined;
    this.documentId        = undefined;
    this._images           = {};
    this._focusedBandId    = undefined; // TODO maybe not used anymore
    this._redraw_timer_key = '_epaper_redraw_timer_key';
    this._socket           = app.socket;
    this._app             = app;
    this._updateAssetsUrlFromSession();

    this._widgetCache = new Map();

    console.warn('hardcoding ep as global var!!!');
    window.ep = this; 

    // Canvas.
    this._gridMajor       = 0.0;
    this._gridMinor       = 0.0;
    this._backgroundColor = '#FFF';
    this._pageWidth       = 595.0;
    this._pageHeight      = 842.0;
  }

  connectedCallback () {
    super.connectedCallback();
    this._deactivateContextMenu();
    this._app.addEventListener('casper-page-changed', (e) => this._resetCommandData(true));
    this._app.addEventListener('casper-session-updated', (e) => {
      this._updateAssetsUrlFromSession();
      this._resetCommandData(true);
    });
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    // TODO remove listeners
  }

  firstUpdated () {

    // # TODO check if normal default slot pattens is possible
    const contextMenuSlotElements = this.epaper.__fetchAssignedElementsRecursively(this.shadowRoot.querySelector('slot[name="casper-epaper-line-menu"]'));
    this._contextMenuIndex = -1;
    this.__contextMenu = contextMenuSlotElements && contextMenuSlotElements.length > 0
        ? contextMenuSlotElements.shift()
        : this.renderRoot.getElementById('default-context-menu');

    this._is_socket_open = false;

    // Grab pointers to DOM elements
    this._canvas          = this.renderRoot.getElementById('canvas');
    this._servertip       = this.renderRoot.getElementById('servertip');
    this._canvasContainer = this.renderRoot.getElementById('canvas-container');

    // Variables to save the object context
    this._saved_idx         = 0.0;
    this._saved_draw_string = '';

    this._canvasContext   = this._canvas.getContext('2d', { alpha: false });
    this._canvasWidth     = this._canvas.width;
    this._canvasHeight    = this._canvas.height;
    this._canvasContext.globalCompositeOperation = 'copy';


    this._servertip.epaper = this;

    this.__edition = false;
    this._canvas.contentEditable = false;

    this._background_color  = '#FFFFFF';
    this._normal_background = '#FFFFFF';

    this._resetRenderState();
    this._resetCommandData();
    this._setupPixelRatio();
    this._setupScale();
    this._zoomChanged();
    this._clearPage();

    // TODO remove this
    if ( this.__masteM_doc_right_margin !== undefined ) {
      this.__rightMmargin = this.__masteM_doc_right_margin;
    }

    this._canvas.addEventListener('mousemove', event => this._moveHandler(event));
    this._canvas.addEventListener('mousedown', event => this._mouseDownHandler(event));
    this._canvas.addEventListener('mouseup'  , event => this._mouseUpHandler(event));
    this._socket.addEventListener('casper-disconnected', (e) => this._resetCommandData(true));
    document.fonts.onloadingdone = (fontFaceSetEvent) => this._repaintPage();  
  }

  //***************************************************************************************//
  //                                                                                       //
  //                                  ~~~ Public API ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

  /**
   * Open server document
   *
   * @param {Object} documentModel an object that specifies the layout and data of the document
   */
  async open (documentModel) {

    if ( documentModel.epaper2 ) { 
      this._socket = app.socket2; // TODO make this less hardcoded
    }

    this.currentPage = 1; // # TODO goto page on open /
    if ( documentModel.backgroundColor ) {
      this._setBackground(documentModel.backgroundColor);
    } else {
      this._setBackground('#FFF');
    }
    this.__prepareOpenCommand(documentModel);
    return this.__openChapter();
  }

  print () {
    this.app.showPrintDialog(this.__getPrintJob(true));
  }

  download () {
    this.app.showPrintDialog(this.__getPrintJob(false));
  }

  __getPrintJob (print) {
    let name  = this.document.name  || this.document.chapters[0].name  || 'Documento';
    let title = this.document.title || this.document.chapters[0].title || name;

    if (!this.__isPrintableDocument()) return;

    return {
      tube: 'casper-print-queue',
      name: name,
      validity: 3600,
      locale: this.__locale,
      continous_pages: true,
      auto_printable: print == true,
      action: print ? 'epaper-print' : 'epaper-download',
      public_link: {
        path: print ? 'print' : 'download'
      },
      documents: this.document.chapters.map(chapter => ({
        name: chapter.name || name,
        title: chapter.title || title,
        jrxml: chapter.jrxml,
        number_of_copies: chapter.number_of_copies || 1,
        jsonapi: {
          // TODO extract list of relationships from the report!!!! // TODO NO TOCONLINE
          urn: 'https://app.toconline.pt/' + chapter.path + (chapter.path.indexOf('?') != -1 ? '&' : '?') + ((undefined !== chapter.params && '' !== chapter.params) ? chapter.params : 'include=lines'),
          prefix: null,
          user_id: null,
          entity_id: null,
          entity_schema: null,
          sharded_schema: null,
          subentity_prefix: null,
          subentity_schema: null
        }
      }))
    };
  }

  /**
   * Re-opens the last document that was open
   */
  async reOpen () {
    if ( this.document !== undefined ) {
      const cloned_command = JSON.parse(JSON.stringify(this.document));
      this._clear();
      await this.open(cloned_command);
    } else {
      this._clear();
    }
    return true;
  }

  openAndGotoParamOrField (documentModel, chapterReport, fieldName, rowIndex) {
    this.__prepareOpenCommand(documentModel);
    this.__chapterIndex = undefined;
    this.gotoParamOrField(chapterReport, fieldName, rowIndex);
  }

  gotoParamOrField () {
    let chapterIndex = undefined;
    const highlightAfterLoad = () => {
      const command = !rowIndex
        ? `document highlight parameter "${fieldName}";`
        : `document highlight field "${fieldName}",${rowIndex};`;

      this.__sendCommand(command); // TODO port this
    };

    if ( this.__jrxml !== undefined ) {
      let reportName = this.__jrxml;
      let j;

      j = reportName.lastIndexOf('/');
      reportName = reportName.substring(j === -1 ? 0 : j +1, reportName.length);
      if ( reportName === chapterReport ) {
        chapterIndex = this.__chapterIndex;
      }
    }

    if ( this.chapterIndex === undefined ) {
      if ( this.document && this.document.chapters ) {
        for ( let i = 0; i < this.document.chapters.length; i++ ) {
          reportName = this.document.chapters[i].jrxml;
          j = reportName.lastIndexOf('/');
          reportName = reportName.substring(j === -1 ? 0 : j +1, reportName.length);
          if ( reportName === chapterReport ) {
            chapterIndex = i;
            break;
          }
        }
      }
    }

    if (  chapterIndex !== undefined ) {
      if ( chapterIndex !== this.__chapterIndex ) {
        this.__chapterIndex = chapterIndex;
        this.__chapter      = this.document.chapters[chapterIndex];
        this.__openChapter(1, highlightAfterLoad);
      } else {
        highlightAfterLoad();
      }
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                           ~~~ Initialization helpers ~~~                              //
  //                                                                                       //
  //***************************************************************************************//

  /**
   * @brief Initialize the context with the same defaults used by the server
   *
   * After server and client align the render contexts the server uses diferential updates
   */
  _resetRenderState () {
    this._fill_color  = '#FFFFFF';
    this._text_color  = '#000000';
    this.fontSpec     = ['', '', 10, 'px ', 'DejaVu Sans Condensed'];
    this._font_mask   = 0;
    this._canvasContext.strokeStyle = '#000000';
    this._canvasContext.lineWidth   = 1.0;
    this._canvasContext.font        = this.fontSpec.join('');
  }

  /**
   * Initialize the command data centralize here all that is needeed to init/clear the relation with server
   */
  _resetCommandData (keepLastCommand) {
    if ( ! keepLastCommand ) {
      this.__chapter = undefined;
    }
    this.__path      = undefined;
    this.__params    = undefined;
    this.__jrxml     = undefined;
    this.___locale   = undefined;
    this.__edit      = false;
    this.__loading   = false;
    this.__openFocus = undefined;
    this.__nextPage  = undefined;
  }

  //***************************************************************************************//
  //                                                                                       //
  //                             ~~~ Private methods ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

  __isPrintableDocument () {
    return this.document !== undefined
      && this.documentId !== undefined
      && this.document.chapters !== undefined;
  }

  _zoomChanged () {
    if (!this._canvas) return;

    this._setSize(
      Math.round((this._pageWidth   || this.width) * this.zoom),
      Math.round((this._pageHeight || this.height) * this.zoom)
    );

    // This is used to avoid the blinking black background when resizing a canvas.
    this._clearPage();

    if (this.documentId !== undefined && this.documentScale !== this.__sx) {
      // [AG] - load command call already sets/sends scale, so if loading do NOT send set scale command
      if ( false === this.loading ) {
        this._socket.setScale(this.documentId, 1.0 * this.__sx.toFixed(2));
      }
      this.documentScale = this.__sx;
    }
  }

  /**
   * @brief Clear the local document model
   */
  _clear (keepLastCommand) {
    this.__hideWidgets();
    this._bands = undefined;
    this._images = {};
    this._focusedBandId = undefined;
    this._resetCommandData(keepLastCommand);
    this.documentScale = undefined;
    this._clearPage();
  }

  /**
   * Sanitizes the document object model, auto selects the first chapter
   *
   * @param {Object} documentModel the document model
   */
  __prepareOpenCommand (documentModel) {
    this.document      = JSON.parse(JSON.stringify(documentModel));
    this.__chapterCount = this.document.chapters.length;
    this.totalPageCount = 0;

    for (let idx = 0; idx < this.__chapterCount; idx++) {
      this.document.chapters[idx].locale    = this.document.chapters[idx].locale    || 'pt_PT';
      this.document.chapters[idx].editable  = this.document.chapters[idx].editable  || false;
      this.document.chapters[idx].pageCount = this.document.pageCount               || 1;
      this.totalPageCount += this.document.chapters[idx].pageCount;
    }
    this.__chapterIndex = 0;
    this.__chapter      = this.document.chapters[0];
    this.__edition      = false;
  }

  /**
   * Opens the currently selected chapter
   *
   * @param {number} pageNumber page starts at 1
   */
  async __openChapter (pageNumber) {
    this.loading = true;

    this._servertip.enabled = false;
    //this._widget.setVisible(false);
    this.__hideWidgets(true);
    this.__resetScroll();
    this.__nextPage  = pageNumber || 1;
    this.__openFocus = this.__chapter.editable ? (this.__nextPage > 0 ? 'start' : 'end') : 'none';
    this.__loading = true;
    this.__resetCanvasDimensions();

    let response;

    if (!(this.__jrxml === this.__chapter.jrxml && this.__locale === this.__chapter.locale)) {

      response = await this._socket.openDocument(this.__chapter);

      if (response.errors !== undefined) {
        this._clear();
        throw new Error(response.errors);
      }

      this.documentId  = response.id;
      this._socket.registerDocumentHandler(this.documentId, (message) => this.documentHandler(message));
      this._pageWidth   = response.page.width;
      this._pageHeight = response.page.height;

      if (isNaN(this._pageHeight) || this._pageHeight < 0) {
        this._pageHeight = 4000;
        this._canvasContainer.style.overflow = 'auto';
      } else {
        this._canvasContainer.style.overflow = '';
      }

      this.__rightMmargin = response.page.margins.right;
      this.__jrxml        = this.__chapter.jrxml;
      this.__locale       = this.__chapter.locale;
    }

    this.landscape = this._pageHeight < this._pageWidth ;
    this._zoomChanged();

    this.__chapter.id = this.documentId;

    response = await this._socket.loadDocument({
      id:       this.documentId,
      editable: this.__chapter.editable,
      path:     this.__chapter.path,
      scale:    this.__sx,
      focus:    this.__openFocus,
      page:     this.__nextPage
    });

    if ( response.errors !== undefined ) {
      this._clear();
      throw new Error(response.errors);
    }

    this.__path    = this.__chapter.path;
    this.__params  = this.__chapter.params;
    this.__edition = this.__chapter.editable;
    this.documentScale  = this.__sx;

    this.__scalePxToServer = this._pageWidth  * this.__ratio / this._canvas.width;

    this._repaintPage();

    this.__loading = false;
    this._servertip.enabled = true;
    this.loading = false;
    return true;
  }

  /**
   * Hides all canvas overlays
   */
  __hideWidgets (hideInputButtons) {
    this._deactivateContextMenu();
    //this._widget.hideOverlays(hideInputButtons);
  }

  /**
   * Goto to the specified page. Requests page change or if needed loads the required chapter
   *
   * @param {number} pageNumber the page to render
   */
  async __currentPageChanged (pageNumber) {

    if ( this.document && this.document.chapters && this.document.chapters.length >= 1 ) {
      let currentPage = 1;

      pageNumber = parseInt(pageNumber);
      for ( let i = 0;  i < this.document.chapters.length; i++ ) {
        if ( pageNumber >= currentPage && pageNumber < (currentPage + this.document.chapters[i].pageCount) ) {
          let newPageNumber;

          newPageNumber = 1 + pageNumber - currentPage;
          if ( i === this.__chapterIndex ) {
            if ( this.__chapterPageNumber !== newPageNumber ) {
              this.__resetScroll();
              await this._socket.gotoPage(this.documentId, newPageNumber);
              return pageNumber;
            }
          } else {
            this.gotoChapter(i, newPageNumber);
            return pageNumber;
          }
          this.__chapterPageNumber = newPageNumber;
        }
        currentPage += this.document.chapters[i].pageCount;
      }
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                           ~~~ Context menu handling ~~~                               //
  //                                                                                       //
  //***************************************************************************************//

  async __removeDocumentLine () {
    // TODO spinner and errors
    if (this._contextMenuIndex !== - 1) {
      const response = await this._socket.deleteBand(
        this.documentId,
        this._bands[this._contextMenuIndex]._type,
        this._bands[this._contextMenuIndex]._id
      );
    }
  }

  async __addDocumentLine () {
    // TODO spinner and errors
    try {
      if (this._contextMenuIndex !== - 1) {
        const response = await this._socket.addBand(
          this.documentId,
          this._bands[this._contextMenuIndex]._type,
          this._bands[this._contextMenuIndex]._id
        );
      }  
    } catch (error) {
      console.log(error);
    }
  }

  _binaryFindBandByY (a_y) {
    if ( this._bands !== undefined && this._bands.length > 0 ) {
      let mid;
      let min = 0.0;
      let max = this._bands.length - 1;

      while ( min <= max ) {
        mid = Math.floor((min + max) / 2.0);

        if (   this._bands[mid]._type != 'Background'
            && a_y >= this._bands[mid]._ty
            && a_y <= (this._bands[mid]._ty + this._bands[mid]._height) ) {

          return mid; // found!

        } else if ( this._bands[mid]._ty < a_y ) {
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }
    }
    return -1; // Not found!
  }

  async getLineId () {
    if ( this._contextMenuIndex !== -1 ) {
      const band = this._bands[this._contextMenuIndex];
      if ( band._type === 'DT' && band._editable === true ) {
        this.epaper.__loading = true;
        const response = await this._socket.getBandDri(this.documentId, 'DT', band._id);
        this.epaper.__loading = false;
        if ( response.errors !== undefined ) {
          this._clear();
          throw new Error(response.errors);
        }
        return response.band.data;
      }
    }
    return undefined;
  }

  async getDataModelIndex () {
    if ( this._contextMenuIndex === -1 ) {
      return -1;
    }
    let idx = 0;

    for (let band of this._bands) {
      if ( band._type === 'DT' && this._bands[idx]._editable === true ) {
        if ( idx == this._contextMenuIndex ) {
          let response = await this._socket.getBandDri(this.documentId,'DT',this._bands[idx]._id);

          if (response.errors !== undefined) {
            this._clear();
            throw new Error(response.errors);
          }
          return response.band.properties.dri-1;
        }
      }
      idx++;
    }
  }

  _updateContextMenu (a_y) {
    if ( this.__edition === false ) {
      this._deactivateContextMenu();
      return;
    } else {
      let idx = this._binaryFindBandByY(a_y);

      if ( idx != -1 ) {
        if ( this._bands[idx]._type === 'DT' && this._bands[idx]._editable == true ) {
          if ( this._contextMenuIndex === idx ) {
            return;
          }
          if ( this._contextMenuIndex !== -1 ) {
            this._deactivateContextMenu(this._bands[this._contextMenuIndex]);
            this._contextMenuIndex = -1;
          }
          this._contextMenuIndex = idx;
          this._activateContextMenu(this._bands[this._contextMenuIndex]);

        } else {
          if ( this._contextMenuIndex !== -1 ) {
            this._deactivateContextMenu(this._bands[this._contextMenuIndex]);
            this._contextMenuIndex = -1;
          }
        }
      } else {
        if ( this._contextMenuIndex !== -1 ) {
          if ( this._bands !== undefined ) {
            this._deactivateContextMenu(this._bands[this._contextMenuIndex]);
          }
          this._contextMenuIndex = -1;
        }
      }
    }
  }

  _activateContextMenu (a_band) {
    const x = (this._pageWidth  - this.__rightMmargin) * this.__sx;
    const y = a_band._ty + a_band._height / 2 - (CasperEpaperServerDocument.BTN_SIZE * this.__ratio) / 2;

    this.__contextMenu.style.left = (x / this.__ratio) + 'px';
    this.__contextMenu.style.top  = (y / this.__ratio) + 'px';
    if ( this.__edition /*&& this.is_focused()*/ ) {
      this.__contextMenu.style.position = 'absolute';
      this.__contextMenu.style.display = 'flex';
    }
  }

  _deactivateContextMenu() {
    if ( this.__contextMenu ) {
      this.__contextMenu.style.display = 'none';
    }
  }

  /**
   * Given the chapter page number calculate the document page number and fire update event
   *
   * @param {number} pageNumber
   */
  _updatePageNumber (pageNumber) {

    if ( this.document && this.document.chapters ) {
      let page = pageNumber;

      for ( let idx = 0; idx < (this.__chapterIndex || 0); idx++ ) {
        page += ( this.document.chapters[idx].pageCount || 1);
      }
      if ( this.__loading === false ) {
        this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_NUMBER,' + page + ';' });
      }
      this._pageNumber = page;
    }
  }

  /**
   * Update total page count when a chaper page count is updated
   *
   * @param {number} chapterIndex the index of the chapter that changed
   * @param {number} pageCount the updated page counts
   */
  _updatePageCount (chapterIndex, pageCount) {
    let previousTotalPages = this.totalPageCount;

    if ( this.document && this.document.chapters && chapterIndex >= 0 && chapterIndex < this.document.chapters.length) {
      this.totalPageCount -= ( this.document.chapters[chapterIndex].pageCount || 1);
      this.document.chapters[chapterIndex].pageCount  = pageCount;
      this.totalPageCount += pageCount;
      if ( this.totalPageCount !== previousTotalPages && this.__loading === false ) {
        this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_COUNT,' + this.totalPageCount + ';' });
      }
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Canvas Rendering  ~~~                               //
  //                                                                                       //
  //***************************************************************************************//

  /**
   * @brief Determine the device pixel ratio: 1 on classical displays 2 on retina/UHD displays.
   */
  _setupPixelRatio () {
    let devicePixelRatio  = window.devicePixelRatio || 1;
    if (devicePixelRatio > 1.6) {
      devicePixelRatio = 2;
    } else {
      devicePixelRatio = 1;
    }

    const backingStoreRatio =
      this._canvasContext.webkitBackingStorePixelRatio ||
      this._canvasContext.mozBackingStorePixelRatio ||
      this._canvasContext.msBackingStorePixelRatio ||
      this._canvasContext.oBackingStorePixelRatio ||
      this._canvasContext.backingStorePixelRatio || 1;

    this.__ratio = devicePixelRatio / backingStoreRatio;
  }

  /**
   * Adjust the canvas dimension taking into account the pixel ratio and also calculates the scale the server should use.
   */
  _setupScale () {
    this._canvas.width         = this._canvasWidth * this.__ratio;
    this._canvas.height        = this._canvasHeight * this.__ratio;
    this._canvas.style.width   = `${this._canvasWidth}px`;
    this._canvas.style.height  = `${this._canvasHeight}px`;

    this.__sx = parseFloat((this._canvas.width  / this._pageWidth ).toFixed(2));

    this.__scalePxToServer = this._pageWidth  * this.__ratio / this._canvas.width;
  }

  /**
   * Changes the size of the epaper canvas.
   *
   * @param {number} width Canvas width in px.
   * @param {number} height Canvas height in px.
   * @param {boolean} forced When true forces a size change.
   */
  _setSize (width, height, forced) {
    if (width !== this._canvasWidth || height !== this._canvasHeight || forced) {
      if (forced) {
        this._canvasWidth = 100;
        this._canvasHeight = 100;
        this._setupScale();
      }

      this._canvasWidth  = width;
      this._canvasHeight = height;
      this._setupScale();
    }
  }

  /**
   * Changes the size of the epaper canvas.
   *
   * @param {string} color in #RRGGBB format.
   */
  _setBackground (color) {
    this._backgroundColor = color;
  }

  /**
   * Paints blank page
   */
  _clearPage () {
    const savedFill = this._canvasContext.fillStyle;

    this._canvasContext.fillStyle = this._backgroundColor;
    this._canvasContext.fillRect(0, 0, this._canvas.width, this._canvas.height);

    if (this._gridMajor !== 0.0) {
      this.__paintGrid(this._gridMajor, this._gridMinor);
    }
    this._canvasContext.fillStyle = savedFill;
  }

  __resetCanvasDimensions () {
    this._canvas.width  = this._canvasWidth  * this.__ratio;
    this._canvas.height = this._canvasHeight * this.__ratio;
    this._clearPage();
  }

  __paintGrid (gridMajor, gridMinor) {
    let x      = 0;
    let y      = 0;
    const width  = this._canvas.width;
    const height = this._canvas.height;

    this._canvasContext.beginPath();
    this._canvasContext.strokeStyle = '#C0C0C0';
    this._canvasContext.lineWidth   = 0.15;

    for (x = 0; x < width; x += gridMinor) {
      if ((x % gridMajor) !== 0) {
        this._canvasContext.moveTo(x, 0);
        this._canvasContext.lineTo(x, height);
      }
    }

    for (y = 0; y < height; y += gridMinor) {
      if ((y % gridMajor) !== 0) {
        this._canvasContext.moveTo(0, y);
        this._canvasContext.lineTo(width, y);
      }
    }

    this._canvasContext.stroke();
    this._canvasContext.beginPath();
    this._canvasContext.strokeStyle = '#C0C0C0';
    this._canvasContext.lineWidth   = 0.5;

    for (x = 0; x < width; x += gridMinor) {
      if ((x % gridMajor) === 0) {
        this._canvasContext.moveTo(x, 0);
        this._canvasContext.lineTo(x, height);
      }
    }

    for (y = 0; y < height; y += gridMinor) {
      if ((y % gridMajor) === 0) {
        this._canvasContext.moveTo(0, y);
        this._canvasContext.lineTo(width, y);
      }
    }

    this._canvasContext.stroke();
    this._canvasContext.strokeStyle = '#000000';
  }

  _paintString (a_draw_string) {
    this._message = a_draw_string;
    this._r_idx   = 0;
    this._paintBand();
  }

  __adjustScroll () {
    if ( this._scrollContainer ) {
      let inputCr = this._widget.getBoundingClientRect();
      let leftEdge, rightEdge, topEdge, bottomEdge;

      /*if ( this.iframe ) {
        leftEdge   = window.innerWidth  * 0.05;
        rightEdge  = window.innerWidth  * 0.95;
        topEdge    = window.innerHeight * 0.05;
        bottomEdge = window.innerHeight * 0.95;
      } else {
        console.log('=== TODO TODO TODO normal scrolling w/o iframe');
      }*/

      // ... for each edge check if the input is outside ...
      if ( inputCr.width > rightEdge - leftEdge ) {
        rightDelta = 0;
      } else {
        rightDelta = Math.max(inputCr.right  - rightEdge   , 0);
      }
      leftDelta   = Math.min(inputCr.left   - leftEdge    , 0);
      topDelta    = Math.min(inputCr.top    - topEdge     , 0);
      bottomDelta = Math.max(inputCr.bottom - bottomEdge  , 0);
      this._scrollContainer.scrollTop  += topDelta + bottomDelta;
      this._scrollContainer.scrollLeft += leftDelta + rightDelta;
    }
  }

  _scale_image (img_info, img) {
    let max_image_width  = img_info._r - img_info._l;
    let max_image_height = img_info._b - img_info._t;

    let s_x = -1;
    let s_y = -1;
    let s_w = img.naturalWidth;
    let s_h = img.naturalHeight;

    let f_x = 1;
    let f_y = 1;
    let t_w = max_image_width;
    let t_h = max_image_height;

    // calculate scale to apply
    switch(img_info._m) {
      case 'CL':
        // Only the portion of the image that fits the specified object width and height will be printed. Image is not stretched.
        t_w = Math.min(max_image_width, img.naturalWidth);
        t_h = Math.min(max_image_height, img.naturalHeight);
        s_w = t_w;
        s_h = t_h;
        break;

      case 'FF':
        // Image will be stretched to adapt to the specified object width and height.
        f_x = max_image_width / img.naturalWidth;
        f_y = max_image_height / img.naturalHeight;
        t_w /= f_x;
        t_h /= f_y;
        break;

      case 'RS':
        // Image will adapt to the specified object width or height keeping its original shape.
        f_x = f_y = Math.min(max_image_width / img.naturalWidth, max_image_height / img.naturalHeight);
        t_w = Math.min(img.naturalWidth  * f_x, max_image_width);
        t_h = Math.min(img.naturalHeight * f_x, max_image_height);
        break;

      case 'RH':
        // A scale image type that instructs the engine to stretch the image height to fit the actual height of the image.
        // If the actual image width exceeds the declared image element width, the image is proportionally stretched to fit the declared width.
        if ( img.naturalWidth <= max_image_width && img.naturalHeight <= max_image_height ) {
            f_x = f_y = Math.min(max_image_width / img.naturalWidth, max_image_width / img.naturalHeight);
        } else if ( sk_bitmap.width() > img.naturalHeight ) {
            f_x = max_image_width / img.naturalWidth;
            f_y = Math.min(max_image_height / img.naturalHeight, f_x);
        } else {
            f_y = max_image_height / img.naturalHeight;
            f_x = Math.min(max_image_width / sk_bitmap.width(), f_y);
        }
        t_w = img.naturalWidth  * f_x;
        t_h = img.naturalHeight * f_y;
        break;

      default:
        // return? invalidate?
        break;
    }

    // calculate x-position
    let x;
    if ( img_info._h === 'R' ) {
      x   = img_info._r - t_w;
      s_x = s_w - t_w;
    } else if ( img_info._h === 'C' ) {
      if ( t_w < max_image_width ) {
        s_x = 0;
        x   = img_info._l + (max_image_width - t_w ) / 2;
      } else {
        s_x = (img.naturalWidth - t_w) / 2;
        x   = img_info._l;
      }
    } else { /* left */
      x   = img_info._l;
      s_x = 0;
    }

    // calculate y-position
    let y;
    if ( img_info._v === 'B' ) {
      y   = ( b - 0 /*a_image->bottom_pen_.width_*/ ) - t_h;
      s_y = b - t_h;
    } else if ( img_info._v === 'M' ) {
      // TODO REVIEW THIS
      y   =  img_info._t  + ( ( max_image_height - t_h ) / 2 );
      s_y = ( img_info/ 2 ) - ( t_h / 2 );
    } else { /* top */
      y   = img_info._t;
      s_y = 0;
    }
    this._canvasContext.drawImage(img, s_x, s_y, s_w, s_h, x, y, t_w, t_h);
  }

  /**
   * @brief Create the handler for the mouse over time-out
   *
   * @param a_self The tooltip helper instance
   * @return the handler function
   */
  __createRedrawTimerHandler (a_self) {  // TODO modernize!!!
    return function () {
      a_self._repaintPage();
    }
  }

  /**
   * @start the redraw timer will redraw the page after a timeout
   */
  __restartRedrawTimer (a_time_in_ms) {
    let timeout = a_time_in_ms !== undefined ? a_time_in_ms : 300;

    if ( window[this._redraw_timer_key] !== undefined ) {
      window.clearTimeout(window[this._redraw_timer_key]);
      window[this._redraw_timer_key] = undefined;
    }
    window[this._redraw_timer_key] = setInterval(this.__createRedrawTimerHandler(this), timeout);
  }

  _getString () {
    let l = this._getDouble();
    let s  = this._r_idx;
    this._r_idx += l + 1;
    return this._message.substring(s, s + l);
  }

  _getDouble () {

    let fractional    = 0.0;
    let whole         = 0.0;
    let negative      = false;
    let parsing_whole = true;
    let divider       = 1.0;
    let current_c     = "";

    if ( this._message[this._r_idx] === '-' ) {
      negative = true;
      this._r_idx++;
    }

    while ( true ) {
      current_c = this._message[this._r_idx++];
      switch (current_c) {
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (parsing_whole) {
            whole *= 10.0;
            whole += current_c - '0';
          } else {
            fractional *= 10.0;
            fractional += current_c - '0';
            divider    *= 10.0;
          }
          break;
        case '.':
          parsing_whole = false;
          break;
        case ',':
        case ';':
          if ( negative == false ) {
            return (whole + fractional / divider);
          } else {
            return -(whole + fractional / divider);
          }
          break;  // Not reached
        default:
          return NaN;
      }
    }
  }

  _binaryFindBandById (a_id) {

    if ( this._bands !== undefined && this._bands.length > 0 ) {
      let mid;
      let min = 0.0;
      let max = this._bands.length - 1;

      while ( min <= max ) {
        mid = Math.floor((min + max) / 2.0);

        if ( this._bands[mid]._id === a_id ) {

          return mid; // found!

        } else if ( this._bands[mid]._id < a_id ) {
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }
    }
    return -1; // Not found!
  }

  /**
   * @brief the main drawing function paints a whole band
   *
   * The paint instructions are in the _message string, this string is walked using _r_idx index handling each
   * command until the end of the message
   */
   _paintBand () {

    let do_paint   = true;
    let option     = '';
    let option_num = 0.0;
    let x          = 0.0;
    let y          = 0.0;
    let x2         = 0.0;
    let y2         = 0.0;
    let r          = 0.0;
    let w          = 0.0;
    let h          = 0.0;
    let sx         = 0.0;
    let sy         = 0.0;
    let sh         = 0.0;
    let sw         = 0.0;
    let s          = this.__ratio;
    let t1,t2,t3;

    this._resetRenderState();
    while (this._r_idx < this._message.length) {

      switch ( this._message[this._r_idx++] ) {

        /*
         * === 'Z' [d] Zap clear the screen Z, Zd clear the band array but keeps screen content;
         */
        case 'Z':

          if ( this._message[this._r_idx] === 'd' ) {
            this._resetRenderState();
            this._r_idx++;
          } else {
            this._clearPage();
          }
          this._r_idx++;
          this._bands = undefined;
          this._bands = [];
          break;

        /*
         * === 'B' Store and paint Band B<len>,<type>,<id>,<height>,<tx>,<ty>;
         * === 'b' Store Band B<len>,<type>,<id>,<height>,<tx>,<ty>;
         */
        case 'B':
        case 'b':

          option = this._message[this._r_idx - 1];
          w      = this._getDouble();
          t1     = this._message.substring(this._r_idx, this._r_idx + w); // Band type
          this._r_idx += w + 1;
          w      = this._getDouble();                                     // Band ID
          t2     = this._message[this._r_idx];                           // Editable - 't' or 'f'
          this._r_idx += 2;
          h = this._getDouble();                                          // Band height
          x = this._getDouble();
          y = this._getDouble();

          // ... search for a band with same id on the stored band array ...
          let band = null;
          sx = this._binaryFindBandById(w);
          if ( sx !== -1 ) {
            band = this._bands[sx];
          } else {
            band = null;
          }

          // ... if the id is not found then it's a new band  ...
          if ( band === null ) {
            band = new Object;
            this._bands.push(band);
          }

          // ... store the current paint context on the band object
          band._type        = t1;
          band._id          = w;
          band._editable    = 't' == t2 ? true : false;
          band._height      = h;
          band._tx          = x;
          band._ty          = y;
          band._idx         = this._r_idx;
          band._draw_string = this._message;

          if ( option === 'b' ) { // ... deferred painting leave the crayons in peace ...

            do_paint = false;

          } else { // ... deferred painting leave the crayons in peace ...

            do_paint = true;
            this._canvasContext.clearRect(0, 0, this._pageWidth , h);

          }
          break;

        /*
         * === 'U' Update page, repaint with bands stored on client side;
         */
        case 'U':

          if ( this._bands !== undefined && this._bands.length ) {
            this._repaintPage();
          }
          return;

        /*
         * === 'L' Simple line L<x1>,<y1>,<x2>,<y2>;
         */
        case 'L':

          if ( do_paint ) {

            x  = this._getDouble();
            y  = this._getDouble();
            x2 = this._getDouble();
            y2 = this._getDouble();

            this._canvasContext.beginPath();

            if ( x === x2 && this.__ratio == 1 ) {

              w = Math.round(this._canvasContext.lineWidth) & 0x1 ? -0.5 : 0;
              this._canvasContext.moveTo(x  + w, y  + w);
              this._canvasContext.lineTo(x2 + w, y2 + w);

            } else if ( y === y2 && this.__ratio == 1 ) {

              w = Math.round(this._canvasContext.lineWidth) & 0x1 ? -0.5 : 0;
              this._canvasContext.moveTo(x  + w, y  + w)
              this._canvasContext.lineTo(x2 + w, y2 + w);

            } else {

              this._canvasContext.moveTo(x , y);
              this._canvasContext.lineTo(x2, y2);

            }

            this._canvasContext.stroke();

          } else {
            this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble();
          }
          break;

        /*
         * === 'R' Rectangle R[S|F|P|C]<x>,<y>,<w>,<h>
         */
        case 'R':

          switch (this._message[this._r_idx] ) {
            case 'S':
              this._r_idx++;
            // fall trough
            default:
              if ( do_paint ) {
                this._canvasContext.strokeRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble()
              }
              break;

            case 'F':
              this._r_idx++;
              this._canvasContext.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._canvasContext.fillRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble();
              }
              break;

            case 'P':
              this._r_idx++;
              this._canvasContext.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._canvasContext.beginPath();
                this._canvasContext.rect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
                this._canvasContext.fill();
                this._canvasContext.stroke();
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble();
              }
              break;

            case 'C':
              this._r_idx++;
              if ( do_paint ) {
                this._canvasContext.clearRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble();
              }
              break;
          }
          break;

        /*
         * === 'r'  Rounded rectangle
         *  |- 'rS' Stroke round rect          - rS<r>,<x>,<y>,<w>,<h>;
         *  |- 'rF' Fill round rect            - rF<r>,<x>,<y>,<w>,<h>;
         *  |- 'rP' Fill and stroke round rect - rP<r>,<x>,<y>,<w>,<h>;
         */
        case 'r':

          option = this._message[this._r_idx];
          switch (option) {
            case 'S':
            case 'F':
            case 'P':
              this._r_idx++;
              break;
            default:
              option = 'S';
              break;
          }
          r = this._getDouble();
          x = this._getDouble();
          y = this._getDouble();
          w = this._getDouble();
          h = this._getDouble();
          if ( do_paint ) {
            this._canvasContext.beginPath();
            this._canvasContext.moveTo( x + r, y );
            this._canvasContext.arcTo(  x + w , y     , x + w     , y + r     , r);
            this._canvasContext.arcTo(  x + w , y + h , x + w - r , y + h     , r);
            this._canvasContext.arcTo(  x     , y + h , x         , y + h - r , r);
            this._canvasContext.arcTo(  x     , y     , x + r     , y         , r);
            this._canvasContext.closePath();
          }
          switch(option) {
            case 'S':
              if ( do_paint ) {
                this._canvasContext.stroke();
              }
              break;

            case 'F':
              this._canvasContext.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._canvasContext.fill();
              }
              break;

            case 'P':
              this._canvasContext.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._canvasContext.fill();
                this._canvasContext.stroke();
              }
              break;
          }
          break;

        /*
         * === 'e' Prepare   editor ep<x>,<y>,<w>,<h>;
         *  |- 'e' Start     editor es<options>,<text_x>,<text_y>,<max_width>,<length>,<text>;
         *  |- 'e' Update    editor eu<length>,<text>,<highlight_len>,<highlight>;
         *  |- 'e' Finish    editor ef<length>,<text>,<highlight_len>,<highlight>;
         *  |- 'e' Configure editor ec TODO
         *  |- 'e' Tooltip hint   eh<x>,<y>,<w>,<h>,<length>,<tooltip text>
         */
        case 'e':

          option = this._message[this._r_idx];
          this._r_idx++;
          this._canvasContext.save();
          if ( option === 'a' ) { // attach widget in epaper 2.0
            try {
              const binding = JSON.parse(this._message.substring(4, this._message.length -1));
              this._r_idx += this._message.length - 4;
              this._attachEditorWidget(binding);
            } catch (error) {
              console.error(`Invalid binding with ${error}`);
              // TODO how to show errors and recover
            }
          } else if ( option === 'c') {  // Configure editor

            // ... clear the sub document variables ...
            this._sub_document_uri   = undefined;
            this._sub_document_jrxml = undefined;

            let edit_mode = this._message[this._r_idx++];
            switch ( edit_mode ) {

            case 'r': // 'r' Text, but read only
              if ( ',' === this._message[this._r_idx] ) {
                this._r_idx++;
                w = this._getDouble();
                this._sub_document_uri = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w + 1; // +1 -> ','
                console.log("Open URI: " + this._sub_document_uri)
                w = this._getDouble();
                this._sub_document_jrxml = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w;
                console.log("Open JRXML: " + this._sub_document_jrxml)
              }
              this._widget.setMode(edit_mode);
              this._r_idx += 1; // 't'
              break;

            case 't':  // Text ( default )

              this._widget.setMode(edit_mode);

              this._r_idx += 1; // 't'
              break;

            case 'd': // ... Date [,<length>,<pattern>] ...

              if ( ',' === this._message[this._r_idx] ) {
                this._r_idx++;
                w = this._getDouble();
                this._widget.setMode(edit_mode);
                this._r_idx += w;
              } else {
                this._widget.setMode(edit_mode);
              }
              this._r_idx++;
              break;

            case 'n':  // ... Number [,<length>,<pattern>] ...

              if ( ',' === this._message[this._r_idx] ) {
                  this._r_idx++;
                  w = this._getDouble();
                  this._widget.setMode(edit_mode);
                  this._r_idx += w;
              } else {
                this._widget.setMode(edit_mode);
              }
              this._r_idx++;
              break;

            case 'c':  // 'c'<version>,<empty_line><length>,<field_id>,<length>,<display_field>{,<length>,<field>}[,<length>,<list json>] Simple combo  client side
              let version = this._getDouble();
              if ( version === 2 ) {
                w  = this._getDouble();
                t2 = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w + 1;
                try {
                  this._widget.setCasperBinding(JSON.parse(t2));
                } catch (err) {
                  console.log("*** JSON error in combo box config!!1");
                }
              } else {
                // empty_line: 0 or 1
                let nullable_list = this._getDouble();
                // fields '}'
                let fields = [];
                w = this._getDouble();
                if ( w > 2 ) {
                  let tmp = this._message.substring(this._r_idx + 1, this._r_idx + w - 1);
                  fields = tmp.split(',');
                  //console.log("Combo FIELDS: " + fields);
                }
                this._r_idx += w + 1;

                // list id
                w  = this._getDouble();
                t2 = this._message.substring(this._r_idx, this._r_idx + w);
                //console.log("Combo list id: " + t2);
                this._r_idx += w + 1;

                // sub document params <length>,<uri>,<length>,<jrxml>
                w = this._getDouble();
                if ( w == 0 ) {
                  this._sub_document_uri = undefined;
                } else {
                  this._sub_document_uri = this._message.substring(this._r_idx, this._r_idx + w);
                }
                this._r_idx += w + 1;
                w = this._getDouble();
                if ( w == 0 ) {
                  this._sub_document_jrxml = undefined;
                } else {
                  this._sub_document_jrxml = this._message.substring(this._r_idx, this._r_idx + w);
                }
                this._r_idx += w;

                if ( ',' === this._message[this._r_idx] ) {
                  this._r_idx++;
                  // list [optional]
                  w  = this._getDouble();
                  t3 = this._message.substring(this._r_idx, this._r_idx + w);
                  //console.log("Combo JSON: " + t3);
                  this._r_idx += w;
                } else {
                  t3 = undefined;
                }

                this._widget.setMode(edit_mode);
                this._widget.setDisplayFields(fields);
                this._widget.setModelFromJson(t2,t3);
                this._r_idx++;
              }
              break;

            case 'R': // 'R'<idx>,<length>,<variable>,<lenght>,<value_array>

              x  = this._getDouble();                                      // -1 for parameters, row index for fields
              w  = this._getDouble();
              t1 =this._message.substring(this._r_idx, this._r_idx + w);   // variable name, parameter ou field
              this._r_idx += w + 1; // + 1 -> ','
              w  = this._getDouble();
              t2 =this._message.substring(this._r_idx, this._r_idx + w);   // Array with current and possible values
              this._r_idx += w + 1; // +1 -> ';''
              this._widget.setMode(edit_mode);
              break;

            case 'C': // 'C'[,<length>,<uri>,<length>,<jrxml>] Combos server side, IVAS, Rubricas, Centros de Custo

              if ( ',' === this._message[this._r_idx] ) {
                this._r_idx++;
                w = this._getDouble();
                this._sub_document_uri = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w;
                this._r_idx++; // ','
                w = this._getDouble();
                this._sub_document_jrxml = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w;
              }
              this._widget.setMode(edit_mode);

              this._r_idx += 1;
              break;

            case 'l':  // 'l' Combo that searches on a ledger tree

              this._widget.setMode(edit_mode);


              let fields = [];
              w = this._getDouble();
              if ( w > 2 ) {
                let tmp = this._message.substring(this._r_idx + 1, this._r_idx + w - 1);
                fields = tmp.split(',');

                //console.log("Combo FIELDS: " + fields);
              }
              this._widget.setDisplayFields(fields);
              this._r_idx += w + 1;
              break;

            default:
              break;
            }

          } else if ( option === 'p' ) { // Prepare editor defines the bounding box

            x = this._getDouble() / s;
            y = this._getDouble() / s;
            w = this._getDouble() / s;
            h = this._getDouble() / s;

            this._updateContextMenu(y + h / 2);

            return; // The rest of the draw string is just stored it will be painted by the editor

          } else if ( option === 's' ) { // ... start editor ...

            x = this._getDouble();
            y = this._getDouble();
            h = this._getDouble();
            this._focusedBandId = this._getDouble();

            if ( '{' === this._message[this._r_idx] ) {
              this._r_idx += 1; // '{'

              w = this._getDouble();
              let id = this._message.substring(this._r_idx, this._r_idx + w);
              this._r_idx += w + 1;

              w = this._getDouble();
              let value = this._message.substring(this._r_idx, this._r_idx + w);
              this._r_idx += w + 1; // +1 -> '}'
              /*this._widget.setValue(id, value);*/

            } else {
              w = this._getDouble();
              /*if ( this._widget ) {
                this._widget.setValue(this._message.substring(this._r_idx, this._r_idx + w));
              } else {
                console.log('es');
              }*/
              this._r_idx += w;
            }

            /*if ( this._widget ) {
              this._widget.alignStyle(x,y,h);
              this._widget.grabFocus();  
            } else {
              console.log('es');
            }*/
            this._r_idx += 1;
            this.__adjustScroll();

          } else if ( option === 'u' ) {  // ... update editor ...

            w  = this._getDouble();
            t1 = this._message.substring(this._r_idx, this._r_idx + w);
            this._r_idx += w;
            if ( this._message[this._r_idx] !== ';' ) {
              this._r_idx += 1;
              w  = this._getDouble();
              t2 = this._message.substring(this._r_idx, this._r_idx + w);
              this._r_idx += w;

              if ( this._message[this._r_idx] !== ';' ) {
                this._r_idx += 1;
                w  = this._getDouble();
                t3 = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w + 1;
              } else {
                this._r_idx += 1;
                t3 = '';
              }
            } else {
              this._r_idx += 1;
              t2 = '';
              t3 = '';
            }
            console.log("=== update: t1='" + t1 + "' t2='" + t2 + "' t3='" + t3 + "'");

            if ( ';' !== this._message[this._r_idx - 1] ) {
              w = this._getDouble();

              let json = this._message.substring(this._r_idx, this._r_idx + w);

              //this._widget.setModelFromJson(undefined, json);
              //this._widget.autoSizeOverlay(this._widget.style.width);

              //console.log("JSON: " + json);

              this._r_idx += w + 1;
            } else {
              //this._widget.setModelFromJson(undefined, '[]');
              //this._widget.autoSizeOverlay(this._widget.style.width);
            }

          } else if ( option === 'f' ) { // ... finish or stop the editor ...

            /*if ( this._widget ) {
              this._widget.setCasperBinding(undefined);
            } else {
              console.log('ef');
            }*/
            this._r_idx += 1;

            // ... clear the sub document variables ...
            this._sub_document_uri   = undefined;
            this._sub_document_jrxml = undefined;
          } else if ( option === 'b' ) {

            this._r_idx += 1;

            let tmp_stroke_style = this._canvasContext.strokeStyle;
            this._canvasContext.strokeStyle = "#FF0000";
            this._canvasContext.strokeRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
            this._canvasContext.strokeStyle = tmp_stroke_style;

          } else if ( option === 'h' ) { // ... tootip hint ...

            x  = this._getDouble() / s;
            y  = this._getDouble() / s;
            w  = this._getDouble() / s;
            h  = this._getDouble() / s;
            w  = this._getDouble();
            t1 = this._message.substring(this._r_idx, this._r_idx + w);
            if ( this._widget ) {
              this._widget.serverTooltipUpdate(x, y, w, h, t1);
            } else {
              console.log('eh');
            }
            this._r_idx += w + 1;
          }

          this._canvasContext.restore();
          break;

        /*
         * === 'T' Draw text
         */
        case 'T':

          option = this._message[this._r_idx];
          if ( option === 'S' || option === 'F' || option === 'P' ) {
            this._r_idx++;
          } else {
            option = 'F';
          }
          x = this._getDouble();
          y = this._getDouble();
          w = this._getDouble();
          this._t = this._message.substring(this._r_idx, this._r_idx + w);
          this._r_idx += w;
          if ( this._message[this._r_idx] == ',') {
            this._r_idx++;
            option_num = this._getDouble();

            switch (option) {
              case 'F':
                this._canvasContext.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._canvasContext.fillText(this._t, x, y, option_num);
                }
                break;

              case 'S':
                if ( do_paint ) {
                  this._canvasContext.strokeText(this._t, x, y, option_num);
                }
                break;

              case 'P':
                this._canvasContext.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._canvasContext.fillText(this._t, x, y, option_num);
                  this._canvasContext.strokeText(this._t, x, y, option_num);
                }
                break;
            }

          } else {
            this._r_idx++;
            switch (option) {
              case 'F':
                this._canvasContext.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._canvasContext.fillText(this._t, x, y);
                }
                break;

              case 'S':
                if ( do_paint ) {
                  this._canvasContext.strokeText(this._t, x, y);
                }
                break;

              case 'P':
                this._canvasContext.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._canvasContext.fillText(this._t, x, y);
                  this._canvasContext.strokeText(this._t, x, y);
                }
                break;
            }
          }
          this._canvasContext.fillStyle = this._fill_color;
          break;

        /*
         * === 'P' Path TODO
         */
        case 'P':
          break;

        /*
         * === 'C' Fill color
         */
        case 'C':

          this._fill_color = "#" + this._message.substring(this._r_idx, this._r_idx + 6);
          this._r_idx += 7;
          break;

        /*
         * === 'c' Text fill color
         */
        case 'c':

          this._text_color = "#" + this._message.substring(this._r_idx, this._r_idx + 6);
          this._r_idx += 7;
          break;

        /*
         * === 'w' Stroke Width w<width>;
         */
        case 'w':

          w = this._getDouble();
          if ( w <= 1 ) {
            w = this.__ratio;
          }
          this._canvasContext.lineWidth = w;
          break;

        /*
         * === 's' Stroke Color TODO alfa support ??
         */
        case 's':

          this._canvasContext.strokeStyle = "#" + this._message.substring(this._r_idx, this._r_idx + 6);
          this._r_idx += 7;
          break;

        /*
         * === 'p' Line pattern TODO
         */
        case 'p':
          break;

        /*
         * === 'E' Ellipse
         */
        case 'E':

          option = this._message[this._r_idx];
          if ( option == 'S' || option == 'F' || option == 'P' ) {
            this._r_idx++;
          } else {
            option = 'F';
          }
          x = this._getDouble();
          y = this._getDouble();
          w = this._getDouble();
          h = this._getDouble();
          let ox = (w / 2) * CasperEpaperServerDocument.KAPPA,
              oy = (h / 2) * CasperEpaperServerDocument.KAPPA,
              xe = x + w,
              ye = y + h,
              xm = x + w / 2,
              ym = y + h / 2;

          if ( do_paint ) {
            this._canvasContext.beginPath();
            this._canvasContext.moveTo(x, ym);
            this._canvasContext.bezierCurveTo(x       , ym - oy , xm - ox , y       , xm, y);
            this._canvasContext.bezierCurveTo(xm + ox , y       , xe      , ym - oy , xe, ym);
            this._canvasContext.bezierCurveTo(xe      , ym + oy , xm + ox , ye      , xm, ye);
            this._canvasContext.bezierCurveTo(xm - ox , ye      , x       , ym + oy , x , ym);
          }
          switch (option) {
            case 'F':
              this._canvasContext.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._canvasContext.fill();
              }
              break;

            case 'S':
              if ( do_paint ) {
                this._canvasContext.stroke();
              }
              break;

            case 'P':
              this._canvasContext.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._canvasContext.fill();
                this._canvasContext.stroke();
              }
              break;
          }

          break;

        /*
         * === 'I' Image : I<id>,<url_chars_count>,<url>,<x>,<y>,<w>,<h>
         * === 'I' Image : I<id>,<url_chars_count>,<url>,<x>,<y>,<w>,<h>,<sx>,<sy>,<sw>,<sh>
         */
        case 'I':

          let img_info = {
            _id:   this._getDouble(),
            _path: this._getString(),
            _t:    this._getDouble(),
            _l:    this._getDouble(),
            _b:    this._getDouble(),
            _r:    this._getDouble(),
            _m:    this._getString(),
            _h:    this._getString(),
            _v:    this._getString()
          };

          let img = this._images[img_info._path];
          if ( img === undefined && img_info._path.length ) {
            img = new Image();
            this._images[img_info._path] = img;
            img.onload = function() {
              this.__restartRedrawTimer();
            }.bind(this);
            img.onerror = function() {
              this._images[img_info._path] = undefined;
            }.bind(this);
            img.src = this._uploaded_assets_url + img_info._path;
            this._images[img_info._path] = img;
          }
          if ( img && img.complete && typeof img.naturalWidth !== undefined && img.naturalWidth !== 0 ) {
            try {
              this._scale_image(img_info, img);
            } catch (a_err) {
              console.log(a_err);
              // Keep the faulty image in the cache to avoid bombarding the server with broken requests
            }
          }
          break;

        /*
         * === 'F' Set font name F<len>,<font name>;
         */
        case 'F':

          w = this._getDouble();
          this._t = this._message.substring(this._r_idx, this._r_idx + w);
          this._r_idx += w + 1;
          this.fontSpec[CasperEpaperServerDocument.FONT_NAME_INDEX] = this._t;
          this._canvasContext.font = this.fontSpec.join('');
          break;

        /*
         * === 'f'  Set font flag <size>, font mask <flag_mask>,f<size>
         *  |  'fm' Set font metrics <flag_mask>,f<size>,<fFlags>, <fTop>, <fAscent>, <fDescent>, <fBottom>, <fLeading>, <fAvgCharWidth>, <  fMaxCharWidth>, <fUnderlineThickness>, fUnderlinePosition>;
         */
        case 'f':
          if ( 'm' == this._message[this._r_idx] ) {
              this._r_idx++;
              /*this._widget._f_flags               = */this._getDouble();
              /*this._widget._f_top                 = */this._getDouble();
              /*this._widget._f_ascent              = */this._getDouble();
              /*this._widget._f_descent             = */this._getDouble();
              /*this._widget._f_bottom              = */this._getDouble();
              /*this._widget._f_leading             = */this._getDouble();
              /*this._widget._f_avg_char_width      = */this._getDouble();
              /*this._widget._f_max_char_width      = */this._getDouble();
              /*this._widget._f_underline_thickness = */this._getDouble();
              /*this._widget._f_underline_position  = */this._getDouble();
          } else {
              this._font_mask = this._getDouble();
              this.fontSpec[CasperEpaperServerDocument.SIZE_INDEX]   = Math.round(this._getDouble());
              this.fontSpec[CasperEpaperServerDocument.BOLD_INDEX]   = (this._font_mask & CasperEpaperServerDocument.BOLD_MASK)   ? 'bold '   : '';
              this.fontSpec[CasperEpaperServerDocument.ITALIC_INDEX] = (this._font_mask & CasperEpaperServerDocument.ITALIC_MASK) ? 'italic ' : '';
              this._canvasContext.font = this.fontSpec.join('');
          }
          break;

        /*
         * === 'X' Set translation X<x>,<y>;
         */
        case 'X': //=== Legacy command, deprecated

          this._getDouble();
          this._getDouble();
          break;

        /*
         * === 't' Apply transform
         */
        case 't':

          switch (this._message[this._r_idx++]) {
            case 'r':
              this._canvasContext.translate(this._getDouble(), this._getDouble());
              this._canvasContext.rotate(this._getDouble());
              break;
            case 'c':
              this._canvasContext.setTransform(1, 0, 0, 1, 0, 0);
              this._r_idx++;
              break;
          }
          break;

        /*
         * === 'k'  Set canvas properties
         *  |- 'kp' Set page params - kp<width>,<height>,<page_number>,<page_count>;
         *  |- 'kg' Set grid params - kg<major>,<minor>; (use kg0,0; to disable grid)
         */
        case 'k': //===

          option = this._message[this._r_idx++];
          if ( 'g' === option ) {
            this._grid_major = this._getDouble();
            this._grid_minor = this._getDouble();
          } else if ( 'p' === option ) {
            let new_page_number = this._getDouble();
            let new_page_count = this._getDouble();

            if ( this.__chapterPageNumber != new_page_number || this.__chapterPageCount != new_page_count ) {
              //if ( this.on_page_properties_changed != undefined ) {
              //  this.on_page_properties_changed(this._pageWidth , this._pageHeight, new_page_number, new_page_count);
              //}
              this.__chapterPageCount  = new_page_count;
              this.__chapterPageNumber = new_page_number;
            }
          }
          break;
      }
      if ( this._message[this._r_idx - 1] != ';' ) {
        console.log("command is not terminated ...");
      }
    }
  }

  _onPaintMessage (a_message) {
    this._r_idx   = 2; // D:
    this._message = a_message;
    this._paintBand();
  }

  __resetScroll () {
    if ( this._scrollContainer ) {
      this._scrollContainer.scrollTop  = 0;
      this._scrollContainer.scrollLeft = 0;
    }
  }

  /**
   * Repaints the whole page using the saved bands array
   *
   * Bands are painted top to down to preserve the overlaps between bands, Z level of uppermost band is
   * always bellow the next band
   *
   * @note This function must keep the object context and canvas context unmodified
   */
  _repaintPage () {
    let band;

    this._reset_redraw_timer();

    console.time("repaint_page");

    // ... save context clear the complete canvas ...
    this._savePaintContext();
    this._canvasContext.save();
    this._clearPage();

    // ... repaint the bands top to down to respect the painter's algorithm ...
    if ( this._bands !== undefined ) {
      for ( let i = 0; i < this._bands.length; i++ ) {

        band = this._bands[i];
        this._r_idx       = band._idx;
        this._message     = band._draw_string;
        this._paintBand();
      }
    }

    this._canvasContext.restore();
    this._restorePaintContext();

    console.timeEnd("repaint_page");
  }

  /**
   * @brief Resets the deferred repaint timer
   */
  _reset_redraw_timer () {

    if ( window[this._redraw_timer_key] !== undefined ) {
      window.clearTimeout(window[this._redraw_timer_key]);
      window[this._redraw_timer_key] = undefined;
    }
  }

  _savePaintContext () {
    this._saved_idx         = this._r_idx;
    this._saved_draw_string = this._message;
  }

  _restorePaintContext () {
    this._r_idx           = this._saved_idx;
    this._message         = this._saved_draw_string;
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Websocket handlers ~~~                              //
  //                                                                                       //
  //***************************************************************************************//

  async documentHandler (a_message) {
    switch (a_message[0]) {
      //case 'S':
      //  if ( a_message.indexOf('S:ok:data:') === 0 ) {
      //    if ( this._getDataCallback !== undefined ) {
      //      this._getDataCallback(a_message.substring('S:ok:data:'.length));
      //      this._getDataCallback = undefined;
      //    }
      //  } else {
      //    this._request_callback(a_message);
      //  }
      //  break;

      case 'n':
        const notification = JSON.parse(a_message.substring(2));

        if ( notification.focus ) {
          if ( notification.focus === 'forward' ) {
            // [AG] - no longer required on v2
            if ( 2.0 !== this._socket._version ) {
              if ( this.epaper.nextChapter() === false ) {
                // console todo add line ??
                await this._socket.setTextT(this.documentId, this._widget._textArea.value, null, true);
              }
            }
            return;
          }
          if ( notification.focus === 'backwards' ) {
            // [AG] - no longer required on v2
            if ( 2.0 !== this._socket._version ) {
              if ( false == this.epaper.previousChapter() ) {
                await this._socket.setTextT(this.documentId, this._widget._textArea.value, null, true);
              }
            }
            return;
          }
        }
        if ( notification.variables ) {
          if ( notification.variables.PAGE_COUNT ) {
            this._updatePageCount(this.__chapterIndex, notification.variables.PAGE_COUNT);
          }
          if ( notification.variables.PAGE_NUMBER ) {
            this._updatePageNumber(notification.variables.PAGE_NUMBER);
          }
        }
        //let message = a_message.substring(2);

        //if ( message.startsWith('update:focus,forward') ) {
        //  if ( this.nextChapter() ) {
        //    return;
        //  }
        //} else if ( message.startsWith('update:focus,backward') ) {
        //  if ( this.previousChapter() ) {
        //    return;
        //  }
        //} else if (message.startsWith('update:variable,PAGE_COUNT,')) {
        //  let pageCount;
//
        //  pageCount = parseInt(message.substring('update:variable,PAGE_COUNT,'.length));
        //  this._updatePageCount(this.__chapterIndex, pageCount);
        //  return;
//
        //} else if (message.startsWith('update:variable,PAGE_NUMBER,')) {
        //  let pageNumber;
//
        //  pageNumber = parseInt(message.substring('update:variable,PAGE_NUMBER,'.length));
        //  this._updatePageNumber(pageNumber);
        //  return;
        //}
        //this._fireEvent('casper-epaper-notification', { message: message });
        break;

      //case 'E':
//
      //  this._r_idx   = 1;
      //  this._message = a_message;
//
      //  let w = this._getDouble();
      //  let k = this._message.substring(this._r_idx, this._r_idx + w);
      //  this._r_idx += w + 1; // +1 -> ','
//
      //      w = this._getDouble();
      //  let t = this._message.substring(this._r_idx, this._r_idx + w);
      //  this._r_idx += w + 1; // +1 -> ','
//
      //      w = this._getDouble();
      //  let m = this._message.substring(this._r_idx, this._r_idx + w);
      //  this._r_idx += w + 1; // +1 -> ','
//
      //  if ( this._message[this._r_idx - 1] != ';' ) {
      //    console.log("command is not terminated ...");
      //  }
//
      //  //if ( undefined !== this._listener && undefined !== this._listener.on_error_received ) {
      //  //  this._listener.on_error_received(t, m);
      //  //}
      //  let errorDetail = undefined;
      //  if ( m.indexOf('S:failure:load:') === 0 ) {
      //    error = JSON.parse(m.replace('S:failure:load:',''));
      //    errorDetail = error.errors.first();
      //  } else if ( m.indexOf('S:failure:pdf:') === 0 ) {
      //    error = JSON.parse(m.replace('S:failure:pdf:',''));
      //    errorDetail = error.errors.first();
      //  } else if ( m !== undefined && m.length !== 0 ) {
      //    errorDetail = m;
      //  }
//
      //  if ( errorDetail !== undefined ) {
      //    this._fireEvent('casper-epaper-error', errorDetail);
      //  }
//
      //  break;

      case 'D':
        this._onPaintMessage(a_message);
        break;

      default:
        // ignore
        break;
    }
  }

  _fireEvent (eventName, eventData) { // TODO check legacy
    window.parent.document.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Mouse handlers ~~~                                  //
  //                                                                                       //
  //***************************************************************************************//

  _mouseDownHandler (a_event) {
    // This means the canvas is being used by the PDF epaper so no need to react to these events.
    if (this.shadowRoot.host.style.display === 'none') return;
  }

  _mouseUpHandler (a_event) {
    // This means the canvas is being used by the PDF epaper so no need to react to these events.
    if (this.shadowRoot.host.style.display === 'none') return;

    this._socket.sendClick(
      this.documentId,
      parseFloat((a_event.offsetX * this.__scalePxToServer).toFixed(2)),
      parseFloat((a_event.offsetY * this.__scalePxToServer).toFixed(2)),
      this._widget?._textArea?.value
    );

    if ( this.__edition && this._widget ) {
      this._widget.grabFocus();
    }
  }

  /**
   * @brief Creates the handler that listens to mouse movements
   */
  _moveHandler (a_event) {
    if ( this._widget && this._widget.overlayVisible ) { // TODO make sure this is still needed, or not
      return;
    }

    if ( isNaN(this.__scalePxToServer)) {
      return;
    }

    if ( this._servertip ) {
      this._servertip.onMouseMove(a_event.offsetX, a_event.offsetY, this.__scalePxToServer);
    }

    if ( this.__edition ) {
      this._updateContextMenu(a_event.offsetY * this.__ratio);
    }
  }

  _updateAssetsUrlFromSession () {
    try {
      this._uploaded_assets_url = app.session_data.app.config.public_assets_url;
    } catch (e) {
      this._uploaded_assets_url = '';
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                         ~~~ Epaper 2 widget management ~~~                            //
  //                                                                                       //
  //***************************************************************************************//

  _adjustBinding (binding) {
    const ratio = this.__ratio;
    binding.ratio = ratio;
    binding.x = binding.x / ratio; 
    binding.y = binding.y / ratio; 
    binding.w = binding.w / ratio;
    binding.h = binding.h / ratio; 
    
    // TODO review with multipage
    if ( 0 !== this._canvas.getBoundingClientRect().left ) {
      binding.x += this._canvas.getBoundingClientRect().left - this.parentElement.getBoundingClientRect().left;
    }
    if ( 0 !== this._canvas.getBoundingClientRect().top ) {
      binding.y += this._canvas.getBoundingClientRect().top - this.parentElement.getBoundingClientRect().top;
    }
  }

  async _attachEditorWidget (binding) {
    if ( this._widget ) {
      this._widget.detach();
      this._widget.setVisible(false);
    }


    const tag    = binding?.binding?.widget?.tag || 'casper-epaper-text-widget';
    this._widget = this._widgetCache.get(tag);
    if ( ! this._widget ) {
      try {
        await import(`./${tag}.js`); // TODO app hash for correct resolve
        this._widget = document.createElement(tag);
        this.shadowRoot.appendChild(this._widget);
        this._widgetCache.set(tag, this._widget);
        this._widget.epaper = this;
      } catch (error) {
        alert(error);
        this._widget = undefined; // TODO some sort of error widget
      }
    }
    this._adjustBinding(binding);

    // TODO only call attach
    this._widget.attach(binding);
    this._widget.setVisible(true);
    this._widget.grabFocus();
    this._widget.requestUpdate();
  }
}

customElements.define('casper-epaper-server-document', CasperEpaperServerDocument);

