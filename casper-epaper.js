/*
  - Copyright (c) 2014-2016 Neto Ranito & Seabra LDA. All rights reserved.
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

import './casper-epaper-input.js';
import './casper-epaper-iconset.js';
import './casper-epaper-tooltip.js';
import './casper-epaper-servertip-helper.js';
import '@polymer/iron-icon/iron-icon.js';
import '@polymer/paper-input/paper-input.js';
import { EPaperSocket_Initialize } from './casper-epaper-imports.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';

EPaperSocket_Initialize(window);

class CasperEpaper extends Casper.I18n(PolymerElement) {

  /*
   * Constants
   */
  // Size is in pixels not pt
  static get _BTN_SIZE ()       { return 24; }
  static get KAPPA ()           { return .5522848; }
  static get BOLD_MASK ()       { return 0x01; }
  static get ITALIC_MASK ()     { return 0x02; }
  static get UNDERLINE_MASK ()  { return 0x04; }
  static get STRIKEOUT_MASK ()  { return 0x08; }
  static get BOLD_INDEX ()      { return 0; }
  static get ITALIC_INDEX ()    { return 1; }
  static get SIZE_INDEX ()      { return 2; }
  static get FONT_NAME_INDEX () { return 4; }

  static get template() {
    return html`
      <style>
        :host {
          display: block;
        }

        #canvas {
          outline: none;
        }

        iron-icon {
          position: absolute;
          display: inline-block;
          cursor: pointer;
          padding: 1px;
          margin: 0px;
          width: 24px;
          height: 24px;
          fill: var(--dark-primary-color);
        }

        #line_add_button:hover {
          fill: var(--primary-color);
        }

        #line_del_button:hover {
          fill: #B94F4F;
        }

      </style>
      <paper-card width="[[width]]" height="[[height]]">
        <canvas id="canvas" width="[[width]]" height="[[height]]"></canvas>
        <casper-epaper-input id="input"></casper-epaper-input>
        <casper-epaper-tooltip id="tooltip"></casper-epaper-tooltip>
        <casper-epaper-servertip-helper id="servertip"></casper-epaper-servertip-helper>
        <iron-icon id="line_add_button" on-tap="_addDocumentLine" icon="casper-icons:add-circle"></iron-icon>
        <iron-icon id="line_del_button" on-tap="_removeDocumentLine" icon="casper-icons:remove-circle"></iron-icon>
      </paper-card>
    `;
  }

  static get is () {
    return 'casper-epaper';
  }

  static get properties () {
    return {
      /** component width in px */
      width: {
        type: Number,
        value: 595
      },
      /** component height in px */
      height: {
        type: Number,
        value: 842
      },
      /** zoom factor when zoom is 1 one pt in report is one px in the screen */
      zoom: {
        type: Number,
        value: 1
      },
      /** object that specifies the document being displayed/edited */
      document: {
        type: Object,
        observer: '_document_changed'
      },
      /** websocket URL */
      url: {
        type: String,
        value: undefined
      },
      /** websocket port number, defaults to current page port */
      port: {
        type: String,
        value: undefined
      },
      /** set when the component is inside an iframe */
      iframe: {
        type: Boolean,
        value: false
      },
      /** id of the containing element that can be scrolled */
      scroller: {
        type: String,
        value: undefined
      },
      /** server session */
      session: {
        type: String,
        value: undefined
      }
    };
  }

  ready () {
    this._calculateAttributeDefaults();

    this._socket            = new EPaperSocket(this, this.url, this.port, this.uri);
    this._canvas            = this.$.canvas;
    this._canvas_width      = this._canvas.width;
    this._canvas_height     = this._canvas.height;
    this._scrollContainer   = document.getElementById(this.scroller);
    this._ctx               = this._canvas.getContext('2d', {alpha: false});
    this._initial_pointer   = this._canvas.style.cursor;
    this._ctx.globalCompositeOperation = 'copy';
    this._chapterPageCount  = 0;
    this._chapterPageNumber = 1;
    this._pageNumber        = 1;
    this._totalPageCount    = 0;
    this._message           = '';
    this._r_idx             = 0.0;
    this._bands             = undefined;
    this._document_id       = undefined;
    this._images            = {};
    this._focused_band_id   = undefined;
    this._redraw_timer_key  = '_epaper_redraw_timer_key';
    this._resetRenderState();
    this._resetCommandData();

    this._page_width  = 595.0;
    this._page_height = 842.0;
    this._grid_major  = 0.0;
    this._grid_minor  = 0.0;

    this._is_socket_open = false;

    // Variables to save the object context
    this._saved_idx         = 0.0;
    this._saved_draw_string = '';
    this._inputBoxDrawString = undefined;

    // ... connect widgets ...
    this.$.tooltip.positionTarget = this.$.input;
    this.$.tooltip.fitInto        = this.$.canvas;
    this.$.servertip.epaper       = this;
    this.$.servertip.input        = this.$.input;
    this.$.input.epaper           = this;

    this._setupPixelRatio();

    this._edition = false;

    this._canvas.contentEditable = false;

    this._background_color  = '#FFFFFF';
    this._normal_background = '#FFFFFF';
    if ( this._master_doc_right_margin !== undefined ) {
      this._right_margin = this._master_doc_right_margin;
    }


    // ... clear the page before we start ...
    this.setZoom(this.zoom, true);
    this._setupScale();

    // ... FOUT Mitigation @TODO proper FOUT mitigation ...
    var styles    = ['', 'bold ', 'italic ', 'italic bold '];
    var y = 175;
    this._ctx.save();
    this._ctx.fillStyle = "#F0F0F0"
    this._ctx.textAlign="center";
    this._font_spec[this._SIZE_INDEX] = 20;
    for ( var i = 0; i < styles.length; i++ ) {
      this._font_spec[this._BOLD_INDEX] = styles[i];
      this._ctx.font = this._font_spec.join('');
      this._ctx.fillText("Powered by CASPER ePaper", this._canvas.width / 2, y);
      y += 35;
    }
    this._ctx.restore();
  }

  attached () {
    this.listen(this.$.canvas, 'mousemove', '_moveHandler');
    this.listen(this.$.canvas, 'mousedown', '_mouseDownHandler');
    this.listen(this.$.canvas, 'mouseup'  , '_mouseUpHandler');
    this._deactivateLineContextMenu();
  }

  detached () {
    this.unlisten(this.$.canvas, 'mousemove', '_moveHandler');
    this.unlisten(this.$.canvas, 'mousedown', '_mouseDownHandler');
    this.unlisten(this.$.canvas, 'mouseup'  , '_mouseUpHandler');
  }

  isPrintableDocument () {
    return this._document_id === undefined || this._document === undefined || this._document.chapters === undefined || this._document.loading
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
  open (documentModel) {
    this._prepareOpenCommand(documentModel);
    this._openChapter();
  }

  /**
   * Open specified chapter, page can also be specified
   *
   * @param {number} chapterIndex zero page index of the chapter in the document model
   * @param {number} pageNumber page to open, 1 for 1st page
   */
  gotoChapter (chapterIndex, pageNumber) {
    if ( this._document && this._document.chapters && this._document.chapters.length >= 1 ) {
      this._chapterIndex = chapterIndex;
      this._chapter      = this._document.chapters[chapterIndex];
      this._openChapter(pageNumber);
    } else {
      // warning
    }
  }

  /**
   * Open document and highlight field or parameter on the specified chapter
   *
   * @param {object} documentModel an object that specifies the layout and data of the document
   * @param {string} chaperReport name of the chapter's JRXML report
   * @param {string} fieldName name field or parameter to highlight
   * @param {string} rowIndex undefined to highlight a parameter or the rowIndex to highligth a field
   */
  openAndGotoParamOrField (documentModel, chapterReport, fieldName, rowIndex) {
    this._prepareOpenCommand(documentModel);
    this._chapterIndex = undefined;
    this.gotoParamOrField(chapterReport, fieldName, rowIndex);
  }

  /**
   * Highlight field or parameter on the specified chapter
   *
   * @param {string} chaperReport name of the chapter's JRXML report
   * @param {string} fieldName name field or parameter to highlight
   * @param {string} rowIndex undefined to highlight a parameter or the rowIndex to highligth a field
   */
  gotoParamOrField (chapterReport, fieldName, rowIndex) {
    var chapterIndex = undefined;
    var highlight_after_load = function() {
        var cmd;

        if ( rowIndex ) {
          cmd = 'document highlight field "' + fieldName + '",'+ rowIndex + ';';
        } else {
          cmd = 'document highlight parameter "' + fieldName + '";';
        }
        this._sendCommand(cmd);
      }.bind(this);

    if ( this._jrxml !== undefined ) {
      var reportName = this._jrxml;
      var j;

      j = reportName.lastIndexOf('/');
      reportName = reportName.substring(j === -1 ? 0 : j +1, reportName.length);
      if ( reportName === chapterReport ) {
        chapterIndex = this._chapterIndex;
      }
    }

    if ( this.chapterIndex === undefined ) {
      if ( this._document && this._document.chapters ) {
        for ( var i = 0; i < this._document.chapters.length; i++ ) {
          reportName = this._document.chapters[i].jrxml;
          j = reportName.lastIndexOf('/');
          reportName = reportName.substring(j === -1 ? 0 : j +1, reportName.length);
          if ( reportName === chapterReport ) {
            chapterIndex = i;
            break;
          }
        }
      }
    }

    if ( chapterIndex !== undefined ) {
      if ( chapterIndex !== this._chapterIndex ) {
        this._chapterIndex = chapterIndex;
        this._chapter      = this._document.chapters[chapterIndex];
        this._openChapter(1, highlight_after_load);

      } else {
        highlight_after_load();
      }
    }
  }

  previousChapter () {
    if ( this._document && this._document.chapters && this._document.chapters.length >= 1 ) {
      if (this._chapterIndex >= 1 ) {
        this._chapterIndex -= 1;
        this.gotoChapter(this._chapterIndex, -1);
        return true;
      }
    }
    return false;
  }

  nextChapter () {
    if ( this._document && this._document.chapters && this._document.chapters.length >= 1 ) {
      if ( this._chapterIndex < (this._document.chapters.length - 1) ) {
        this._chapterIndex += 1;
        this.gotoChapter(this._chapterIndex, 1);
        return true;
      }
    }
    return false;
  }

  // NOTE @TODO will be delete when we move to session based man grade authentication
  jsonApiConfig (configuration) {
    this._jsonApiConfig = configuration;
  }

  /**
   * Set the zoom factor (document pt to screen px ratio)
   *
   * @param {number}  zoom factor must be a number
   * @param {boolean} forced truish to force the zoom update
   */
  setZoom (zoom, forced) {
    var w; // Canvas width in px
    var h; // Canvas height in px

    if ( this.zoom !== zoom || forced ) {
      this._hideWidgets();
      this.zoom = zoom;
      w = Math.round((this._page_width  || this.width ) * this.zoom);
      h = Math.round((this._page_height || this.height) * this.zoom);
      this._setSize(w, h);
    }
  }

  /**
   * Goto to the specified page. Requests page change or if needed loads the required chapter
   *
   * @param {number} pageNumber the page to render
   */
  gotoPage (pageNumber) {

    if ( this._document && this._document.chapters && this._document.chapters.length >= 1 ) {
      var currentPage = 1;

      pageNumber = parseInt(pageNumber);
      for ( var i = 0;  i < this._document.chapters.length; i++ ) {
        if ( pageNumber >= currentPage && pageNumber < (currentPage + this._document.chapters[i].pageCount) ) {
          var newPageNumber;

          newPageNumber = 1 + pageNumber - currentPage;
          if ( i === this._chapterIndex ) {
            if ( this._chapterPageNumber !== newPageNumber ) {
              this._resetScroll();
              this._sendCommand('document set page ' + newPageNumber + ';');
            }
          } else {
            this.gotoChapter(i, newPageNumber);
          }
          this._chapterPageNumber = newPageNumber;
        }
        currentPage += this._document.chapters[i].pageCount;
      }
    }
  }

  /**
   * @brief Retrieve the number of pages in the document
   *
   * @return page count
   */
  getPageCount () {
    return this._totalPageCount;
  }

  /**
   * Clears the page and re-starts the connection to the server
   */
  reconnect () {
    this._clear(true);
    this._socket.connect();
  }

  /**
   * Re-opens the last document that was open
   */
  reOpen () {
    if ( this._document !== undefined ) {
      var cloned_command = JSON.parse(JSON.stringify(this._document));
      this._clear();
      this.open(cloned_command);
    } else {
      this._clear();
    }
  }

  closeDocument (a_success_handler) {
    this._clear();
    this._hideWidgets(true);
    this._resetCommandData();
    this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_COUNT,1;' });
    this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_NUMBER,1;' });
    this._document = undefined;
    this._callRpc('close', 'document close "' + this._document_id + '";', function(a_epaper, a_message) {
        var expected_response = 'S:ok:close:' + a_epaper._document_id;
        if ( a_message.indexOf(expected_response) === 0 ) {
          if ( a_message.length > expected_response.length ) {
            a_epaper._document_id = a_message.substring(expected_response.length + 1).replace('\n', '');
          } else {
            a_epaper._document_id = undefined;
          }
        }
        if ( undefined !== a_success_handler ) {
          a_success_handler();
        }
      }
    );
  }

  getPrintJob (name, print) {
    console.log("***  getPrintJob ", name, print);
    name = this.i18n.apply(this, this._document.filename_template);
    title = name

    if ( this.isPrintableDocument() ) {
      return undefined;
    }

    var ja_cfg = JSON.parse(this._jsonApiConfig);
    var job = {
      tube: 'casper-print-queue',
      name: name,
      validity: 3600,
      locale: this._locale,
      continous_pages: true,
      documents: [],
      public_link: {
        path: print ? 'print' : 'download'
      }
    }
    for (var i = 0; i < this._document.chapters.length; i++) {
      var chapter = {
        name: name,
        title: title,
        jrxml: this._document.chapters[i].jrxml + '.jrxml',  // Make this optional on CPQ???
        jsonapi: {
          urn: this._document.chapters[i].path + '?include=lines', // Make this optional on CPQ???
          prefix: ja_cfg.prefix,                         // TODO SET ALL OF THese values TO NULL when session auth is in place
          user_id: ja_cfg.user_id,     // TODO SET ALL OF THese values TO NULL when session auth is in place
          company_id: ja_cfg.company_id, // TODO SET ALL OF THese values TO NULL when session auth is in place
          company_schema: ja_cfg.company_schema, // TODO SET ALL OF THese values TO NULL when session auth is in place
          sharded_schema: ja_cfg.sharded_schema, // TODO SET ALL OF THese values TO NULL when session auth is in place
          accounting_schema: ja_cfg.accounting_schema, // TODO SET ALL OF THese values TO NULL when session auth is in place
          accounting_prefix: ja_cfg.accounting_prefix // TODO SET ALL OF THese values TO NULL when session auth is in place
          // urn:  ja_cfg.prefix + this._document.chapters[i].path + '?include=lines', // Make this optional on CPQ???
          // user_id: null,
          // entity_id: null,
          // entity_schema: null,
          // sharded_schema: null,
          // subentity_schema: null,
          // subentity_prefix: null
        }
      }
      job.documents.push(chapter);
    }
    return job;
  }

  getBatchPrintJob (print, documents) {
    console.log("***  getBatchPrintJob ", print, documents);

    documents = documents || []

    first_document = documents[0]

    if (first_document !== undefined) {
      name = first_document.name || this.i18n.apply(this, first_document.filename_template)
      title = first_document.title || name
    }

    name = name || this.i18n.apply(this, this._document.filename_template);
    title = title || name

    if ( this.isPrintableDocument() ) {
      return undefined;
    }

    var ja_cfg = JSON.parse(this._jsonApiConfig);
    var job = {
      tube: 'casper-print-queue',
      name: name,
      validity: 3600,
      locale: this._locale,
      continous_pages: true,
      auto_printable: print == true,
      documents: [],
      public_link: {
        path: print ? 'print' : 'download'
      }
    }

    for (var i = 0; i < documents.length; i++) {
      _document = documents[i]
      _document_name = this.i18n.apply(this, _document.filename_template)

      for (var j = 0; j < _document.chapters.length; j++) {
        _chapter = _document.chapters[j]

        _print_document = {
          name: _document.name || _document_name || name,
          title: _document.title || _document_name || title,
          jrxml: _chapter.jrxml + '.jrxml',
          jsonapi: {
            urn: ja_cfg.prefix + _chapter.path + '?include=lines', // Make this optional on CPQ???
            user_id: ja_cfg.user_id,     // TODO SET ALL OF THese values TO NULL when session auth is in place
            company_id: ja_cfg.company_id, // TODO SET ALL OF THese values TO NULL when session auth is in place
            company_schema: ja_cfg.company_schema, // TODO SET ALL OF THese values TO NULL when session auth is in place
            sharded_schema: ja_cfg.sharded_schema, // TODO SET ALL OF THese values TO NULL when session auth is in place
            accounting_schema: ja_cfg.accounting_schema, // TODO SET ALL OF THese values TO NULL when session auth is in place
            accounting_prefix: ja_cfg.accounting_prefix // TODO SET ALL OF THese values TO NULL when session auth is in place
            // user_id: null,
            // company_id: null,
            // company_schema: null,
            // sharded_schema: null,
            // accounting_schema: null,
            // accounting_prefix: null
          }
        }

        job.documents.push(_print_document);
      }
    }

    return job;
  }

  // This more a Refresh??
  reload_document (a_success_handler) {
    this._callRpc('reload', 'document reload;', function(a_epaper, a_message) {
        if ( undefined !== a_success_handler ) {
          a_success_handler(a_message.substring('S:ok:reload:'.length));
        }
      }
    );
  }

  document_focus_row (a_index, a_success_handler) {
    this._callRpc('focused row', 'document set focused row ' + a_index + ';', function(a_epaper, a_message) {
        if ( undefined !== a_success_handler ) {
          a_success_handler(a_message.substring('S:ok:focused row:'.length));
        }
      }
    );
  }

  _document_changed (a_document) {
    if (this._socket === undefined || a_document == null) return; // MARTELADA
    console.log('And then document wos set' + document);
    this.open(a_document);
  }

  //***************************************************************************************//
  //                                                                                       //
  //                             ~~~ Private methods ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

  _validate_response (a_expected_response, a_response) {
    var expected_start;

    expected_start = 'S:ok:' + a_expected_response;
    if ( match = a_response.match(/^S:failure:.*?:(.*)/) ) {
      return new Error(JSON.parse(match[1]));
    } else if ( a_response.indexOf('S:error:') === 0 || a_response.indexOf('S:exception:') === 0 ) {
      return new Error(a_response);
    } else if (a_response.indexOf(expected_start) === 0 ) {
      return a_response.substring(expected_start.length + 1);
    }
    return undefined;
  }

  /**
   * Sanitizes the document object model, auto selects the first chapter
   *
   * @param {Object} documentModel the document model
   */
  _prepareOpenCommand (documentModel) {
    this._document       = JSON.parse(JSON.stringify(documentModel));
    this._chapterCount   = this._document.chapters.length;
    this._totalPageCount = 0;
    for ( var idx = 0; idx < this._chapterCount; idx++ ) {
      this._document.chapters[idx].locale        = this._document.chapters[idx].locale        || 'pt_PT';
      this._document.chapters[idx].edit          = this._document.chapters[idx].edit          || false;
      this._document.chapters[idx].subdocument   = this._document.chapters[idx].subdocument   || false;
      this._document.chapters[idx].pageCount     = this._document.pageCount                   || 1;
      this._totalPageCount += this._document.chapters[idx].pageCount;
    }
    this._chapterIndex = 0;
    this._chapter      = this._document.chapters[0];
    this._edition      = false;
  }

  /**
   * Opens the currently selected chapter
   *
   * @param {number} pageNumber page starts at 1
   */
  _openChapter (pageNumber, postOpenFunction) {
    // Promise to open the report layout in case it not loaded yet
    var open_document = function () {
      return new Promise(function (a_resolve, a_reject) {
        if ( this._jrxml === this._chapter.jrxml && this._locale === this._chapter.locale && this._subdocument === this._chapter.subdocument ) {
          return a_resolve(this);
        }
        this._sendCommand('document open "' + this._chapter.jrxml + '","' + this._chapter.locale + '",' + this._chapter.subdocument + ',false;', function (a_response) {
          var response = this._validate_response('open', a_response);
          if ( response instanceof Error ) {
            a_reject(response);
          } else if ( response !== undefined ) {

            this._message     = response;
            this._r_idx       = 0;
            this._document_id = this._getDouble();
            this._page_width  = this._getDouble();
            this._page_height = this._getDouble();
            if ( isNaN(this._page_height) ) {
              this._page_height = 4000;
            }
            this._right_margin = this._getDouble();
            this._jrxml        = this._chapter.jrxml;
            this._locale       = this._chapter.locale;
            this._subdocument  = this._chapter.subdocument;

            a_resolve(this);
          }
        });
      }.bind(this));
    }.bind(this);

    // Promise to configure the JSON API
    var configure_api = function () {
      return new Promise(function (a_resolve, a_reject) {
        var config_msg;

        if ( this.session ) {
          config_msg = 'document set session "' + this.session + '";';
        } else {
          config_msg = 'document config json_api "' + this._jsonApiConfig.replace(/"/g, '""') + '";';
        }
        this._sendCommand(config_msg, function (a_response) {
          var response;

          if ( this.session ) {
            response = this._validate_response('json_api', a_response);
          } else {
            response = this._validate_response('session', a_response);
          }
          if ( response instanceof Error ) {
            a_reject(response);
          } else {
            if ( a_response.startsWith('S:ok:json_api') ) {
              //this._prefix       = this._chapter.prefix;
              //this._schema       = this._chapter.schema;
              //this._table_prefix = this._chapter.table_prefix;
              a_resolve(self);
            } else if ( a_response.startsWith('S:ok:session') ) {
              a_resolve(self);
            }
          }
        });
      }.bind(this));
    }.bind(this);

    // Promise to load the document data
    var load_document = function () {
      return new Promise(function (a_resolve, a_reject) {
        var args = {
          edit:        this._chapter.edit,
          path:        this._chapter.path,
          scale:       this._sx,
          subdocument: this._subdocument,
          focus:       this._openFocus,
          page:        this._nextPage
        };
        this._sendCommand('document load "' + JSON.stringify(args).replace(/"/g,'""') + '";', function (a_response) {
          var response = this._validate_response('load', a_response);

          if ( response instanceof Error ) {
            a_reject(response);
          } else {
            if ( a_response.startsWith('S:ok:load') ) {
              this._path    = this._chapter.path;
              this._params  = this._chapter.params;
              this._edition = this._chapter.edit;
              this._documentScale   = args.scale;
              this._scalePxToServer = this._page_width * this._ratio / this._canvas.width;
              this.setZoom(this.zoom, true);
              this._repaintPage();
              this._fireEvent('casper-epaper-loaded', {
                                                        pageWidth:    this._page_width,
                                                        pageHeight:   this._page_height,
                                                        document:     this._document,
                                                        chapterIndex: this._chapterIndex,
                                                        pageNumber:   this._pageNumber,
                                                        pageCount:    this._totalPageCount
                                                      });
              this._loading = false;
              this.$.servertip.enabled = true;
              a_resolve(this);
            }
          }
        });
      }.bind(this));
    }.bind(this);

    // Optional promise to execute after the document is loaded
    if ( postOpenFunction === undefined ) {
      postOpenFunction = function(a_resolve, a_reject) {
        a_resolve(this);
      }.bind(this);
    }
    var post_open = function() {
      return new Promise(postOpenFunction);
    }.bind(this);

    this._inputBoxDrawString = undefined;
    this.$.servertip.enabled = false;
    this.$.input.setVisible(false);
    this._hideWidgets(true);
    this._resetScroll();
    this._nextPage  = pageNumber || 1;
    this._openFocus = this._nextPage > 0 ? 'start' : 'end';
    this._loading = true;

    // ... perform the command sequence ...
    open_document()
      .then(configure_api)
      .then(load_document)
      .then(post_open)
      .catch(function(a_error) {
        alert("Paper error " + a_error);
        this._clear();
      }.bind(this));
  }

  /**
   * Hides all canvas overlays
   */
  _hideWidgets (hideInputButtons) {
    this._deactivateLineContextMenu();
    this.$.input.hideOverlays(hideInputButtons);
  }

  /**
   * @brief Clear the local document model
   */
  _clear (keepLastCommand) {
    this._hideWidgets();
    this._bands = undefined;
    this._images = {};
    this._focused_band_id = undefined;
    this._resetCommandData(keepLastCommand);
    this._documentScale = undefined;
    this._clearPage();
  }

  //***************************************************************************************//
  //                                                                                       //
  //                      ~~~ Constructor and intialization ~~~                            //
  //                                                                                       //
  //***************************************************************************************//

  /**
   * @brief Assign defaults to undefined component attributes
   */
  _calculateAttributeDefaults () {
    if ( this.url === undefined ) {
      if ( window.location.protocol === 'https:' ) {
        this.url = 'wss://' + window.location.hostname;
      } else {
        this.url = 'ws://' + window.location.hostname;
      }
    }
    this.port = this.port || window.location.port;
    this.uri  = this.uri  || 'epaper';
  }

  /**
   * Change the size of the epaper canvas.
   *
   * @param {number} width canvas width in px
   * @param {number} height canvas height in px
   * @param {boolean} forced when true forces a size change
   */
  _setSize (width, height, forced) {
    if ( width !== this._canvas_width || height !== this._canvas_height || forced ) {
      if (forced) {
        this._canvas_height = 100;
        this._canvas_width = 100;
        this._setupScale();
      }

      this._canvas_width  = width;
      this._canvas_height = height;
      this._setupScale();
      if ( this._document_id !== undefined && this._documentScale !== this._sx ) {
        this._sendCommand('document set scale ' + this._sx + ' ' + this._sx + ';');
        this._documentScale = this._sx;
      }
    }
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
   * @brief Initialize the context with the same defaults used by the server
   *
   * After server and client align the render contexts the server uses diferential updates
   */
  _resetRenderState () {
    this._fill_color      = '#FFFFFF';
    this._text_color      = '#000000';
    this._font_spec       = ['', '', 10, 'px ', 'DejaVu Sans Condensed'];
    this._font_mask       = 0;
    this._ctx.strokeStyle = '#000000';
    this._ctx.lineWidth   = 1.0;
    this._ctx.font        = this._font_spec.join('');
  }

  /**
   * Initialize the  centralize here all that is needeed to init/clear the relation with server
   */
  _resetCommandData (keepLastCommand) {
    if ( ! keepLastCommand ) {
      this._chapter = undefined;
    }
    this._path         = undefined;
    this._params       = undefined;
    this._jrxml        = undefined;
    //this._prefix       = undefined;
    this._locale       = undefined;
    //this._table_prefix = undefined;
    this._edit         = false;
    this._subdocument  = false;
    this._loading      = false;
    this._openFocus    = undefined;
    this._nextPage     = undefined;
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Mouse handlers ~~~                                  //
  //                                                                                       //
  //***************************************************************************************//

  /**
   * @brief Creates the handler that listens to mouse movements
   */
  _moveHandler (a_event) {

    if ( this.$.input.overlayVisible ) {
      return;
    }

    if ( isNaN(this._scalePxToServer)) {
      return;
    }

    if ( this.$.servertip ) {
      this.$.servertip.onMouseMove(a_event.offsetX, a_event.offsetY, this._scalePxToServer);
    }
    if ( this._edition ) {
      this._update_context_menu(a_event.offsetY * this._ratio);
    }
  }

  _mouseDownHandler (a_event) {
    /* empty */
  }

  _mouseUpHandler (a_event) {
    this._sendCommand("set click " + (event.offsetX * this._scalePxToServer).toFixed(2) + ', ' + (event.offsetY * this._scalePxToServer).toFixed(2) + ';');
    if ( this._edition ) {
      this.$.input.grabFocus();
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Canvas Rendering  ~~~                               //
  //                                                                                       //
  //***************************************************************************************//

  _paintGrid (a_major, a_minor) {
    var width  = this._canvas.width;
    var height = this._canvas.height;
    var x      = 0;
    var y      = 0;

    this._ctx.beginPath();
    this._ctx.strokeStyle = "#C0C0C0";
    this._ctx.lineWidth   = 0.15;
    for ( x = 0; x < width; x += a_minor ) {
      if ( (x % a_major) != 0 ) {
        this._ctx.moveTo(x,0);
        this._ctx.lineTo(x,height);
      }
    }
    for ( y = 0; y < height; y += a_minor ) {
      if ( (y % a_major) != 0 ) {
        this._ctx.moveTo(0,y);
        this._ctx.lineTo(width, y);
      }
    }
    this._ctx.stroke();

    this._ctx.beginPath();
    this._ctx.strokeStyle = "#C0C0C0";
    this._ctx.lineWidth   = 0.5;
    for ( x = 0; x < width; x += a_minor ) {
      if ( (x % a_major) == 0 ) {
        this._ctx.moveTo(x,0);
        this._ctx.lineTo(x,height);
      }
    }
    for ( y = 0; y < height; y += a_minor ) {
      if ( (y % a_major) == 0 ) {
        this._ctx.moveTo(0,y);
        this._ctx.lineTo(width, y);
      }
    }
    this._ctx.stroke();
    this._ctx.strokeStyle = "#000000";
  }

  _getDouble() {

    var fractional    = 0.0;
    var whole         = 0.0;
    var negative      = false;
    var parsing_whole = true;
    var divider       = 1.0;
    var current_c     = "";

    if (this._message[this._r_idx] == '-') {
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

  _onPaintMessage (a_message) {
    this._r_idx   = 1;
    this._message = a_message;
    this._paintBand();
  }

  /**
   * Paints blank page
   */
  _clearPage () {
    var saved_fill = this._ctx.fillStyle;

    this._ctx.fillStyle = this._background_color;
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    if ( this._grid_major !== 0.0 ) {
      this._paintGrid(this._grid_major, this._grid_minor);
    }
    this._ctx.fillStyle = saved_fill;
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
    var band;

    this._reset_redraw_timer();

    //console.time("repaint_page");

    // ... save context clear the complete canvas ...
    this._savePaintContext();
    this._ctx.save();
    this._clearPage();

    // ... repaint the bands top to down to respect the painter's algorithm ...
    if ( this._bands !== undefined ) {
      for ( var i = 0; i < this._bands.length; i++ ) {

        band = this._bands[i];
        this._r_idx       = band._idx;
        this._message     = band._draw_string;
        this._paintBand();
      }
    }

    // ... now that whole page was redrawn the input box  ...
    if ( this._edition && this._inputBoxDrawString !== undefined ) {
      this._paintString(this._inputBoxDrawString);
    }

    this._ctx.restore();
    this._restorePaintContext();

    //console.timeEnd("repaint_page");
  }

  _savePaintContext () {
    this._saved_idx         = this._r_idx;
    this._saved_draw_string = this._message;
  }

  _restorePaintContext () {
    this._r_idx           = this._saved_idx;
    this._message         = this._saved_draw_string;
  }

  _paintString (a_draw_string) {
    this._message = a_draw_string;
    this._r_idx   = 0;
    this._paintBand();
  }

  /**
   * @brief the main drawing function paints a whole band
   *
   * The paint instructions are in the _message string, this string is walked using _r_idx index handling each
   * command until the end of the message
   */
  _paintBand () {

    var do_paint   = true;
    var option     = '';
    var option_num = 0.0;
    var x          = 0.0;
    var y          = 0.0;
    var x2         = 0.0;
    var y2         = 0.0;
    var r          = 0.0;
    var w          = 0.0;
    var h          = 0.0;
    var sx         = 0.0;
    var sy         = 0.0;
    var sh         = 0.0;
    var sw         = 0.0;
    var s          = this._ratio;
    var t1,t2,t3;

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
          w = this._getDouble();                                          // Band ID
          t2     = this._message[this._r_idx];                           // Editable - 't' or 'f'
          this._r_idx += 2;
          h = this._getDouble();                                          // Band height
          x = this._getDouble();
          y = this._getDouble();

          // ... search for a band with same id on the stored band array ...
          var band = null;
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
          band.editable_    = 't' == t2 ? true : false;
          band._height      = h;
          band._tx          = x;
          band._ty          = y;
          band._idx         = this._r_idx;
          band._draw_string = this._message;

          if ( option === 'b' ) { // ... deferred painting leave the crayons in peace ...

            do_paint = false;

          } else { // ... deferred painting leave the crayons in peace ...

            do_paint = true;
            this._ctx.clearRect(0, 0, this._page_width, h);

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

            this._ctx.beginPath();

            if ( x === x2 && this._ratio == 1 ) {

              w = Math.round(this._ctx.lineWidth) & 0x1 ? -0.5 : 0;
              this._ctx.moveTo(x  + w, y  + w);
              this._ctx.lineTo(x2 + w, y2 + w);

            } else if ( y === y2 && this._ratio == 1 ) {

              w = Math.round(this._ctx.lineWidth) & 0x1 ? -0.5 : 0;
              this._ctx.moveTo(x  + w, y  + w)
              this._ctx.lineTo(x2 + w, y2 + w);

            } else {

              this._ctx.moveTo(x , y);
              this._ctx.lineTo(x2, y2);

            }

            this._ctx.stroke();

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
                this._ctx.strokeRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble()
              }
              break;

            case 'F':
              this._r_idx++;
              this._ctx.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._ctx.fillRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble();
              }
              break;

            case 'P':
              this._r_idx++;
              this._ctx.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._ctx.beginPath();
                this._ctx.rect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
                this._ctx.fill();
                this._ctx.stroke();
              } else {
                this._getDouble(); this._getDouble(); this._getDouble(); this._getDouble();
              }
              break;

            case 'C':
              this._r_idx++;
              if ( do_paint ) {
                this._ctx.clearRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
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
            this._ctx.beginPath();
            this._ctx.moveTo( x + r, y );
            this._ctx.arcTo(  x + w , y     , x + w     , y + r     , r);
            this._ctx.arcTo(  x + w , y + h , x + w - r , y + h     , r);
            this._ctx.arcTo(  x     , y + h , x         , y + h - r , r);
            this._ctx.arcTo(  x     , y     , x + r     , y         , r);
            this._ctx.closePath();
          }
          switch(option) {
            case 'S':
              if ( do_paint ) {
                this._ctx.stroke();
              }
              break;

            case 'F':
              this._ctx.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._ctx.fill();
              }
              break;

            case 'P':
              this._ctx.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._ctx.fill();
                this._ctx.stroke();
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
          this._ctx.save();
          if ( option === 'c') {  // Configure editor

            // ... clear the sub document variables ...
            this._sub_document_uri   = undefined;
            this._sub_document_jrxml = undefined;

            var edit_mode = this._message[this._r_idx++];
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
              this.$.input.setMode(edit_mode);
              this._r_idx += 1; // 't'
              break;

            case 't':  // Text ( default )

              this.$.input.setMode(edit_mode);

              this._r_idx += 1; // 't'
              break;

            case 'd': // ... Date [,<length>,<pattern>] ...

              if ( ',' === this._message[this._r_idx] ) {
                this._r_idx++;
                w = this._getDouble();
                this.$.input.setMode(edit_mode);
                this._r_idx += w;
              } else {
                this.$.input.setMode(edit_mode);
              }
              this._r_idx++;
              break;

            case 'n':  // ... Number [,<length>,<pattern>] ...

              if ( ',' === this._message[this._r_idx] ) {
                  this._r_idx++;
                  w = this._getDouble();
                  this.$.input.setMode(edit_mode);
                  this._r_idx += w;
              } else {
                this.$.input.setMode(edit_mode);
              }
              this._r_idx++;
              break;

            case 'c':  // 'c'<version>,<empty_line><length>,<field_id>,<length>,<display_field>{,<length>,<field>}[,<length>,<list json>] Simple combo  client side
              var version = this._getDouble();
              if ( version === 2 ) {
                w  = this._getDouble();
                t2 = this._message.substring(this._r_idx, this._r_idx + w);
                this._r_idx += w + 1;
                try {
                  this.$.input.setCasperBinding(JSON.parse(t2));
                } catch (err) {
                  console.log("*** JSON error in combo box config!!1");
                }
              } else {
                // empty_line: 0 or 1
                var nullable_list = this._getDouble();
                // fields '}'
                var fields = [];
                w = this._getDouble();
                if ( w > 2 ) {
                  var tmp = this._message.substring(this._r_idx + 1, this._r_idx + w - 1);
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

                this.$.input.setMode(edit_mode);
                this.$.input.setDisplayFields(fields);
                this.$.input.setModelFromJson(t2,t3);
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
              this.$.input.setMode(edit_mode);
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
              this.$.input.setMode(edit_mode);

              this._r_idx += 1;
              break;

            case 'l':  // 'l' Combo that searches on a ledger tree

              this.$.input.setMode(edit_mode);


              var fields = [];
              w = this._getDouble();
              if ( w > 2 ) {
                var tmp = this._message.substring(this._r_idx + 1, this._r_idx + w - 1);
                fields = tmp.split(',');

                //console.log("Combo FIELDS: " + fields);
              }
              this.$.input.setDisplayFields(fields);
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
            this._inputBoxDrawString = this._message.substring(this._r_idx);

            this.$.input.alignPosition(x, y, w, h);
            this.$.input.setVisible(true);

            this._update_context_menu(y + h / 2);

            return; // The rest of the draw string is just stored it will be painted by the editor

          } else if ( option === 's' ) { // ... start editor ...

            x = this._getDouble();
            y = this._getDouble();
            h = this._getDouble();
            this._focused_band_id = this._getDouble();

            if ( '{' === this._message[this._r_idx] ) {
              this._r_idx += 1; // '{'

              w = this._getDouble();
              var id = this._message.substring(this._r_idx, this._r_idx + w);
              this._r_idx += w + 1;

              w = this._getDouble();
              var value = this._message.substring(this._r_idx, this._r_idx + w);
              this._r_idx += w + 1; // +1 -> '}'
              this.$.input.setValue(id, value);

            } else {
              w = this._getDouble();
              this.$.input.setValue(this._message.substring(this._r_idx, this._r_idx + w));
              this._r_idx += w;
            }

            // Paint the input box and align the HTML control style
            this._savePaintContext();
            this._paintString(this._inputBoxDrawString);
            this._restorePaintContext();
            this.$.input.alignStyle(x,y,h);
            this.$.input.grabFocus();
            this._r_idx += 1;
            this._adjustScroll();

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

              var json = this._message.substring(this._r_idx, this._r_idx + w);

              //this.$.input.setModelFromJson(undefined, json);
              //this.$.input.autoSizeOverlay(this.$.input.style.width);

              //console.log("JSON: " + json);

              this._r_idx += w + 1;
            } else {
              //this.$.input.setModelFromJson(undefined, '[]');
              //this.$.input.autoSizeOverlay(this.$.input.style.width);
            }

          } else if ( option === 'f' ) { // ... finish or stop the editor ...

            this.$.input.setCasperBinding(undefined);
            this._inputBoxDrawString = undefined;
            this._r_idx += 1;

            // ... clear the sub document variables ...
            this._sub_document_uri   = undefined;
            this._sub_document_jrxml = undefined;
          } else if ( option == 'b' ) {

            this._r_idx += 1;

            var tmp_stroke_style = this._ctx.strokeStyle;
            this._ctx.strokeStyle = "#FF0000";
            this._ctx.strokeRect(this._getDouble(), this._getDouble(), this._getDouble(), this._getDouble());
            this._ctx.strokeStyle = tmp_stroke_style;

          } else if ( option === 'h' ) { // ... tootip hint ...

            x  = this._getDouble() / s;
            y  = this._getDouble() / s;
            w  = this._getDouble() / s;
            h  = this._getDouble() / s;
            w  = this._getDouble();
            t1 = this._message.substring(this._r_idx, this._r_idx + w);
            this.$.input.serverTooltipUpdate(x, y, w, h, t1);
            this._r_idx += w + 1;
          }

          this._ctx.restore();
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
                this._ctx.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._ctx.fillText(this._t, x, y, option_num);
                }
                break;

              case 'S':
                if ( do_paint ) {
                  this._ctx.strokeText(this._t, x, y, option_num);
                }
                break;

              case 'P':
                this._ctx.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._ctx.fillText(this._t, x, y, option_num);
                  this._ctx.strokeText(this._t, x, y, option_num);
                }
                break;
            }

          } else {
            this._r_idx++;
            switch (option) {
              case 'F':
                this._ctx.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._ctx.fillText(this._t, x, y);
                }
                break;

              case 'S':
                if ( do_paint ) {
                  this._ctx.strokeText(this._t, x, y);
                }
                break;

              case 'P':
                this._ctx.fillStyle = this._text_color;
                if ( do_paint ) {
                  this._ctx.fillText(this._t, x, y);
                  this._ctx.strokeText(this._t, x, y);
                }
                break;
            }
          }
          this._ctx.fillStyle = this._fill_color;
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
            w = this._ratio;
          }
          this._ctx.lineWidth = w;
          break;

        /*
         * === 's' Stroke Color TODO alfa support ??
         */
        case 's':

          this._ctx.strokeStyle = "#" + this._message.substring(this._r_idx, this._r_idx + 6);
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
          var ox = (w / 2) * this._KAPPA,
              oy = (h / 2) * this._KAPPA,
              xe = x + w,
              ye = y + h,
              xm = x + w / 2,
              ym = y + h / 2;

          if ( do_paint ) {
            this._ctx.beginPath();
            this._ctx.moveTo(x, ym);
            this._ctx.bezierCurveTo(x       , ym - oy , xm - ox , y       , xm, y);
            this._ctx.bezierCurveTo(xm + ox , y       , xe      , ym - oy , xe, ym);
            this._ctx.bezierCurveTo(xe      , ym + oy , xm + ox , ye      , xm, ye);
            this._ctx.bezierCurveTo(xm - ox , ye      , x       , ym + oy , x , ym);
          }
          switch (option) {
            case 'F':
              this._ctx.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._ctx.fill();
              }
              break;

            case 'S':
              if ( do_paint ) {
                this._ctx.stroke();
              }
              break;

            case 'P':
              this._ctx.fillStyle = this._fill_color;
              if ( do_paint ) {
                this._ctx.fill();
                this._ctx.stroke();
              }
              break;
          }

          break;

        /*
         * === 'I' Image : I<url_chars_count>,<url>,<x>,<y>,<w>,<h>
         * === 'I' Image : I<url_chars_count>,<url>,<x>,<y>,<w>,<h>,<sx>,<sy>,<sw>,<sh>
         */
        case 'I':

          w = this._getDouble();
          this._t = this._message.substring(this._r_idx, this._r_idx + w);
          this._r_idx += w + 1;

          x = this._getDouble();
          y = this._getDouble();
          w = this._getDouble();
          h = this._getDouble();
          if ( this._message[this._r_idx - 1] != ';' ) {
            sx = this._getDouble();
            sy = this._getDouble();
            sw = this._getDouble();
            sh = this._getDouble();
          } else {
            sx = -1.0;
          }
          var img = this._images[this._t];
          if ( img === undefined ) {
            var self = this;
            img = new Image();
            img.onload = function() {
              self.restart_redraw_timer();
            }
            img.onerror = function() {
              self._images[this.src] = undefined;
            }
            img.src = this._t;
            this._images[this._t] = img;
          }
          if ( img.complete && typeof img.naturalWidth !== undefined && img.naturalWidth !== 0 ) {
            try {
              if ( sx !== -1.0 ) {
                this._ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
              } else {
                this._ctx.drawImage(img, x, y, w, h);
                //console.log("=== Draw image @" + x + "," + y + " " + w + "x" + h);
                //this._ctx.drawImage(this.step_down(img, w,h), x, y, w, h);
              }
            } catch (a_err) {
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
          this._font_spec[this._FONT_NAME_INDEX] = this._t;
          this._ctx.font = this._font_spec.join('');
          break;

        /*
         * === 'f'  Set font flag <size>, font mask <flag_mask>,f<size>
         *  |  'fm' Set font metrics <flag_mask>,f<size>,<fFlags>, <fTop>, <fAscent>, <fDescent>, <fBottom>, <fLeading>, <fAvgCharWidth>, <  fMaxCharWidth>, <fUnderlineThickness>, fUnderlinePosition>;
         */
        case 'f':
          if ( 'm' == this._message[this._r_idx] ) {
              this._r_idx++;
              this.$.input._f_flags               = this._getDouble();
              this.$.input._f_top                 = this._getDouble();
              this.$.input._f_ascent              = this._getDouble();
              this.$.input._f_descent             = this._getDouble();
              this.$.input._f_bottom              = this._getDouble();
              this.$.input._f_leading             = this._getDouble();
              this.$.input._f_avg_char_width      = this._getDouble();
              this.$.input._f_max_char_width      = this._getDouble();
              this.$.input._f_underline_thickness = this._getDouble();
              this.$.input._f_underline_position  = this._getDouble();
          } else {
              this._font_mask = this._getDouble();
              this._font_spec[this._SIZE_INDEX]   = Math.round(this._getDouble());
              this._font_spec[this._BOLD_INDEX]   = (this._font_mask & this._BOLD_MASK)   ? 'bold '   : '';
              this._font_spec[this._ITALIC_INDEX] = (this._font_mask & this._ITALIC_MASK) ? 'italic ' : '';
              this._ctx.font = this._font_spec.join('');
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
              this._ctx.translate(this._getDouble(), this._getDouble());
              this._ctx.rotate(this._getDouble());
              break;
            case 'c':
              this._ctx.setTransform(1, 0, 0, 1, 0, 0);
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
            var new_page_number = this._getDouble();
            var new_page_count = this._getDouble();

            if ( this._chapterPageNumber != new_page_number || this._chapterPageCount != new_page_count ) {
              //if ( this.on_page_properties_changed != undefined ) {
              //  this.on_page_properties_changed(this._page_width, this._page_height, new_page_number, new_page_count);
              //}
              this._chapterPageCount  = new_page_count;
              this._chapterPageNumber = new_page_number;
            }
          }
          break;
      }
      if ( this._message[this._r_idx - 1] != ';' ) {
        console.log("command is not terminated ...");
      }
    }
  }

  /**
   * Adjust the canvas dimension taking into account the pixel ratio
   *
   * Also calculates the scale the server should
   */
  _setupScale () {
    this._canvas.width  = this._canvas_width  * this._ratio;
    this._canvas.height = this._canvas_height * this._ratio;
    this._canvas.style.width  = this._canvas_width  + 'px';
    this._canvas.style.height = this._canvas_height + 'px';
    this._sx = parseFloat((this._canvas.width  / this._page_width).toFixed(2));
    this._scalePxToServer = this._page_width * this._ratio / this._canvas.width;
    this._clearPage();
  }

  _binaryFindBandById (a_id) {

    if ( this._bands !== undefined && this._bands.length > 0 ) {
      var mid;
      var min = 0.0;
      var max = this._bands.length - 1;

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
   * @start the redraw timer will redraw the page after a timeout
   */
  _restart_redraw_timer (a_time_in_ms) {
    var timeout = a_time_in_ms !== undefined ? a_time_in_ms : 300;

    if ( window[this._redraw_timer_key] !== undefined ) {
      window.clearTimeout(window[this._redraw_timer_key]);
      window[this._redraw_timer_key] = undefined;
    }
    window[this._redraw_timer_key] = setInterval(this._create_redraw_timer_handler(this), timeout);
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

  /**
   * @brief Create the handler for the mouse over time-out
   *
   * @param a_self The tooltip helper instance
   * @return the handler function
   */
  _create_redraw_timer_handler (a_self) {
    return function () {
      a_self._repaintPage();
    }
  }

  _resetScroll () {
    if ( this._scrollContainer ) {
      this._scrollContainer.scrollTop  = 0;
      this._scrollContainer.scrollLeft = 0;
    }
  }

  _adjustScroll () {
    if ( this._scrollContainer ) {
      var inputCr = this.$.input.getBoundingClientRect();
      var leftEdge, rightEdge, topEdge, bottomEdge;

      if ( this.iframe ) {
        leftEdge   = window.innerWidth  * 0.05;
        rightEdge  = window.innerWidth  * 0.95;
        topEdge    = window.innerHeight * 0.05;
        bottomEdge = window.innerHeight * 0.95;
      } else {
        console.log('=== TODO TODO TODO normal scrolling w/o iframe');
      }

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

  //***************************************************************************************//
  //                                                                                       //
  //                           ~~~ Context menu handling ~~~                               //
  //                                                                                       //
  //***************************************************************************************//

  _addDocumentLine (a_src_widget) {
    if ( this._context_menu_idx !== - 1) {
      this._sendCommand('document add band "' + this._bands[this._context_menu_idx]._type +
                                '" ' + this._bands[this._context_menu_idx]._id + ';',
                        function (a_msg) {
                          if ( a_msg === 'S:ok:parser' ) {
                            // Start animation
                          } else if ( a_msg.indexOf('S:ok:band add') === 0 ) {
                            // All done
                          } else {
                            // error
                            console.log('=== add_line failed: a_msg');
                          }
                        });
    }
  }

  _removeDocumentLine (a_src_widget) {
    if ( this._context_menu_idx !== - 1) {
      this._sendCommand('document remove band "' + this._bands[this._context_menu_idx]._type +
                                '" ' + this._bands[this._context_menu_idx]._id + ';',
                        function (a_msg) {
                          if ( a_msg === 'S:ok:parser' ) {
                            // Start animation
                          } else if ( a_msg.indexOf('S:ok:band remove') === 0 ) {
                            // All done
                          } else {
                            // error
                            console.log('=== remove_line failed: a_msg');
                          }
                        });
    }
  }

  _binaryFindBandByY (a_y) {

    if ( this._bands !== undefined && this._bands.length > 0 ) {
      var mid;
      var min = 0.0;
      var max = this._bands.length - 1;

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

  _update_context_menu (a_y) {

    if ( this._edition === false ) {
      this._deactivateLineContextMenu();
      return;
    } else {
      var idx = this._binaryFindBandByY(a_y);

      if ( idx != -1 ) {
        if ( this._bands[idx]._type === 'DT' && this._bands[idx].editable_ == true ) {
          if ( this._context_menu_idx == idx ) {
            return;
          }
          if ( this._context_menu_idx !== -1 ) {
            this._deactivateLineContextMenu(this._bands[this._context_menu_idx]);
            this._context_menu_idx = -1;
          }
          this._context_menu_idx = idx;
          this._activateLineContextMenu(this._bands[this._context_menu_idx]);

        } else {
          if ( this._context_menu_idx !== -1 ) {
            this._deactivateLineContextMenu(this._bands[this._context_menu_idx]);
            this._context_menu_idx = -1;
          }
        }
      } else {
        if ( this._context_menu_idx !== -1 ) {
          if ( this._bands !== undefined ) {
            this._deactivateLineContextMenu(this._bands[this._context_menu_idx]);
          }
          this._context_menu_idx = -1;
        }
      }
    }
  }

  _activateLineContextMenu (a_band) {
    var button_y = a_band._ty + a_band._height / 2 - (this._BTN_SIZE * this._ratio) / 2;
    var button_x = (this._page_width - this._right_margin) * this._sx;

    this.$.line_add_button.style.left = (button_x / this._ratio ) + 'px';
    this.$.line_add_button.style.top  = (button_y / this._ratio ) + 'px';
    button_x += this._BTN_SIZE * this._ratio * 0.9;
    this.$.line_del_button.style.left = (button_x / this._ratio ) + 'px';
    this.$.line_del_button.style.top  = (button_y / this._ratio ) + 'px';

    if ( this._edition /*&& this.is_focused()*/ ) {
      this.$.line_add_button.style.display = 'inline-block';
      this.$.line_del_button.style.display = 'inline-block';
    }
  }

  _deactivateLineContextMenu (a_band) {
    this.$.line_add_button.style.display = 'none';
    this.$.line_del_button.style.display = 'none';
  }

  //***************************************************************************************//
  //                                                                                       //
  //                                ~~~ Band tearing ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

  on_edit_subdocument (a_src_widget) {

    this.open_document(this._sub_document_jrxml,  // #TODO sub documents again
                       this._locale,
                       //this._prefix,
                       //this._schema,
                       //this._table_prefix,
                       true,
                       true,
                       function (a_epaper, a_page_width, a_page_height) {
                          a_epaper.load_document(a_epaper._sub_document_uri, undefined, true, true, function(a_epaper) {
                            console.log("=== Sub document loaded YUPPIIII!!!!");
                        });
                      });
  }

  on_close_subdocument () {
    this.closeDocument();
  }

  on_add_entity (a_src_widget) {
    console.log("*** ADD entity");
  }

  /**
   * Cover the whole canvas with a white transparent overlay
   */
  _washout_canvas () {
    var saved_fill = this._ctx.fillStyle;
    this._ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this._ctx.fillRect(0,0, this._canvas.width, this._canvas.height);
    this._ctx.fillStyle = saved_fill;
  }

  /**
   * Update total page count when a chaper page count is updated
   *
   * @param {number} chapterIndex the index of the chapter that changed
   * @param {number} pageCount the updated page counts
   */
  _updatePageCount (chapterIndex, pageCount) {
    var previousTotalPages = this._totalPageCount;

    if ( this._document && this._document.chapters && chapterIndex >= 0 && chapterIndex < this._document.chapters.length) {
      this._totalPageCount -= ( this._document.chapters[chapterIndex].pageCount || 1);
      this._document.chapters[chapterIndex].pageCount  = pageCount;
      this._totalPageCount += pageCount;
      if ( this._totalPageCount !== previousTotalPages && this._loading === false ) {
        this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_COUNT,' + this._totalPageCount + ';' });
      }
    }
  }

  /**
   * Given the chapter page number calculate the document page number and fire update event
   *
   * @param {number} pageNumber
   */
  _updatePageNumber (pageNumber) {

    if ( this._document && this._document.chapters ) {
      var page = pageNumber;

      for ( var idx = 0; idx < (this._chapterIndex || 0); idx++ ) {
        page += ( this._document.chapters[idx].pageCount || 1);
      }
      if ( this._loading === false ) {
        this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_NUMBER,' + page + ';' });
      }
      this._pageNumber = page;
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Websocket handlers ~~~                              //
  //                                                                                       //
  //***************************************************************************************//

  _sendCommand (a_message, a_callback) {
    this._request_callback = a_callback || this.default_ws_handler;
    this._socket.sendCommand(a_message, this._request_callback);
  }

  _getData (route, callback) {
    if ( this._getDataCallback === undefined ) {
      this._getDataCallback = callback;
      this._socket.sendCommand('get data "'+route+'";', this._request_callback);
    }
  }

  _callRpc (a_invoke_id, a_command, a_success_handler, a_failure_handler) {

    a_failure_handler = a_failure_handler || function (a_epaper, a_message) {
      if ( a_epaper._listener !== undefined ) {
        a_epaper._listener.on_error(a_message);
      } else {
        alert(a_message);
      }
    }

    this._sendCommand(a_command, function (a_message) {
      if ( a_message.indexOf('S:error:') === 0 || a_message.indexOf('S:exception:') === 0 ) {
        a_failure_handler(this, a_message);
        return;
      }
      if ( a_message.indexOf('S:ok:' + a_invoke_id) === 0 ) {
        a_success_handler(this, a_message);
      }

    });
  }

  disconnect () {
    this._socket.disconnect();
  }

  // default websocket handler
  default_ws_handler (a_msg) {

  }

  _onSocketMessage (a_message) {
    switch (a_message.data[0]) {
      case 'S':
        if ( a_message.data.indexOf('S:ok:data:') === 0 ) {
          if ( this._getDataCallback !== undefined ) {
            this._getDataCallback(a_message.data.substring('S:ok:data:'.length));
            this._getDataCallback = undefined;
          }
        } else {
          this._request_callback(a_message.data);
        }
        break;

      case 'N':
        var message = a_message.data.substring(2);

        if ( message.startsWith('update:focus,forward') ) {
          if ( this.nextChapter() ) {
            return;
          }
        } else if ( message.startsWith('update:focus,backward') ) {
          if ( this.previousChapter() ) {
            return;
          }
        } else if (message.startsWith('update:variable,PAGE_COUNT,')) {
          var pageCount;

          pageCount = parseInt(message.substring('update:variable,PAGE_COUNT,'.length));
          this._updatePageCount(this._chapterIndex, pageCount);
          return;

        } else if (message.startsWith('update:variable,PAGE_NUMBER,')) {
          var pageNumber;

          pageNumber = parseInt(message.substring('update:variable,PAGE_NUMBER,'.length));
          this._updatePageNumber(pageNumber);
          return;
        }
        this._fireEvent('casper-epaper-notification', { message: message });
        break;

      case 'E':

        this._r_idx   = 1;
        this._message = a_message.data;

        var w = this._getDouble();
        var k = this._message.substring(this._r_idx, this._r_idx + w);
        this._r_idx += w + 1; // +1 -> ','

            w = this._getDouble();
        var t = this._message.substring(this._r_idx, this._r_idx + w);
        this._r_idx += w + 1; // +1 -> ','

            w = this._getDouble();
        var m = this._message.substring(this._r_idx, this._r_idx + w);
        this._r_idx += w + 1; // +1 -> ','

        if ( this._message[this._r_idx - 1] != ';' ) {
          console.log("command is not terminated ...");
        }

        //if ( undefined !== this._listener && undefined !== this._listener.on_error_received ) {
        //  this._listener.on_error_received(t, m);
        //}
        var errorDetail = undefined;
        if ( m.indexOf('S:failure:load:') === 0 ) {
          error = JSON.parse(m.replace('S:failure:load:',''));
          errorDetail = error.errors.first();
        } else if ( m.indexOf('S:failure:pdf:') === 0 ) {
          error = JSON.parse(m.replace('S:failure:pdf:',''));
          errorDetail = error.errors.first();
        } else if ( m !== undefined && m.length !== 0 ) {
          errorDetail = m;
        }

        if ( errorDetail !== undefined ) {
          this._fireEvent('casper-epaper-error', errorDetail);
        }

        break;

      case 'D':
        this._onPaintMessage(a_message.data);
        break;

      default:
        // ignore
        break;
    }
  }

  _onSocketOpen (a_message) {
    this._is_socket_open = true;
    this._fireEvent('casper-socket-open', { casperEpaper: this});
  }

  _onSocketClose (a_message) {
    this._is_socket_open = false;
    this._fireEvent('casper-socket-close', { casperEpaper: this});
  }

  _isSocketOpen() {
    return this._is_socket_open;
  }

  _fireEvent (eventName, eventData) {
    if ( this.iframe ) {
      window.parent.document.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
    } else {
      this.fire(eventName, eventData);
    }
  }
}