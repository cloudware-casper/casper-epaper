/*
  - Copyright (c) 2016 Cloudware S.A. All rights reserved.
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
import { CasperEpaperDocument } from './casper-epaper-types/casper-epaper-server-document.js';
import '@polymer/iron-input/iron-input.js';
import '@polymer/iron-icon/iron-icon.js';
import '@casper2020/casper-icons/casper-icons.js';

class CasperEpaperInput extends PolymerElement {
  static get template() {
    return html`
    <style>
      :host {
        display: none;
        position: absolute;
      }

      iron-icon {
        position: absolute;
        cursor: pointer;
        padding: 1px;
        margin: 0px;
        transition: transform 300ms;
        fill: var(--dark-theme-background-color);
      }

      iron-icon[rotate] {
        transform: rotate(180deg);
      }

      iron-icon:hover {
        fill: var(--primary-color);
      }

      ::-ms-clear {
        display: none;
      }

      ::selection {
        background: #d0ecf0;
      }

      #textarea {
        border: none;
        display: block;
        position: absolute;
        padding: 0px;
        margin: 0px;
        outline: none;
        background-color: rgba(0, 0, 0, 0);
      }

      #clear_btn {
        stroke: #D0011B;
        stroke-width: 1.5;
        fill: #EE9392;
        fill-opacity: 0.55;
      }

      #clear_btn:hover {
        stroke: #555;
        stroke-width: 2.5;
        fill-opacity: 0.9;
      }

      #clear_btn:active {
        stroke: #555;
        stroke-width: 2.5;
        fill: #B94F4F;
        fill-opacity: 1;
      }

      #edit_btn {
        fill: var(--dark-primary-color);
      }

      #edit_btn:hover {
        fill: var(--primary-color);
      }

/*    #input {
        -ms-overflow-style: -ms-autohiding-scrollbar;
      }

      #textarea {
        resize: none;
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        overflow: auto;
      }*/

    </style>
    <!--div id="input"-->
    <input is="iron-input" id="textarea" tabindex="1">
    <!--/div-->
    <!--iron-autogrow-textarea id="input" tabindex="0"></iron-autogrow-textarea-->
    <iron-icon id="dropdown_btn" on-tap="_toggleOverlay" icon="casper-icons:arrow-drop-down" rotate\$="[[overlayVisible]]"></iron-icon>
    <iron-icon id="clear_btn" on-tap="_clearField" icon="casper-icons:clear-combo"></iron-icon>
    <iron-icon id="edit_btn" on-tap="_toggleSubEditor" icon="casper-icons:edit-doc"></iron-icon>
    <casper-epaper-datepicker id="date"></casper-epaper-datepicker>
    <casper-select id="select" disable-smart-filter="" search-combo="" items="[[test]]"></casper-select>
`;
  }

  static get is () {
    return 'casper-epaper-input';
  }

  static get properties () {
    return {
      /** True when there is an open overlay */
      overlayVisible: {
        type: Boolean,
        value: false
      },
      /** Parent casper-epaper element that owns this helper */
      epaper: {
        type: Object
      }
    };
  }

  ready () {
    super.ready();

    this.test = [];

    //this._input          = this.$.input;
    this._binding        = undefined;
    this._textArea       = this.$.textarea;//this.$.input.$.textarea;
    //this.$.date.inputBox = this.$.textarea;//this.$.input.$.textarea;
    this._visible        = true;
    this.setVisible(false);
    this._select = this.$.select;
    // TODO this.$.combo.setPositionTarget(this);

    this.addEventListener('keypress' , e => this._onKeypress(e));
    this.addEventListener('keydown'  , e => this._onKeyDown(e));
    //this.addEventListener('mousedown', e => this._onMouseDown(e));
    //this.addEventListener('mouseup'  , e => this._onMouseUp(e));
    this.addEventListener('tap'      , e => this._onTap(e));
  }

  connectedCallback () {
    super.connectedCallback();
    this._initialSelection = false;
    this._mode             = 'n';
    this._comboFilter      = '';
    this.overlayVisible    = false;
    this._overlay          = undefined;
    this._comboListQuery   = undefined;
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    this._clearModel();
  }

  /**
   * Show or hide the input control
   *
   * @param {boolean} visible
   */
  setVisible (visible) {
    if ( this._visible !== visible ) {
      if ( visible ) {
        this.style.display = 'inline-block';
      } else {
        this.style.display                = 'none';
        this.$.dropdown_btn.style.display = 'none';
        this.$.edit_btn.style.display     = 'none';
      }
      this._visible = visible;
    }
  }

  /**
   * Position and size the input overlay on top the editable element
   *
   * @param {number} x Upper left corner (x)
   * @param {number} y Upper left corner (y)
   * @param {number} w box width in px
   * @param {number} h box height in px
   */
  alignPosition (x, y, w, h) {
    this.style.left           = x + 'px';
    this.style.top            = y + 'px';
    this.style.width          = w + 'px';
    this.style.height         = h + 'px';
    /*_input*/this._textArea.style.left    = '0px';
    /*_input*/this._textArea.style.top     = '0px';
    /*_input*/this._textArea.style.width   = w + 'px';
    /*_input*/this._textArea.style.height  = h + 'px';
    /*_input*/this._textArea.scrollTop     = 0;
    /*_input*/this._textArea.scrollLeft    = 0;
    this._x                   = x;
    this._y                   = y;
  }

  /**
   * Align the HTML input text size baseline and left edge with the text drawn in the canvas, also sets color
   *
   * @param {number} a_text_left   Starting point of left aligned text # TODO paddding
   * @param {number} a_baseline    Vertical baseline of the first text line # TODO remove??? or do PADDING?
   */
  alignStyle (a_text_left, a_baseline) {

    // Make baseline and edge relative to input pox
    var ratio = this.epaperDocument.epaperCanvas.ratio;
    var tl    = a_text_left / ratio - this._x;
    var bl    = a_baseline  / ratio - this._y;
      var top   = this._f_top / ratio;

    /*console.log(' ==> tl=' + tl + ' bl=' + bl + ' top=' + top);*/

    //this._textArea.style.padding     = '0px';
    //this._textArea.style.margin      = '0px';
    this._textArea.style.marginLeft  = Math.max(tl,1) + 'px';
    this._textArea.style.marginRight = Math.max(tl,1) + 'px';
    //this._textArea.style.marginTop   = Math.max(bl + top, 1) + 'px';
    this._textArea.style.fontFamily  = this.epaperDocument.fontSpec[CasperEpaperDocument.FONT_NAME_INDEX];
    this._textArea.style.fontSize    = this.epaperDocument.fontSpec[CasperEpaperDocument.SIZE_INDEX] / ratio + 'px';
    this._textArea.style.color       = this.epaper._text_color;
  }

  hideOverlays (hideButtons) {
    this.hideTooltip();
    // TODO this.$.combo.setVisible(false);
    //this.$.date.setVisible(false);
    if ( hideButtons ) {
      this.$.dropdown_btn.style.display = 'none';
      this.$.edit_btn.style.display = 'none';
      this.$.clear_btn.style.display = 'nome';
    }
  }

  setCasperBinding (binding) {
    console.log(binding);
    this._binding = binding;
    if ( binding !== undefined ) {
      switch(binding.attachment.type) {
        case 'dropDownList':
        case 'dropDownTree':
          this.setMode('c');
          break;
        case 'checkbox':
        case 'radioButton':
          this.setMode('R');
          break;
        default:
          this.setMode('n');
          break;
      }
      // TODO this.$.combo.setCasperBinding(binding);
      this.setCombolistQuery(binding.attachment.route);
      if ( binding.hint && binding.hint.expression && binding.hint.expression.length ) {
        this.showTooltip(binding.hint.expression);
      } else {
        this.hideTooltip();
      }
    } else {
      // TODO this.$.combo.setCasperBinding(undefined);
      this.setCombolistQuery(undefined);
    }
  }

  /**
   * Configure the editor mode
   *
   * @param a_mode The editor mode
   */
  setMode (a_mode) {
    var top, left, width, height, btn_size, edit_btn_size;

    this.hideOverlays();
    this._comboFilter = '';
    this._mode        = a_mode;
    switch ( a_mode ) {
    case 'c': // Client combo
      this._textArea.style.cursor = 'pointer';
      // TODO this._setOverlay(this.$.combo);
      break;
    case 'l': // Ledger mode
      this._textArea.style.cursor = 'text';
      // TODO this._setOverlay(this.$.combo);
      break;
    case 'd': // Date
      this._textArea.style.cursor = 'text';
      //this._setOverlay(this.$.date);
      break;
    case 'R': // Radio
      this._textArea.style.cursor = 'pointer';
      this._setOverlay(undefined);
      break;
    default: // Normal mode the default
      this._textArea.style.cursor = 'text';
      this._mode = 'n'
      this._setOverlay(undefined);
      break;
    }

    btn_size = Math.floor(12 * this.epaperDocument.zoom);
    width    = parseInt(this.style.width);
    height   = parseInt(this.style.height);

    this.$.dropdown_btn.style.display = 'none';
    this.$.dropdown_btn.style.padding = '0px';
    this.$.dropdown_btn.style.height  = btn_size + 'px';
    this.$.dropdown_btn.style.width   = btn_size + 'px';
    this.$.dropdown_btn.style.top     = ((height - btn_size) / 2) + 'px';
    this.$.dropdown_btn.style.left    = (width - btn_size) + 'px';

    this.$.clear_btn.style.display = 'none';
    this.$.clear_btn.style.padding = '0px';
    this.$.clear_btn.style.height  = btn_size + 'px';
    this.$.clear_btn.style.width   = btn_size + 'px';
    this.$.clear_btn.style.top     = ((height - btn_size) / 2) + 'px';
    this.$.clear_btn.style.left    = (width - btn_size) + 'px';

    edit_btn_size = Math.floor(18 * this.epaperDocument.zoom);
    this.$.edit_btn.style.display = 'none'; // 'inline';
    this.$.edit_btn.style.padding = '0px';
    this.$.edit_btn.style.height  = edit_btn_size + 'px';
    this.$.edit_btn.style.width   = edit_btn_size + 'px';
    this.$.edit_btn.style.top     = ((height - edit_btn_size) / 2) + 'px';
    this.$.edit_btn.style.left    = (-edit_btn_size) + 'px';

    switch ( this._mode ) {
    case 'c': // Client combo
    case 'l': // Ledger mode
      this.$.dropdown_btn.icon = 'casper-icons:arrow-drop-down';
      //this.$.dropdown_btn.style.display = 'none';
      this._textArea.style.width = (width - btn_size) + 'px';
      break;
    case 'd': // Date
      this.$.dropdown_btn.icon = 'casper-icons:date-range'
      this.$.dropdown_btn.style.display = 'inline';
      this._textArea.style.width = (width - btn_size) + 'px';
      break;
    case 'R': // Radio
    default:  // Normal mode the default
      this.$.dropdown_btn.style.display = 'none';
      this.$.edit_btn.style.display = 'none';
      this._textArea.style.width = (width) + 'px';
      break;
    }
  }

  /**
   * Sets the name of the data model field that contains the item description
   *
   * @param a_display_fields array of fields names
   */
  setDisplayFields (a_fields) {
    // TODO this.$.combo.setDisplayFields(a_fields);
  }

  /**
   * Sets the basic the combo item list
   *
   * Each model is associated with an id, models are kept in a model cache. To set a model the
   * server specified the id and json model, to reuse a cached model just sends the id.
   *
   * @param combo_id Unique identifier of the combo list in the document (no caching if it's undefined)
   * @param json json string with the data model to associate with the combo it. If this parameter is
   *               undefined the model is retrieved from the _modelCache
   */
  setModelFromJson (combo_id, json) {
    this._comboListQuery = undefined;
    console.log(`setModelFromJson = ${combo_id} json`, json);
    // TODO this.$.combo.$.spinner.active = false;
    // TODO this.$.combo.showFab = false;
    // TODO return this.$.combo.setModelFromJson(combo_id, json);
  }

  setCombolistQuery (query) {
    this._comboListQuery = query;
    this._textArea.value = '';
    this._textArea.selectionStart = undefined;
    this._textArea.selectionEnd = undefined;

    this._select.items = ['123', '12334', 'abc'];

    console.log(`setCombolistQuery = ${query}`);
    // TODO this.$.combo.clearModel();
    // TODO this.$.combo.$.spinner.active = true;
  }

  onGetDataResponse (jsonapi) {
    // TODO this.$.combo.$.spinner.active = false;
    // TODO this.$.combo.setModelFromJsonApi(jsonapi);
    this._layoutComboList();
    // TODO this.$.combo.$.dialog.fire('iron-overlay-opened');
  }

  _setOverlay (overlay) {
    if ( this._overlay !== undefined ) {
      this._overlay.setVisible(false);
    }
    this._overlay = overlay;
    this.overlayVisible = false;
  }

  _toggleOverlay (event) {
    if ( this._select.opened ) {
      this._select.opened = false;
    } else {
      this._select.attachTo(this._textArea);
      this._select.opened = true;
    }
    //if ( this._overlay !== undefined ) {
    //  if ( this.overlayVisible ) {
    //    this._overlay.setVisible(false);
    //  } else {
    //    if ( this._overlay === this.$.combo ) {
    //      this._layoutComboList();
    //    }
    //    this.hideTooltip();
    //    this._overlay.setVisible(true, this._comboFilter);
    //    if ( this._comboListQuery !== undefined && this._overlay === this.$.combo ) {
    //      this.epaper._getData(this._comboListQuery, function(response) {
    //        this.onGetDataResponse(response);
    //      }.bind(this));
    //      //this.epaperDocument.__sendCommand('get data "'+this._comboListQuery+'";');
    //    }
    //  }
    //  this.overlayVisible = this._overlay.isVisible();
    //}
    if ( event !== undefined ) {
      event.stopPropagation();
    }
  }

  /**
   * Event handler that clears the combo list item
   *
   * @param {Object} event the click event
   */
  _clearField (event) {
    this.epaperDocument.__sendCommand('set list item "";');
    this.epaperDocument.__sendCommand('set key "save";');
    if ( event !== undefined ) {
      event.stopPropagation();
    }
  }

  /**
   * Show the combo box list
   */
  _layoutComboList () {
    var sc = this.epaperDocument.epaperCanvas.ratio;
    var page_margin = 40 * this.epaperDocument.epaperCanvas.ratio;
    var max_width, max_height;

    var left  = parseInt(this.style.left);
    var width = parseInt(this.style.width);

    if ( (left / this.epaperDocument.epaperCanvas.sx) > this.epaperDocument.epaperCanvas.pageWidth / 2 ) {
      max_width = left + width /*+ this._open_combo_button._bb_w*/ - page_margin;
    } else {
      max_width = this.epaperDocument.epaperCanvas.pageWidth * this.epaperDocument.epaperCanvas.sx - page_margin - left;
    }

    /* TODO
    this.$.combo.autoSize(width, max_width);
    if ( ! this.$.combo.isVisible() && this._overlay === this.$.combo ) {
      this.$.combo.setVisible(true, this._comboFilter);
    } */
  }

  setValue (value, displayValue) {
    switch ( this._mode) {
      case 'c':
        this._setValueC(value, displayValue);
        break;
      case 'd':
        this._setValueD(value);
      case 'n':
      default:
        this._setValueN(value);
        break;
    }
  }

  grabFocus () {
    if ( this._initialSelection === true ) {
      if ( this._mode === 'c' ) {
        this._textArea.selectionStart = undefined;
        this._textArea.selectionEnd   = undefined;
      } else {
        this._textArea.selectionStart = 0;
        this._textArea.selectionEnd   = this._textArea.value.length;
      }
    }
    this._textArea.focus();
  }

  _onTap (event) {
    switch ( this._mode) {
      case 'c':
        this._toggleOverlay();
        event.stopPropagation();
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  _onKeypress (event) {
    switch ( this._mode) {
      case 'c':
        this._onKeypressC(event);
        break;
      case 'R':
        this._onKeypressR(event);
        break;
      //case 'l': // TODO LEDGER MODE
      //  this._onKeyDown_l(event);
      //  break;
      case 'n':
      default:
        break;
    }
  }

  _onKeyDown (event) {
    switch ( this._mode) {
      case 'c':
        this._onKeyDownC(event);
        break;
      case 'R':
        this._onKeyDownR(event);
        break;
      //case 'l': // TODO LEDGER MODE
      //  this._onKeyDown_l(event);
      //  break;
      case 'n':
      default:
        this._onKeyDownN(event);
        break;
    }
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                             ~~~ N Mode Normal Mode ~~~                                */
  /*                                                                                       */
  /*****************************************************************************************/

  _setValueN (value) {
    this._textArea.value          = value;
    this._textArea.selectionStart = 0;
    this._textArea.selectionEnd   = value.length;
    this._initialSelection        = true;
  }

  _onKeyDownN (event) {
    var vkey = this._keycodeToVkey(event);

    if ( this._initialSelection === true || this._textArea.value.length === 0 ) {
      if ( ['down', 'up', 'left', 'right'].indexOf(vkey) > -1 ) {
        this.epaperDocument.socket.moveCursor(this.epaperDocument.documentId, vkey);
        event.preventDefault();
        return;
      } else if ( ['tab', 'shift+tab'].indexOf(vkey) > -1 ) {
        if ( this._initialSelection === true ) {
          this._initialSelection = false;
          if ( vkey === 'shift+tab') {
            this.epaperDocument.socket.sendKey(this.epaperDocument.documentId, vkey, 'shift');
          } else {
            this.epaperDocument.socket.sendKey(this.epaperDocument.documentId, vkey);
          }
          event.preventDefault();
          return;
        }
      } else if ( ['enter', 'F2'].indexOf(vkey) > -1 ) {
        this._textArea.selectionStart = this._textArea.value.length;
        this._textArea.selectionEnd = this._textArea.value.length;
        if ( this._initialSelection === true || vkey === 'F2' ) {
          this._initialSelection = false;
          event.preventDefault();
          return;
        }
      } else {
        this._initialSelection = false;
      }
    }

    if ( ['enter', 'tab', 'shift+tab'].indexOf(vkey) > -1 ) {
      this.epaperDocument.socket.setText(this.epaperDocument.documentId,
                                  this._textArea.value,
                                  vkey === 'shift+tab' ? 'left' : 'right');
                                 // this._setTextResponse.bind(this)); TODO WE HAVE A PROMISE NOW
      event.preventDefault();
      return;
    }
  }

  //_setTextResponse (response) {
  //  console.log('value set on server yeeehhhhh');
  //}

  /*****************************************************************************************/
  /*                                                                                       */
  /*                             ~~~ C Mode Client Combo ~~~                               */
  /*                                                                                       */
  /*****************************************************************************************/

  _setValueC (id, displayValue) {
    /*  TODO
    this.$.combo.setVisible(false);
    if ( id !== undefined && id.length > 0 ) {
      this.$.combo.selectById(id);
    } else {
      this._textArea.value = '';
    }*/
    this.overlayVisible = false;
    this._textArea.selectionStart = undefined;
    this._textArea.selectionEnd = undefined;
    if (this._comboListQuery !== undefined && displayValue !== undefined) {
      this._textArea.value = displayValue;
    }
    // aqui
    if ( displayValue.length !== 0 && this._binding !== undefined && this._binding.attachment !== undefined &&
         this._binding.attachment.allowClear === true ) {
      this.$.clear_btn.style.display = 'inline';
    } else {
      this.$.dropdown_btn.style.display = 'inline';
    }
  }

  _onKeypressC (event) {
    /*if ( this.overlayVisible === false ) {
      if ( this._comboListQuery !== undefined && this._overlay === this.$.combo ) {
        if ( !this.$.combo.items || !!this.$.combo.items.length ) {
          this.epaperDocument.__sendCommand('get data "'+this._comboListQuery+'";');
        }
      }
      //this._toggleOverlay();
      // TODO load list adn filter in line
      //if ( this.overlayVisible === false ) {
      this._comboFilter += event.key;
      //this.$.combo.setQuery(this._comboFilter);
      event.preventDefault();
    }*/
    if ( this.overlayVisible === false ) {
      this._comboFilter += event.key;
      this._toggleOverlay(event);
    }
  }

  _onKeyDownC (event) {
    let vkey;

    vkey = this._keycodeToVkey(event);
    if ( this.overlayVisible === false ) {
      if ( ['down', 'up', 'left', 'right'].indexOf(vkey) > -1 ) {
        if ( this._comboFilter.length !== 0 && ['down', 'up'].indexOf(vkey) > -1) {
          /* TODO this.$.combo.moveSelection(vkey); */
        } else {
          this.epaperDocument.socket.moveCursor(this.epaperDocument.documentId, vkey);
        }
        event.preventDefault();
      } else if ( ['tab', 'shift+tab', 'enter'].indexOf(vkey) > -1 ) {
        /*
        TODO
        if ( this.$.combo.getSelectedId() && this.$.combo.getSelectedId() !== this.$.combo.getInitialId() ) {
        //  this.epaperDocument.__sendCommand('set list item "' + this.$.combo.getSelectedId()  + '";');
        }*/
        //this.epaperDocument.socket.setText();
        this.epaperDocument.socket.setText(this.epaperDocument.documentId, this.$.combo.getSelectedId(), 'right', true);

        //this.epaperDocument.__sendCommand('set key "'+vkey.replace(/\+/g, '"+"')+'";');
        event.preventDefault();
      } else if ( vkey === 'alt' || vkey === 'shift+down' ) {
        //this._comboFilter = event.key;
        this._toggleOverlay();
        //event.preventDefault();
      } //else if ( ['delete', 'backspace'].indexOf(vkey) > -1 ) {
        //this._comboFilter = this._comboFilter.slice(0, -1);
        //this.$.combo.setQuery(this._comboFilter, false);
        //event.preventDefault();
      //}
    } else {
      if ( vkey === 'esc' ) {
        // TODO this.$.combo.setVisible(false);
        this.overlayVisible = false;
        event.preventDefault();
      }
    }
  }

  _onComboSelectionChanged (event) {
    if ( event.detail.displayValue ) {
      this._textArea.value = event.detail.displayValue;
      if ( this._mode === 'c' && this.overlayVisible === false) {
        this._textArea.selectionStart = event.detail.matchStart;
        this._textArea.selectionEnd   = event.detail.matchEnd;
      }
    }
  }

  _onComboListClosed (event) {
    var key;

    this.overlayVisible = false;
    this._comboFilter    = '';

    key = event.detail.closingKey;
    if ( event.detail.selectedId !== undefined && event.detail.selectedId !== event.detail.previousId ) {
      this.epaperDocument.__sendCommand('set list item "' + event.detail.selectedId  + '";');
      if ( key === 'shift+tab' ) {
        this.epaperDocument.__sendCommand('set key "shift"+"tab";');
      } else if ( key === 'enter' || key === 'tab' ) {
        this.epaperDocument.__sendCommand('set key "tab";');
      } else {
        this.epaperDocument.__sendCommand('set key "save";');
      }
    } else {
      if ( key === 'shift+tab' ) {
        this.epaperDocument.__sendCommand('set key "focus_left";');
      } else if ( key === 'enter' || key === 'tab' ) {
        this.epaperDocument.__sendCommand('set key "focus_right";');
      }
    }
    this._textArea.focus();
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                                 ~~~ D Mode date ~~~                                   */
  /*                                                                                       */
  /*****************************************************************************************/

  _setValueD (date) {
    //this.$.date.setLocale('pt');     // TODO from server
    this._dateFormat = 'DD/MM/YYYY'; // TODO from server
    //this.$.date.setValue(moment(date, this._dateFormat).format('YYYY-MM-DD'));
  }

  _onDateOverlayClosed (event) {
    this.overlayVisible = false;
    var vkey = event.detail.closingKey;
    var cmd  = '';

    if ( event.detail.previousDate !== event.detail.currentDate && vkey !== 'esc' ) {
      cmd = 'set text "'+event.detail.currentDate+'" true; ';
      if ( vkey === undefined ) {
        vkey = 'save';
      }
    }
    if ( vkey !== 'esc' && vkey !== undefined ) {
      cmd += 'set key "'+vkey.replace(/\+/g, '"+"')+'";';
    }
    if ( cmd.length ) {
      this.epaperDocument.__sendCommand(cmd);
    }
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                             ~~~ R Mode Radio Button ~~~                               */
  /*                                                                                       */
  /*****************************************************************************************/

  _onKeypressR (event) {
    event.preventDefault();
  }

  _onKeyDownR (event) {
    if ( event.keyCode === 32 || (event.keyCode === 88 && this._textArea.value.length === 0) ) {
      // TODO debouncer this.debounce('casper-toggle', function () {
        this.epaperDocument.socket.sendKey(this.epaperDocument.documentId, 'toggle');
      //}.bind(this), 300);
    } else {
      var vkey = this._keycodeToVkey(event);

      if ( ['down', 'up', 'left', 'right'].indexOf(vkey) > -1 ) {
        this.epaperDocument.socket.moveCursor(this.epaperDocument.documentId, vkey);
      } else if ( vkey === 'shift+tab' ) {
        this.epaperDocument.socket.moveCursor(this.epaperDocument.documentId, 'left');
      } else if ( vkey === 'enter' || vkey === 'tab' ) {
        this.epaperDocument.socket.moveCursor(this.epaperDocument.documentId, 'right');
      }
    }
    event.preventDefault();
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                             ~~~ Input helper functions ~~~                            */
  /*                                                                                       */
  /*****************************************************************************************/

  /**
   * Convert keycode to virtual key code that is understood by the server
   *
   * @param event The Keyboard event
   *
   * @return the virtual key name or null if there no mapping
   */
  _keycodeToVkey (event) {
    switch (event.keyCode) {
    case  8: // backspace
      return 'backspace';
    case  9: // tab
      if ( event.shiftKey === true ) {
        return 'shift+tab';
      } else {
        return 'tab';
      }
      break;
    case 13: // enter
      return 'enter';
    case 27: // escape
      return 'esc';
    case 32: // space
      return ' ';
    case 37: // left
      return 'left';
    case 39: // right
      return 'right';
    case 38: // up
      if ( event.shiftKey === true ) {
        return 'shift+up';
      } else {
        return 'up';
      }
      break;
    case 40: // down
      if ( event.shiftKey === true ) {
        return 'shift+down';
      } else {
        return 'down';
      }
      break;
    case 46:
      return 'delete';
    case 65:
      if ( event.ctrlKey ) {
        return 'ctrl+a';
      }
      break;
    case 69:
      if ( event.ctrlKey ) {
        return 'ctrl+e';
      }
      break;
    case 75:
      if ( event.ctrlKey ) {
        return 'ctrl+k';
      }
      break;
    case 113:
      return 'F2';
    case 16:
      return 'shift';
    case 17:
      return 'ctrl';
    case 18:
      return 'alt';
    case 91:
      return 'window+left';
    case 92:
      return 'window+right';
    default:
      break;
    }
    return null;
  }

  /*****************************************************************************************/
  /*                                                                                       */
  /*                                ~~~ Mice handler ~~~                                   */
  /*                                                                                       */
  /*****************************************************************************************/

  _onMouseDown (event) {
    if ( this._mode === 'R' ) {
      event.preventDefault();
      this.epaperDocument.socket.sendKey(this.epaperDocument.documentId, 'toggle');
    } else if ( this._mode === 'c' ) {
      if ( this._select.opened ) {
        event.stopPropagation();
      }
    } else {
      this._initialSelection = false;
      this.grabFocus();
    }
  }

  _onMouseUp (event) {
    if ( this._mode === 'R' ) {
      event.preventDefault();
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
    var mid_x, mid_y, bbi, bbc;

    bbc = this.epaper.$.canvas.getBoundingClientRect();
    if ( this.$.input === undefined ) {
      return; // TODO
    }
    bbi = this.$.input.getBoundingClientRect();
    mid_x = bbc.left + left + width  / 2;
    mid_y = bbc.top  + top  + height / 2;

    // ... if the mid point of the tooltip hint is outside the editor bounding box discard it ...
    if ( mid_x < bbi.left || mid_x > bbi.right || mid_y < bbi.top || mid_y > bbi.bottom ) {
      return;
    }
    if ( content.length ) {
      console.log('Show tooltip:', content); // TODO port to casper-app
      //this.epaper.$.tooltip.show(content); // TODO port to casper-app
    } else {
      this.hideTooltip();
    }
  }

  showTooltip (content, positionTarget) {
    console.log('Show tooltip:', content); // TODO port to casper-app
    //this.epaper.$.tooltip.show(content, positionTarget);
  }

  hideTooltip () {
    if ( this.epaper.$.tooltip.hide !== undefined ) {
      console.log('Hide tooltip:'); // TODO port to casper-app
      //this.epaper.$.tooltip.hide();
    }
  }
}

window.customElements.define(CasperEpaperInput.is, CasperEpaperInput);
