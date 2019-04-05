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
/*
`casper-epaper-datepicker` customised input component that overlays the rendering canvas
*/


var inputBridge = function () {
  return this.inputBox;
};

import '@vaadin/vaadin-date-picker/vaadin-date-picker-light.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';

class CasperEpaperDatepicker extends PolymerElement {

  static get template () {
    return html`
      <vaadin-date-picker-light id="picker"></vaadin-date-picker-light>
    `;
  }

  static get is () {
    return 'casper-epaper-datepicker';
  }

  static get properties () {
    return {
      inputBox: {
        type: Object
      }
    }
  }

  static get listeners () {
    return {
      'keypress': '_onKeypress',
      'keydown': '_onKeyDown'
    };
  }

  ready () {
    this.$.picker._input = inputBridge.bind(this);
    this.$.picker.$.dropdown.noOverlap = true;
  }

  attached () {
    this._closingKey = undefined;
    this.listen(this.$.picker.$.dropdown, 'iron-overlay-opened', '_onOverlayOpened');
    this.listen(this.$.picker.$.dropdown, 'iron-overlay-closed', '_onOverlayClosed');
  }

  detached () {
    this.unlisten(this.$.picker.$.dropdown, 'iron-overlay-opened', '_onOverlayOpened');
    this.unlisten(this.$.picker.$.dropdown, 'iron-overlay-closed', '_onOverlayClosed');
  }

  open () {
    this.$.picker.open();
  }

  /**
   * Show or hide the widget
   *
   * @param a_visible true to make visible, false to hide this widget
   * @return "das" widget
   */
  setVisible (a_visible) {
    this._closingKey = undefined;
    if (a_visible) {
      this.$.picker.open();
    } else {
      this.$.picker.close();
    }
  }

  setLocale (isoCountryCode) {
    moment.locale(isoCountryCode || 'pt');
    this.$.picker.i18n = {
        monthNames: moment.months(),
        weekdays: moment.weekdays(),
        weekdaysShort: moment.weekdaysShort(),
        firstDayOfWeek: moment.localeData().firstDayOfWeek(),
        today: 'hoje',
        cancel: 'cancelar',
        formatDate(d) {
          return moment(d).format(moment.localeData().longDateFormat('L'));
        },
        formatTitle(monthName, fullYear) {
          return monthName + ' ' + fullYear;
        }
    }
  }

  setValue (date) {
    this.$.picker.value = date;
  }

  /**
   * @brief Returns true if the widget is visible
   *
   * @return true if visible, false if the widget is hidden
   */
  isVisible () {
    return this.$.picker.opened;
  }

  _onOverlayOpened (event) {
    this._previousDate = this.$.picker.value;
    this.$.picker.$.overlay.style.marginTop = '-6px';
    this.$.picker.$.overlay.style.borderTop = 'solid 6px #04abc1';
  }

  _onOverlayClosed (event) {
    this.fire('date-overlay-closed', {
      closingKey:   this._closingKey,
      previousDate: this._previousDate,
      currentDate:  this.$.picker.value
    });
  }

  /**
   * Intercepts keys to capture the closing key and to prevent events
   * from piercing up to the epaper behind
   *
   * @param event Keyboard event
   */
  _onKeyDown (event) {
    switch (event.keyCode) {
      case  9: // tab
        if ( this.$.picker.$.overlay.focusedDate ) {
          this.$.picker.$.overlay.selectedDate = this.$.picker.$.overlay.focusedDate;

          if ( event.shiftKey === true ) {
            this._closingKey = 'shift+tab';
          } else {
            this._closingKey = 'tab';
          }
        }
        this.$.picker.close();
        break;
      case 13:
        this._closingKey = 'enter';
        break;
      case 27:
        this._closingKey =  'esc';
        break;
      default:
        this._closingKey = undefined;
        break;
    }
    event.stopPropagation();
  }

  /**
   * Intercepts to prevent keys from piercing up to the epaper behind
   *
   * @param event Keyboard event
   */
  _onKeypress (event) {
    event.stopPropagation();
  }
}