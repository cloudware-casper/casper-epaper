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

import './casper-epaper-htmldiv.js';
import '@polymer/iron-icon/iron-icon.js';
import '@polymer/iron-list/iron-list.js';
import '@polymer/iron-dropdown/iron-dropdown.js';
import '@polymer/paper-spinner/paper-spinner-lite.js';
import '@polymer/paper-input/paper-input-container.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';

/**
 * Simple collation function.
 *
 * Currently limited to Portuguese only, tough it can be easily extended to other latin script and
 * MIGHT work even without explicit locale tests.
 *
 * @param char character to collate
 * @return the collated character
 */

var _collateChar = function (char) {
  switch ( char.charCodeAt(0) ) {
    case 65:  /* 'A' */ return 'a';
    case 66:  /* 'B' */ return 'b';
    case 67:  /* 'C' */ return 'c';
    case 68:  /* 'D' */ return 'd';
    case 69:  /* 'E' */ return 'e';
    case 70:  /* 'F' */ return 'f';
    case 71:  /* 'G' */ return 'g';
    case 72:  /* 'H' */ return 'h';
    case 73:  /* 'I' */ return 'i';
    case 74:  /* 'J' */ return 'j';
    case 75:  /* 'K' */ return 'k';
    case 76:  /* 'L' */ return 'l';
    case 77:  /* 'M' */ return 'm';
    case 78:  /* 'N' */ return 'n';
    case 79:  /* 'O' */ return 'o';
    case 80:  /* 'P' */ return 'p';
    case 81:  /* 'Q' */ return 'q';
    case 82:  /* 'R' */ return 'r';
    case 83:  /* 'S' */ return 's';
    case 84:  /* 'T' */ return 't';
    case 85:  /* 'U' */ return 'u';
    case 86:  /* 'V' */ return 'v';
    case 87:  /* 'W' */ return 'w';
    case 88:  /* 'X' */ return 'x';
    case 89:  /* 'Y' */ return 'y';
    case 90:  /* 'Z' */ return 'z';
    case 231: /* 'ç' */ return 'c';
    case 227: /* 'ã' */ return 'a';
    case 225: /* 'á' */ return 'a';
    case 224: /* 'à' */ return 'a';
    case 226: /* 'â' */ return 'a';
    case 245: /* 'õ' */ return 'o';
    case 243: /* 'ó' */ return 'o';
    case 242: /* 'ò' */ return 'o';
    case 244: /* 'ô' */ return 'o';
    case 233: /* 'é' */ return 'e';
    case 232: /* 'è' */ return 'e';
    case 234: /* 'ê' */ return 'e';
    case 237: /* 'í' */ return 'i';
    case 238: /* 'î' */ return 'i';
    case 250: /* 'ú' */ return 'u';
    case 249: /* 'ù' */ return 'u';
    case 251: /* 'û' */ return 'u';
    case 199: /* 'Ç' */ return 'c';
    case 195: /* 'Ã' */ return 'a';
    case 193: /* 'Á' */ return 'a';
    case 192: /* 'À' */ return 'a';
    case 194: /* 'Â' */ return 'a';
    case 213: /* 'Õ' */ return 'o';
    case 211: /* 'Ó' */ return 'o';
    case 210: /* 'Ò' */ return 'o';
    case 212: /* 'Ô' */ return 'o';
    case 201: /* 'É' */ return 'e';
    case 200: /* 'È' */ return 'e';
    case 202: /* 'Ê' */ return 'e';
    case 205: /* 'Í' */ return 'i';
    case 206: /* 'Î' */ return 'i';
    case 218: /* 'Ú' */ return 'u';
    case 217: /* 'Ù' */ return 'u';
    case 219: /* 'Û' */ return 'u';
    default:
      return char;
  }
};

var _collatedSearch = function (text, searchValue) {
  var tl = text.length;
  var j  = 0;

  for ( var i = 0; i < tl; i++ ) {
    if ( _collateChar(text[i]) === _collateChar(searchValue[j]) ) {
      j += 1;
      if ( j === searchValue.length ) {
        return i - j + 1;
      }
    } else {
      j = 0;
    }
  }
  return -1;
};

class CasperEpaperCombolist extends PolymerElement {

  static get template() {
    return html`
      <style>
        :host {
          display: block;
          position: absolute;
        }

        iron-dropdown {
          margin:  0px;
          padding: 0px;
          @apply(--shadow-elevation-8dp);
        }

        .dropdown-content {
          background-color: var(--primary-background-color);
          @apply(--layout-vertical);
          font-size: 12px;
          overflow: hidden;
        }

        paper-input-container {
          padding: 0px;
          background-color: var(--primary-color);
          margin-bottom: 1px;
        }

        iron-list {
          @apply(--layout-flex-auto);
        }

        iron-icon {
          color: var(--dark-theme-text-color);
          cursor: pointer;
          padding:  2px;
          width:   16px;
          height:  16px;
        }

        input.header,
        label.header {
          color: var(--dark-theme-text-color);
          font-size: 12px;
        }

        ::-ms-clear {
          display: none;
        }

        #scroller {
          overflow: auto;
          -ms-overflow-style: -ms-autohiding-scrollbar;
          min-height: 70px;
          max-height: var(--casper-combo-box-overlay-max-height, 80vh);

          /* Fixes item background from getting on top of scrollbars on Safari */
          transform: translate3d(0,0,0);

          /* Enable momentum scrolling on iOS (iron-list v1.2+ no longer does it for us) */
          -webkit-overflow-scrolling: touch;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }

        .item {
          outline: 0;
          font-size: 12 px;
          cursor: pointer;
          padding: 3px;
        }

        .item:hover {
          background-color: #f0f0f0;
        }

        .item.selected {
          color: white;
          background-color: var(--dark-primary-color);
        }

        paper-fab.blue {
          position: absolute;
          right: 6px;
          bottom: 6px;
          color: white;
          opacity: 0.75;
          --paper-fab-background: var(--dark-primary-color);
          --paper-fab-keyboard-focus-background: var(--dark-primary-color);
        }

        paper-spinner-lite {
          position: absolute;
          pointer-events:none;
          top: 50%;
          left: 50%;
          margin-left: -20px;
          margin-top: -20px;
          width: 40px;
          height: 40px;
          --paper-spinner-color: var(--dark-primary-color);
          --paper-spinner-stroke-width: 5px;
        }

      </style>

      <iron-dropdown id="dialog" on-iron-overlay-opened="_dialogOpened" on-iron-overlay-closed="_dialogClosed" no-overlap="" horizontal-align="auto" vertical-align="auto">
        <div class="dropdown-content">
          <paper-input-container no-label-float="" on-tap="_inputTap">
            <iron-icon prefix="" icon="casper-icons:search"></iron-icon>
            <label class="header">pesquisar</label>
            <input is="iron-input" id="input" class="header" bind-value="{{_query}}">
            <iron-icon id="clear" suffix="" on-tap="_clearQuery" icon="casper-icons:clear" alt="limpar" title="limpar"></iron-icon>
          </paper-input-container>
          <div id="scroller" on-tap="_stopPropagation">
            <iron-list id="list" items="[[_filteredItems]]" as="item" selected-item="{{selectedItem}}" on-tap="_selectItem" scroll-target="scroller">
              <template>
                <casper-epaper-htmldiv tabindex$="[[tabIndex]]" class$="[[_getItemClass(selected)]]" inner-html="[[_renderRow(item)]]">
                </casper-epaper-htmldiv>
              </template>
            </iron-list>
            <paper-spinner-lite id="spinner"></paper-spinner-lite>
          </div>
          <paper-fab mini="" icon="add" class="blue" hidden$="[[!showFab]]"></paper-fab>
        </div>
      </iron-dropdown>
    `;
  }

  static get is () {
    return 'casper-epaper-combolist';
  }

  static get properties () {
    return {
      addMessage: {
        type:    String,
        default: 'Add coisa'
      },
      selectedItem: {
        type: Object,
        observer: '_onSelectionChanged'
      },
      _query: {
        type: String,
        observer: '_onQueryChanged'
      },
      _filteredItems: {
        type: Array
      },
      displayFields: {
        type: Array
      },
      items: {
        type: Array
      },
      showFab: {
        type: Boolean,
        value: false
      }
    };
  }

  ready () {
    this._canvas        = undefined;
    this._modelCache    = {};
    this._closingKey    = undefined;
    this._initialId     = undefined;
    this._selectedId    = undefined;
    this._notifiyIdOnly = false;
    this.displayFields  = ['id', 'description'];
  }

  attached () {
    this.listen(this.$.input, 'keydown', '_keyDownHandler');
  }

  detached () {
    this.unlisten(this.$.input, 'keydown', '_keyDownHandler');
  }

  /**
   * Defines the element that controls the dialog positioning
   *
   * The dialog will be placed along one the edges of the supplied element
   *
   * @param element The HTML element
   */
  setPositionTarget (element) {
    this.$.dialog.positionTarget = element;
  }

  setFitInto (element) {
    this.$.dialog.fitInto = element;
  }

  setCasperBinding (binding) {
    this._binding = binding;
    if ( this._binding !== undefined ) {
      this.displayFields = this._binding.attachment.display;
    } else {
      this.displayFields = [];
    }
  }

  /**
   * Show or hide the widget
   *
   * @param a_visible true to make visible, false to hide this widget
   */
  setVisible (a_visible, a_query) {
    this._closingKey = undefined;
    if (a_visible) {
      this._query = a_query
      this._filterModel(this._query);
      this.$.dialog.open();
    } else {
      this.$.dialog.close();
    }
  }

  /**
   * @brief Returns true if the widget is visible
   *
   * @return true if visible, false if the widget is hidden
   */
  isVisible () {
    return this.$.dialog.opened;
  }

  /**
   * Returns the number of items in the list
   *
   * @return number of records in model
   */
  getSize () {
    return this.items !== undefined ? this.items.length : 0;
  }

  /**
   * Returns the ID of the currently selected item
   *
   * @return the item id
   */
  getSelectedId () {
    return this._selectedId;
  }

  /**
   * @brief Returns the ID of the item that was initially selected
   *
   * @return the initial item id
   */
  getInitialId () {
    return this._initialId;
  }

  /**
   * @brief Return a field of the current selected model item
   *
   * @param a_index the display field index
   *
   * @returns the request field or empty string if there's none
   */
  getSelectedField (a_index) {
    if ( this.items === undefined || this.selectedItem === undefined ) {
      return undefined;
    }
    return this.selectedItem[this.displayFields[a_index]];
  }

  /**
   * Automatically resize the list taking into account the specified constraints
   *
   * Horizontal size determined by the maximum text width, vertical size is determined by the number of rows
   *
   * @param min_width minimum width of list box
   * @param max_width maximum width of the box
   */
  autoSize (min_width, max_width) {
    var i, len, current_font, width, height, plen, ctx;
    var fm;

    this._canvas = this._canvas || document.createElement("canvas");
    ctx = this._canvas.getContext('2d');

    ctx.font = this.$.list.getComputedStyleValue('font'); // TODO This is *NOT* the correct font!!!
    //console.log('=== font is '+ctx.font);

    if ( this.items === undefined ) {
      len   = 1;
      width = min_width;
    } else {
      len = this.items.length;
      width = 0;
      for ( i = 0; i < len; i++ ) {
        plen = ctx.measureText(this._getDisplayValue(this.items[i])).width;
        if ( plen > width ) {
          width = plen;
        }
      }
      width += 30;
    }

    width = Math.ceil(width);
    if ( min_width !== undefined && width < min_width ) {
      width = Math.ceil(min_width);
    }
    if ( max_width !== undefined && width > max_width ) {
      width = Math.ceil(max_width);
    }
    this.$.dialog.style.width = width + 'px';
    this.$.list.style.width = width + 'px';
    console.log('~~~~ auto sized '+width);
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
    if ( combo_id === undefined ) {
      this.items = JSON.parse(json);
    } else {

      if ( json === undefined ) {
        var json = this._modelCache[combo_id];
        if ( json !== undefined ) {
          this.items = JSON.parse(json);
        } else {
          this.items = undefined;
        }
      } else {
        this._modelCache[combo_id] = json;
        this.items = JSON.parse(json);
      }
    }
  }

  setModelFromJsonApi (jsonApi) {
    var len, ja_items, items;

    ja_items = JSON.parse(jsonApi)['data'];
    len      = ja_items.length;
    items    = [];
    for (var i = 0; i < len; ++i ) {
      ja_items[i].attributes.id = ja_items[i].id;
      items.push(ja_items[i].attributes);
    }
    ja_items   = null;
    this.items = null;
    this.items = items;
    this._selectedId = this._initialId;
    this._filterModel(this._query);
  }

  /**
   * Sets the name of the data model field that contains the item description
   *
   * @param a_display_fields array of fields names
   */
  setDisplayFields (a_display_fields) {
    this.displayFields = a_display_fields;
  }

  setNotifyIdOnly (a_option) {
    this._notifiyIdOnly = a_option;
  }

  /**
   * Find the model index with specified id and makes it the current selection
   *
   * @param a_id The id of row that should become selected
   */
  selectById (a_id) {
    var idx;

    this._initialId = a_id;
    if ( this.items.length > 0 ) {
      idx = this._findIndexById(this._initialId);
      if ( idx === undefined ) {
        idx = 0;
      }
      this.items[idx]['_id'] = this.items[idx].id;
      this.items[idx]['_displayValue'] = this._getDisplayValue(this.items[idx]);
      this.selectedItem = this.items[idx];
      this._selectedId = this.items[idx]['_id'];
    }
  }

  /**
   * Throw away the data and display models
   */
  clearModel () {
    this.selectedItem   = undefined;
    this.items          = [];
    this._filteredItems = [];
    this._closingKey    = undefined;
    this._notifiyIdOnly = false;
    this._selectedId    = undefined;
    this._initialId     = undefined;
  }

  moveSelection (a_direction) {
    if ( this._selectedId ) {
      var idx = this._findFilteredIndexById(this._selectedId);
      if ( idx !== undefined ) {
        if ( a_direction === 'up' && idx > 0 ) {
          idx -= 1;
          this.$.list.selectItem(idx);
          this.$.list.scrollToIndex(idx-1);
        } else if ( a_direction === 'down' && idx < this._filteredItems.length - 1) {
          idx += 1;
          this.$.list.selectItem(idx);
          this.$.list.scrollToIndex(idx - 1);
        } else if ( a_direction === 'keep' ) {
          this.$.list.selectItem(idx);
          this.$.list.scrollToIndex(idx);
        }
      }
    }
  }

  _dialogOpened () {
    //this._query = '';
    this._onQueryChanged();
    this.async(function () {
      this.$.list.fire('iron-resize');
      this.moveSelection('keep');
    }.bind(this), 200);
    this.$.input.focus();
  }

  _onSelectionChanged () {
    if ( this.selectedItem ) {
      var matchStart, matchEnd, filter, flen, i, f, displayValue;

      displayValue = this._notifiyIdOnly ? this._selectedId : this.selectedItem._displayValue;
      if ( this._query && this._query.length > 0 ) {
        matchStart = displayValue.length;
        matchEnd   = -1;
        filter     = this._query.trim().split(' ');
        flen       = filter.length;
        for ( f = 0; f < flen; f++ ) {
          if ( filter[f].length > 0 ) {
            i = _collatedSearch(displayValue, filter[f]);
            if ( i !== -1 ) {
              if ( i < matchStart ) {
                matchStart = i;
              }
              if (i + filter[f].length > matchEnd ) {
                matchEnd = i + filter[f].length;
              }
            }
          }
        }
        if ( matchStart > matchEnd ) {
          matchStart = matchEnd = undefined;
        }
      }

      this._selectedId = this.selectedItem ?  this.selectedItem._id : undefined;
      this.fire('on-combo-selection-changed', {
        displayValue: displayValue,
        selectedId:   this._selectedId,
        matchStart:   matchStart,
        matchEnd:     matchEnd
      });
    }
  }

  _dialogClosed (a_event) {
    this.fire('on-combo-list-closed', {
        selectedId:   this.selectedItem ?  this.selectedItem._id : undefined,
        displayValue: this.selectedItem ? (this._notifiyIdOnly ? this.selectedItem._id : this.selectedItem._displayValue) : '',
        previousId:   this._initialId,
        closingKey:   this._closingKey
      });
  }

  _inputTap (a_event) {
    a_event.stopPropagation();
  }

  _keyDownHandler (a_event) {
    switch (a_event.keyCode) {
      case  9: // tab
        this._closingKey = a_event.shiftKey === true ? 'shift+tab' : 'tab';
        this.$.dialog.close();
        break;
      case 13: // enter
        this._closingKey = 'enter'
        this.$.dialog.close();
        break;
      case 27: // escape
        this.selectById(this._initialId);
        this._closingKey = 'esc';
        this.$.dialog.close();
        break;
      case 38: // up
        this.moveSelection('up');
        a_event.stopPropagation();
        break;
      case 40: // down
        this.moveSelection('down');
        a_event.stopPropagation();
        break;
      default:
        a_event.stopPropagation();
        return;
    }
  }

  _clearQuery () {
    this._query = undefined;
    this._filterModel(this._query);
    this.$.clear.style.opacity = this._query && this._query.length ? 1 : 0.0;
    this.moveSelection('keep');
    this.$.input.focus();
  }

  /**
   * Listens to changes in the filter query to apply/update the model filtering
   */
  _onQueryChanged () {
    if ( this._query === undefined ) {
      return;
    }

    // ... clear button visibility ...
    if ( this._query !== '' ) {
      this.$.clear.style.opacity = 1.0;
    } else {
      this.$.clear.style.opacity = 0.0;
    }

    // ... apply the filter ...
    this._filterModel(this._query);

    // ... if the filter query is active pick the first element ...
    if ( this._filteredItems && this._filteredItems.length !== 0 ) {
      if ( this._query && this._query.length > 0 ) {
        this.$.list.selectItem(0);
      } else {
        // ... no filtering pick and show the initial id ...
        var idx = this._findFilteredIndexById(this._initialId);
        if ( idx !== undefined ) {
           this.$.list.selectItem(idx);
           this.$.list.scrollToIndex(idx);
        }
      }
    }
    this.$.dialog.notifyResize();
  }

  _selectItem (a_event) {
    var model = this.$.list.modelForElement(a_event.target);
    if (model) {
      this.$.list.selectItem(model[this.$.list.as]);
    }
    this.$.dialog.close();
    a_event.stopPropagation();
  }

  /**
   * Apply filter string to the list model
   *
   * Rebuilds the display array _lines with the visible rows
   *
   * @param a_filter filter to apply
   */
  _filterModel (a_query) {
    var field, model_len, fields_len, visible_rows, filter, fitem, item_visible, ms;
    var match, stack, m, top, text, html;

    if ( ! this.items ) {
      return;
    }

    if ( a_query === undefined || a_query === null || a_query.length === 0 ) {
      filter = [];
    } else {
      filter = a_query.trim().split(' ');
    }
    model_len    = this.items.length;
    fields_len   = this.displayFields.length;
    filter_len   = filter.length;
    visible_rows = [];
    len          = this.items.length;

    // ... iterate the model record by record one line at time ...
    for ( i = 0; i < model_len; i++ ) {
      fitem = {};
      item_visible = false;

      // ... filter each field individually ...
      for ( f = 0; f < fields_len; f++ ) {
        field = this.displayFields[f];
        match = [];

        // ... each field is copied to output object, start with unmodifed text ...
        text         = this.items[i][field];
        fitem[field] = text;

        for ( k = 0; k < filter_len; k++) {
          ms = _collatedSearch(text, filter[k]);
          if ( ms !== -1 ) {
            match.push({ start: ms, end: ms+filter[k].length - 1});
          }
        }

        if ( filter_len !== 0 && match.length === filter_len ) {

          // ... merge overlapping matches, ref: http://www.geeksforgeeks.org/merging-intervals/
          match.sort(function(a, b) {return a.start - b.start;});
          stack = [];
          top   = { start: undefined, end: undefined };
          stack.push(match[0]);
          ms = match.length;

          // ... start from the next interval and merge if necessary ...
          for (m = 1 ; m < ms; m++) {

            // ... get interval from stack top ...
            top.start = stack[stack.length-1].start;
            top.end   = stack[stack.length-1].end;

            // ... if current interval is not overlapping with stack top push it to the stack ..
            if ( match[m].start - top.end > 1 ) {
              stack.push(match[m]);
            } else {
              // ... otherwise update the end of top if endof current interval is more ...
              if ( top.end < match[m].end ) {
                stack[stack.length-1].end = match[m].end;
              }
            }
          }

          // ... highligth the match ...
          ms   = stack.length;
          html = text.substring(0, stack[0].start);
          for ( m = 0; m < ms; m++ ) {
            html += '<span class="highligth">' + text.substring(stack[m].start, stack[m].end + 1) + '</span>';
            if ( m === ms - 1) {
              html += text.substring(stack[m].end + 1, text.length);
            } else {
              html += text.substring(stack[m].end + 1, stack[m+1].start);
            }
          }
          fitem[field] = html;
          item_visible = true;
        }
      }
      if ( filter_len === 0 || item_visible ) {
        fitem['_displayValue'] = this._getDisplayValue(this.items[i]);
        fitem['_id'] = this.items[i].id;
        visible_rows.push(fitem);
      }
    }
    if ( visible_rows.length ) {
      this._filteredItems = visible_rows;
    }
  }

  /**
   * Find the model index with specified id
   *
   * @param a_id The id of the model item to look for
   * @return the index of the model item with matching index, undefined if not not found
   */
  _findIndexById (a_id) {
    var index = undefined;

    // ... walk the data model to pick the element with matching id ...
    if ( this.items !== undefined && a_id ) {
      var i, len = this.items.length;
      for ( i = 0; i < len; i++ ) {
        if ( this.items[i].id === a_id ) {
          index = i;
          break;
        }
      }
    }
    return index;
  }

  _findFilteredIndexById (a_id) {
    var index = undefined;

    // ... walk the data model to pick the element with matching id ...
    if ( this._filteredItems !== undefined && a_id ) {
      var i, len = this._filteredItems.length;
      for ( i = 0; i < len; i++ ) {
        if ( this._filteredItems[i]._id === a_id ) {
          index = i;
          break;
        }
      }
    }
    return index;
  }

  _getDisplayValue (a_item) {
    var fields_len = this.displayFields.length;
    var it = [];

    for ( f = 0; f < fields_len; f++ ) {
      it.push(a_item[this.displayFields[f]]);
    }
    return it.join(' - ');
  }

  _renderRow (a_item) {
    var fields_len = this.displayFields.length;

    if ( this._binding !== undefined && this._binding.attachment !== undefined && this._binding.attachment.html !== undefined ) {
      var rv = this._binding.attachment.html;

      for ( var f = 0; f < fields_len; f++ ) {
        var fn = this.displayFields[f];
        rv = rv.replace('[['+fn+']]', a_item[fn]);
      }
      return rv;
    } else {
      var it = [];

      for ( var f = 0; f < fields_len; f++ ) {
        it.push(a_item[this.displayFields[f]]);
      }
      return it.join(' - ');
    }
  }

  /**
   * Returns the CSS class to apply to the list rows
   *
   * @param selected true if the row is selected
   * @return the class
   */
  _getItemClass (selected) {
    return selected ? 'item selected' : 'item';
  }

  _stopPropagation (event) {
    event.stopPropagation();
  }
}

window.customElements.define(CasperEpaperCombolist.is, CasperEpaperCombolist);
