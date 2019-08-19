import '../casper-epaper-input.js';
import '../casper-epaper-tooltip.js';
import '../casper-epaper-servertip-helper.js';
import '@polymer/iron-icon/iron-icon.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import { afterNextRender } from '@polymer/polymer/lib/utils/render-status.js';

export class CasperEpaperDocument extends PolymerElement {

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

  static get is () {
    return 'casper-epaper-document';
  }

  static get template () {
    return html`
      <canvas id="canvas" width="[[width]]" height="[[height]]"></canvas>
      <casper-epaper-input id="input"></casper-epaper-input>
      <casper-epaper-tooltip id="tooltip"></casper-epaper-tooltip>
      <casper-epaper-servertip-helper id="servertip"></casper-epaper-servertip-helper>
      <iron-icon id="line_add_button" on-tap="_addDocumentLine" icon="casper-icons:add-circle"></iron-icon>
      <iron-icon id="line_del_button" on-tap="_removeDocumentLine" icon="casper-icons:remove-circle"></iron-icon>
    `;
  }

  static get properties () {
    return {
      socket: Object,
      zoom: {
        type: Number,
        observer: '__zoomChanged'
      },
      currentPage: {
        type: Number,
        observer: '__currentPageChanged',
        notify: true
      },
      totalPageCount: {
        type: Number,
        notify: true
      }
    };
  }

  ready () {
    super.ready();

    this._canvas            = this.$.canvas;
    this._canvas_width      = this._canvas.width;
    this._canvas_height     = this._canvas.height;
    this._scrollContainer   = document.getElementById(this.scroller);
    this._ctx               = this._canvas.getContext('2d', {alpha: false});
    this._initial_pointer   = this._canvas.style.cursor;
    this._ctx.globalCompositeOperation = 'copy';
    this._message           = '';
    this._r_idx             = 0.0;
    this._bands             = undefined;
    this._documentId        = undefined;
    this._images            = {};
    this._focused_band_id   = undefined;
    this._redraw_timer_key  = '_epaper_redraw_timer_key';
    this._uploaded_assets_url = '';
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
    this.$.input.epaper           = this;
    this.$.servertip.epaper       = this;
    this.$.servertip.input        = this.$.input;
    this.$.tooltip.positionTarget = this.$.input;
    this.$.tooltip.fitInto        = this.$.canvas;

    this._setupPixelRatio();

    this._edition = false;

    this._canvas.contentEditable = false;

    this._background_color  = '#FFFFFF';
    this._normal_background = '#FFFFFF';
    if ( this._master_doc_right_margin !== undefined ) {
      this._right_margin = this._master_doc_right_margin;
    }

    // ... clear the page before we start ...
    this.__zoomChanged(this.zoom, true);
    this._setupScale();

    // ... FOUT Mitigation @TODO proper FOUT mitigation ...
    let styles    = ['', 'bold ', 'italic ', 'italic bold '];
    let y = 175;
    this._ctx.save();
    this._ctx.fillStyle = "#F0F0F0"
    this._ctx.textAlign="center";
    this._font_spec[CasperEpaperDocument.SIZE_INDEX] = 20;
    for ( let i = 0; i < styles.length; i++ ) {
      this._font_spec[CasperEpaperDocument.BOLD_INDEX] = styles[i];
      this._ctx.font = this._font_spec.join('');
      this._ctx.fillText("Powered by CASPER ePaper", this._canvas.width / 2, y);
      y += 35;
    }
    this._ctx.restore();

    this.$.canvas.addEventListener('mousemove', e => this._moveHandler(e));
    this.$.canvas.addEventListener('mousedown', e => this._mouseDownHandler(e));
    this.$.canvas.addEventListener('mouseup'  , e => this._mouseUpHandler(e));

    afterNextRender(this, () => {
      this.socket.addEventListener('casper-signed-in', e => this.reOpen(e));
    });
  }

  connectedCallback () {
    super.connectedCallback();
    this._deactivateLineContextMenu();
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
    this.currentPage = 1; // # TODO goto page on open /
    this._prepareOpenCommand(documentModel);
    return this._openChapter();
  }

  /**
   * Re-opens the last document that was open
   */
  async reOpen () {
    if ( this._document !== undefined ) {
      const cloned_command = JSON.parse(JSON.stringify(this._document));
      this._clear();
      await this.open(cloned_command);
    } else {
      this._clear();
    }
    return true;
  }

  openAndGotoParamOrField (documentModel, chapterReport, fieldName, rowIndex) {
    this._prepareOpenCommand(documentModel);
    this._chapterIndex = undefined;
    this.gotoParamOrField(chapterReport, fieldName, rowIndex);
  }

  gotoParamOrField () {
    let chapterIndex = undefined;
    const highlightAfterLoad = () => {
      const command = !rowIndex
        ? `document highlight parameter "${fieldName}";`
        : `document highlight field "${fieldName}",${rowIndex};`;

      this._sendCommand(command);
    };

    if ( this._jrxml !== undefined ) {
      let reportName = this._jrxml;
      let j;

      j = reportName.lastIndexOf('/');
      reportName = reportName.substring(j === -1 ? 0 : j +1, reportName.length);
      if ( reportName === chapterReport ) {
        chapterIndex = this._chapterIndex;
      }
    }

    if ( this.chapterIndex === undefined ) {
      if ( this._document && this._document.chapters ) {
        for ( let i = 0; i < this._document.chapters.length; i++ ) {
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
        this._openChapter(1, highlightAfterLoad);

      } else {
        highlightAfterLoad();
      }
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                      ~~~ Constructor and intialization ~~~                            //
  //                                                                                       //
  //***************************************************************************************//

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
      if ( this._documentId !== undefined && this._documentScale !== this._sx ) {
        this.socket.setScale(this._documentId, 1.0 * this._sx.toFixed(2));
        this._documentScale = this._sx;
      }
    }
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
    this._locale       = undefined;
    this._edit         = false;
    this._loading      = false;
    this._openFocus    = undefined;
    this._nextPage     = undefined;
  }

  /**
   * @brief Determine the device pixel ratio: 1 on classical displays 2 on retina/UHD displays
   */
  _setupPixelRatio () {
    let devicePixelRatio  = window.devicePixelRatio || 1;
    if (devicePixelRatio > 1.6) {
      devicePixelRatio = 2;
    } else {
      devicePixelRatio = 1;
    }
    let backingStoreRatio = this._ctx.webkitBackingStorePixelRatio ||
                            this._ctx.mozBackingStorePixelRatio ||
                            this._ctx.msBackingStorePixelRatio ||
                            this._ctx.oBackingStorePixelRatio ||
                            this._ctx.backingStorePixelRatio || 1;
    this._ratio = devicePixelRatio / backingStoreRatio;
  }

  //***************************************************************************************//
  //                                                                                       //
  //                             ~~~ Private methods ~~~                                   //
  //                                                                                       //
  //***************************************************************************************//

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

  /**
   * Sanitizes the document object model, auto selects the first chapter
   *
   * @param {Object} documentModel the document model
   */
  _prepareOpenCommand (documentModel) {
    this._document       = JSON.parse(JSON.stringify(documentModel));
    this._chapterCount   = this._document.chapters.length;
    this.totalPageCount = 0;
    for ( let idx = 0; idx < this._chapterCount; idx++ ) {
      this._document.chapters[idx].locale    = this._document.chapters[idx].locale    || 'pt_PT';
      this._document.chapters[idx].editable  = this._document.chapters[idx].editable  || false;
      this._document.chapters[idx].pageCount = this._document.pageCount               || 1;
      this.totalPageCount += this._document.chapters[idx].pageCount;
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
  async _openChapter (pageNumber, postOpenFunction) {
    this._inputBoxDrawString = undefined;
    this.$.servertip.enabled = false;
    this.$.input.setVisible(false);
    this._hideWidgets(true);
    this._resetScroll();
    this._nextPage  = pageNumber || 1;
    this._openFocus = this._nextPage > 0 ? 'start' : 'end';
    this._loading = true;

    //try {
    let response;

    if ( ! (this._jrxml === this._chapter.jrxml && this._locale === this._chapter.locale) ) {
      this.socket._showOverlay({message: 'A carregar modelo do documento', icon: 'connecting', spinner: true, loading_icon: 'loading-icon-03'});
      response = await this.socket.openDocument(this._chapter);
      if ( response.errors !== undefined ) {
        this._clear();
        throw new Error(response.errors);
      }
      this._documentId  = response.id;
      this.socket.registerDocumentHandler(this._documentId, (message) => this.documentHandler(message));
      this._page_width  = response.page.width;
      this._page_height = response.page.height;
      if ( isNaN(this._page_height) ) {
        this._page_height = 4000;
      }
      this._right_margin = response.page.margins.right;
      this._jrxml        = this._chapter.jrxml;
      this._locale       = this._chapter.locale;
    }
    this._chapter.id = this._documentId;

    this.socket._showOverlay({message: 'A carregar dados do documento', icon: 'connecting', spinner: true, loading_icon: 'loading-icon-03'});
    response = await this.socket.loadDocument({
      id:          this._documentId,
      editable:    this._chapter.editable,
      path:        this._chapter.path,
      scale:       this._sx,
      focus:       this._openFocus,
      page:        this._nextPage
    });
    if ( response.errors !== undefined ) {
      this._clear();
      throw new Error(response.errors);
    }
    this._path    = this._chapter.path;
    this._params  = this._chapter.params;
    this._edition = this._chapter.editable;
    this._documentScale   = this._sx;
    this._scalePxToServer = this._page_width * this._ratio / this._canvas.width;
    this.__zoomChanged(this.zoom, true);
    this._repaintPage();
    this._loading = false;
    this.$.servertip.enabled = true;
    this.socket._dismissOverlay();
    return true;
  }

  /**
   * Hides all canvas overlays
   */
  _hideWidgets (hideInputButtons) {
    this._deactivateLineContextMenu();
    this.$.input.hideOverlays(hideInputButtons);
  }

  /**
   * Set the zoom factor (document pt to screen px ratio)
   *
   * @param {number}  zoom factor must be a number
   * @param {boolean} forced truish to force the zoom update
   */
  __zoomChanged (zoom, forced) {
    let w; // Canvas width in px
    let h; // Canvas height in px

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
  async __currentPageChanged (pageNumber) {

    if ( this._document && this._document.chapters && this._document.chapters.length >= 1 ) {
      let currentPage = 1;

      pageNumber = parseInt(pageNumber);
      for ( let i = 0;  i < this._document.chapters.length; i++ ) {
        if ( pageNumber >= currentPage && pageNumber < (currentPage + this._document.chapters[i].pageCount) ) {
          let newPageNumber;

          newPageNumber = 1 + pageNumber - currentPage;
          if ( i === this._chapterIndex ) {
            if ( this._chapterPageNumber !== newPageNumber ) {
              this._resetScroll();
              await this.socket.gotoPage(this._documentId, newPageNumber);
              return pageNumber;
            }
          } else {
            this.gotoChapter(i, newPageNumber);
            return pageNumber;
          }
          this._chapterPageNumber = newPageNumber;
        }
        currentPage += this._document.chapters[i].pageCount;
      }
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                           ~~~ Context menu handling ~~~                               //
  //                                                                                       //
  //***************************************************************************************//
  
  _removeDocumentLine (a_src_widget) {
    if ( this._context_menu_idx !== - 1) {
      this._socket.deleteBand(this._documentId,
                              this._bands[this._context_menu_idx]._type,
                              this._bands[this._context_menu_idx]._id,
                              this._removeDocumentLineResponse.bind(this));
    }
  }

  _removeDocumentLineResponse (x) {
    if ( x.errors ) {
      // @TODO error handling and cursors
      console.log(x.errors[0].internal.why);
    }
  }

  _addDocumentLine (a_src_widget) {
    if ( this._context_menu_idx !== - 1) {
      this._socket.addBand(this._documentId,
                           this._bands[this._context_menu_idx]._type,
                           this._bands[this._context_menu_idx]._id,
                           this._addDocumentLineResponse.bind(this));
    }
  }

  _addDocumentLineResponse (x) {
    if ( x.errors ) {
      // @TODO error handling and cursors
      console.log(x.errors[0].internal.why);
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

  _update_context_menu (a_y) {

    if ( this._edition === false ) {
      this._deactivateLineContextMenu();
      return;
    } else {
      let idx = this._binaryFindBandByY(a_y);

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
    let button_y = a_band._ty + a_band._height / 2 - (CasperEpaper.BTN_SIZE * this._ratio) / 2;
    let button_x = (this._page_width - this._right_margin) * this._sx;

    this.$.line_add_button.style.left = (button_x / this._ratio ) + 'px';
    this.$.line_add_button.style.top  = (button_y / this._ratio ) + 'px';
    button_x += CasperEpaper.BTN_SIZE * this._ratio * 0.9;
    this.$.line_del_button.style.left = (button_x / this._ratio ) + 'px';
    this.$.line_del_button.style.top  = (button_y / this._ratio ) + 'px';

    if ( this._edition /*&& this.is_focused()*/ ) {
      this.$.line_add_button.style.display = 'inline-block';
      this.$.line_del_button.style.display = 'inline-block';
    }
  }

  /**
   * Given the chapter page number calculate the document page number and fire update event
   *
   * @param {number} pageNumber
   */
  _updatePageNumber (pageNumber) {

    if ( this._document && this._document.chapters ) {
      let page = pageNumber;

      for ( let idx = 0; idx < (this._chapterIndex || 0); idx++ ) {
        page += ( this._document.chapters[idx].pageCount || 1);
      }
      if ( this._loading === false ) {
        this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_NUMBER,' + page + ';' });
      }
      this._pageNumber = page;
    }
  }

  _deactivateLineContextMenu () {
    this.$.line_add_button.style.display = 'none';
    this.$.line_del_button.style.display = 'none';
  }

  /**
   * Update total page count when a chaper page count is updated
   *
   * @param {number} chapterIndex the index of the chapter that changed
   * @param {number} pageCount the updated page counts
   */
  _updatePageCount (chapterIndex, pageCount) {
    let previousTotalPages = this.totalPageCount;

    if ( this._document && this._document.chapters && chapterIndex >= 0 && chapterIndex < this._document.chapters.length) {
      this.totalPageCount -= ( this._document.chapters[chapterIndex].pageCount || 1);
      this._document.chapters[chapterIndex].pageCount  = pageCount;
      this.totalPageCount += pageCount;
      if ( this.totalPageCount !== previousTotalPages && this._loading === false ) {
        this._fireEvent('casper-epaper-notification', { message: 'update:variable,PAGE_COUNT,' + this.totalPageCount + ';' });
      }
    }
  }

  //***************************************************************************************//
  //                                                                                       //
  //                               ~~~ Canvas Rendering  ~~~                               //
  //                                                                                       //
  //***************************************************************************************//

  _paintString (a_draw_string) {
    this._message = a_draw_string;
    this._r_idx   = 0;
    this._paintBand();
  }

  _paintGrid (a_major, a_minor) {
    let width  = this._canvas.width;
    let height = this._canvas.height;
    let x      = 0;
    let y      = 0;

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

  _adjustScroll () {
    if ( this._scrollContainer ) {
      let inputCr = this.$.input.getBoundingClientRect();
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
      case 'RS':
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
      x   = img_info._l + ( ( max_image_width - t_w ) / 2 );
      s_x = ( img.naturalWidth / 2 ) - ( t_w / 2 );
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
      y   =  img_info._t  + ( ( max_image_height - t_h ) / 2 );
      s_y = ( img_info/ 2 ) - ( t_h / 2 );
    } else { /* top */
      y   = img_info._t;
      s_y = 0;
    }
    this._ctx.drawImage(img, s_x, s_y, s_w, s_h, x, y, t_w, t_h);

    if ( false ) {  // Image scaling QA
      let ie = document.getElementById(img_info._id);
      ie.style.top      = (x + 150 / this._ratio) + 'px';
      ie.style.left     = (y + 150 / this._ratio) + 'px';
      ie.style.width    = t_w / this._ratio + 'px';
      ie.style.height   = t_h / this._ratio + 'px';
      ie.style.position = 'absolute';
      ie.style.display = 'inline';
    }

    if ( false ) { // Bounding boxes debug
      this._ctx.save();
      this._ctx.strokeStyle = '#FF0000';
      this._ctx.lineWidth   = 1.0;
      this._ctx.strokeRect(img_info._l, img_info._t, img_info._r - img_info._l, img_info._b - img_info._t);
      this._ctx.strokeStyle = '#00FF00';
      this._ctx.strokeRect(s_x, s_y, s_w, s_h);
      this._ctx.strokeStyle = '#0000FF';
      this._ctx.strokeRect(x, y, t_w, t_h);
      this._ctx.restore();
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
  
  /**
   * @start the redraw timer will redraw the page after a timeout
   */
  _restart_redraw_timer (a_time_in_ms) {
    let timeout = a_time_in_ms !== undefined ? a_time_in_ms : 300;

    if ( window[this._redraw_timer_key] !== undefined ) {
      window.clearTimeout(window[this._redraw_timer_key]);
      window[this._redraw_timer_key] = undefined;
    }
    window[this._redraw_timer_key] = setInterval(this._create_redraw_timer_handler(this), timeout);
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
    let s          = this._ratio;
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
          w = this._getDouble();                                          // Band ID
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
              let version = this._getDouble();
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


              let fields = [];
              w = this._getDouble();
              if ( w > 2 ) {
                let tmp = this._message.substring(this._r_idx + 1, this._r_idx + w - 1);
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

            // TODO review with multipage
            x += this.$.canvas.getBoundingClientRect().left - this.parentElement.getBoundingClientRect().left;
            y += this.$.canvas.getBoundingClientRect().top - this.parentElement.getBoundingClientRect().top;

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
              let id = this._message.substring(this._r_idx, this._r_idx + w);
              this._r_idx += w + 1;

              w = this._getDouble();
              let value = this._message.substring(this._r_idx, this._r_idx + w);
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

              let json = this._message.substring(this._r_idx, this._r_idx + w);

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

            let tmp_stroke_style = this._ctx.strokeStyle;
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
          let ox = (w / 2) * CasperEpaperDocument.KAPPA,
              oy = (h / 2) * CasperEpaperDocument.KAPPA,
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

          let img = this._images[img_info._id];
          if ( img === undefined && img_info._path.length ) {
            img = new Image();
            if ( false) {  // Image scaling QA
              document.getElementById('epaper-container').appendChild(img);
              img.style.display = 'none';
              img.id = img_info._id;
            }
            this._images[img_info._id] = img;
            img.onload = function() {
              this._restart_redraw_timer();
            }.bind(this);
            img.onerror = function() {
              this._images[img_info._id] = undefined;
            }.bind(this);
            img.src = this._uploaded_assets_url + img_info._path;
            this._images[img_info._id] = img;
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
          this._font_spec[CasperEpaperDocument.FONT_NAME_INDEX] = this._t;
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
              this._font_spec[CasperEpaperDocument.SIZE_INDEX]   = Math.round(this._getDouble());
              this._font_spec[CasperEpaperDocument.BOLD_INDEX]   = (this._font_mask & CasperEpaperDocument.BOLD_MASK)   ? 'bold '   : '';
              this._font_spec[CasperEpaperDocument.ITALIC_INDEX] = (this._font_mask & CasperEpaperDocument.ITALIC_MASK) ? 'italic ' : '';
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
            let new_page_number = this._getDouble();
            let new_page_count = this._getDouble();

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

  _onPaintMessage (a_message) {
    this._r_idx   = 2; // D:
    this._message = a_message;
    this._paintBand();
  }

  _resetScroll () {
    if ( this._scrollContainer ) {
      this._scrollContainer.scrollTop  = 0;
      this._scrollContainer.scrollLeft = 0;
    }
  }

  /**
   * Adjust the canvas dimension taking into account the pixel ratio
   *
   * Also calculates the scale the server should use
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

  /**
   * Paints blank page
   */
  _clearPage () {
    let saved_fill = this._ctx.fillStyle;

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
    let band;

    this._reset_redraw_timer();

    //console.time("repaint_page");

    // ... save context clear the complete canvas ...
    this._savePaintContext();
    this._ctx.save();
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

    // ... now that whole page was redrawn the input box  ...
    if ( this._edition && this._inputBoxDrawString !== undefined ) {
      this._paintString(this._inputBoxDrawString);
    }

    this._ctx.restore();
    this._restorePaintContext();

    //console.timeEnd("repaint_page");
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

  documentHandler (a_message) {
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
            this.nextChapter();
            return;
          }
          if ( notification.focus === 'backwards' ) {
            this.previousChapter();
            return;
          }
        }
        if ( notification.variables ) {
          if ( notification.variables.PAGE_COUNT ) {
            this._updatePageCount(this._chapterIndex, notification.variables.PAGE_COUNT);
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
        //  this._updatePageCount(this._chapterIndex, pageCount);
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
    /* empty */
  }

  _mouseUpHandler (a_event) {
    this.socket.sendClick(this._documentId,
                           parseFloat((a_event.offsetX * this._scalePxToServer).toFixed(2)),
                           parseFloat((a_event.offsetY * this._scalePxToServer).toFixed(2)));
    if ( this._edition ) {
      this.$.input.grabFocus();
    }
  }

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
}

customElements.define(CasperEpaperDocument.is, CasperEpaperDocument);