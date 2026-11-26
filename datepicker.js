/* ==========================================================
   BO CHON NGAY TIENG VIET (Hong Pastel)
   Thay the <input type="date"> de dong bo giao dien + DD/MM/YYYY
   ========================================================== */

(function () {
  'use strict';

  var ANNIVERSARY = { y: 2024, m: 5, d: 16 };  // 16/05/2024

  var MONTH_NAMES = [
    'Thang 1', 'Thang 2', 'Thang 3', 'Thang 4', 'Thang 5', 'Thang 6',
    'Thang 7', 'Thang 8', 'Thang 9', 'Thang 10', 'Thang 11', 'Thang 12'
  ];

  var WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  var uid = 0;

  /** Chuoi YYYY-MM-DD -> Date (coi gio local) */
  function parseISO(s) {
    if (!s) return null;
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  /** Date -> chuoi YYYY-MM-DD */
  function toISO(d) {
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  /** Date -> chuoi DD/MM/YYYY */
  function toVN(d) {
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getFullYear();
  }

  /**
   * Tao bo chon ngay.
   * @param {object} opts
   *   - inputId: id cua <input type="date"> can thay the
   *   - placeholder: chuoi hien thi khi chua chon ngay
   *   - allowClear: co nut xoa ngay hay khong
   *   - onChange: callback(dateStr)
   */
  function createDatePicker(opts) {
    opts = opts || {};

    var oldInput = document.getElementById(opts.inputId);
    if (!oldInput) return null;

    // Doc gia tri hien tai
    var initial = parseISO(oldInput.value);

    // Giu input cu lai (an di) de code cu van doc .value nhu binh thuong
    oldInput.type = 'hidden';
    oldInput.classList.add('vn-date-hidden');
    var initialPlaceholder = opts.placeholder ||
      (oldInput.getAttribute('placeholder') || 'Chon ngay');

    var id = 'vncal' + (++uid);

    var wrap = document.createElement('div');
    wrap.className = 'vn-date-wrapper';

    var box = document.createElement('div');
    box.className = 'vn-date-input-box';
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.innerHTML =
      '<span class="vn-date-text">' +
        '<span class="vn-date-label"></span>' +
        '<span class="vn-date-icon">&#128197;</span>' +
      '</span>';

    var clearBtn = opts.allowClear === false ? '' :
      '<button type="button" class="vn-cal-action-btn" data-act="clear">Xoa ngay</button>';

    var popup = document.createElement('div');
    popup.className = 'vn-calendar-popup';
    popup.innerHTML =
      '<div class="vn-cal-header">' +
        '<button type="button" class="vn-cal-nav-btn" data-step="-1" aria-label="Thang truoc">&#8249;</button>' +
        '<div class="vn-cal-selectors">' +
          '<select class="vn-cal-select" data-role="month" aria-label="Thang"></select>' +
          '<select class="vn-cal-select" data-role="year" aria-label="Nam"></select>' +
        '</div>' +
        '<button type="button" class="vn-cal-nav-btn" data-step="1" aria-label="Thang sau">&#8250;</button>' +
      '</div>' +
      '<div class="vn-cal-weekdays">' +
        WEEKDAYS.map(function (w) { return '<div>' + w + '</div>'; }).join('') +
      '</div>' +
      '<div class="vn-cal-days"></div>' +
      '<div class="vn-cal-footer">' +
        '<button type="button" class="vn-cal-action-btn" data-act="anniversary">&#128150; Ngay hen ho (16/05)</button>' +
        clearBtn +
        '<button type="button" class="vn-cal-action-btn" data-act="today">Hom nay</button>' +
      '</div>';

    wrap.appendChild(box);
    wrap.appendChild(popup);
    oldInput.parentNode.insertBefore(wrap, oldInput);
    oldInput.parentNode.insertBefore(oldInput, wrap.nextSibling);

    // --- State ---
    var selected = initial;
    var viewMonth = selected ? selected.getMonth() : new Date().getMonth();
    var viewYear = selected ? selected.getFullYear() : new Date().getFullYear();

    var monthSel = popup.querySelector('[data-role="month"]');
    var yearSel = popup.querySelector('[data-role="year"]');
    var daysBox = popup.querySelector('.vn-cal-days');
    var labelEl = box.querySelector('.vn-date-label');

    // --- Khoi tao dropdown ---
    for (var m = 0; m < 12; m++) {
      var mo = document.createElement('option');
      mo.value = m;
      mo.textContent = MONTH_NAMES[m];
      monthSel.appendChild(mo);
    }

    var curYear = new Date().getFullYear();
    for (var y = curYear + 5; y >= 2015; y--) {
      var yo = document.createElement('option');
      yo.value = y;
      yo.textContent = 'Nam ' + y;
      yearSel.appendChild(yo);
    }

    // --- Hien thi ---
    function updateDisplay() {
      if (selected) {
        labelEl.textContent = toVN(selected);
        labelEl.className = 'vn-date-label';
        oldInput.value = toISO(selected);
      } else {
        labelEl.textContent = initialPlaceholder;
        labelEl.className = 'vn-date-label vn-date-placeholder';
        oldInput.value = '';
      }
    }

    function renderCalendar() {
      monthSel.value = viewMonth;
      yearSel.value = viewYear;

      daysBox.innerHTML = '';

      var firstDay = new Date(viewYear, viewMonth, 1).getDay();
      var startOffset = firstDay === 0 ? 6 : firstDay - 1;
      var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      var today = new Date();

      for (var i = 0; i < startOffset; i++) {
        var empty = document.createElement('div');
        empty.className = 'vn-cal-day empty';
        daysBox.appendChild(empty);
      }

      for (var d = 1; d <= daysInMonth; d++) {
        (function (day) {
          var el = document.createElement('div');
          el.className = 'vn-cal-day';
          el.textContent = day;

          if (day === today.getDate() &&
              viewMonth === today.getMonth() &&
              viewYear === today.getFullYear()) {
            el.classList.add('today');
          }

          if (selected &&
              day === selected.getDate() &&
              viewMonth === selected.getMonth() &&
              viewYear === selected.getFullYear()) {
            el.classList.add('selected');
          }

          el.addEventListener('click', function () {
            selected = new Date(viewYear, viewMonth, day);
            updateDisplay();
            renderCalendar();
            closePopup();
            if (typeof opts.onChange === 'function') {
              opts.onChange(oldInput.value);
            }
          });

          daysBox.appendChild(el);
        })(d);
      }
    }

    function openPopup() {
      popup.classList.add('show');
      box.classList.add('active');
      // Dong cac popup khac
      var others = document.querySelectorAll('.vn-calendar-popup.show');
      for (var i = 0; i < others.length; i++) {
        if (others[i] !== popup) others[i].classList.remove('show');
      }
      var boxes = document.querySelectorAll('.vn-date-input-box.active');
      for (var j = 0; j < boxes.length; j++) {
        if (boxes[j] !== box) boxes[j].classList.remove('active');
      }
    }

    function closePopup() {
      popup.classList.remove('show');
      box.classList.remove('active');
    }

    function togglePopup() {
      if (popup.classList.contains('show')) closePopup();
      else openPopup();
    }

    function changeMonth(step) {
      viewMonth += step;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderCalendar();
    }

    function jumpDate() {
      viewMonth = parseInt(monthSel.value, 10);
      viewYear = parseInt(yearSel.value, 10);
      renderCalendar();
    }

    function setDate(d, close) {
      selected = d;
      viewMonth = d.getMonth();
      viewYear = d.getFullYear();
      updateDisplay();
      renderCalendar();
      if (close) closePopup();
      if (typeof opts.onChange === 'function') opts.onChange(oldInput.value);
    }

    // --- Su kien ---
    box.addEventListener('click', togglePopup);
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePopup();
      }
    });

    popup.addEventListener('click', function (e) {
      var navBtn = e.target.closest ? e.target.closest('[data-step]') : null;
      if (navBtn) {
        e.stopPropagation();
        changeMonth(parseInt(navBtn.getAttribute('data-step'), 10));
        return;
      }

      var actBtn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (actBtn) {
        e.stopPropagation();
        var act = actBtn.getAttribute('data-act');
        if (act === 'today') {
          setDate(new Date(), true);
        } else if (act === 'clear') {
          selected = null;
          updateDisplay();
          renderCalendar();
          closePopup();
          if (typeof opts.onChange === 'function') opts.onChange('');
        } else if (act === 'anniversary') {
          setDate(new Date(ANNIVERSARY.y, ANNIVERSARY.m - 1, ANNIVERSARY.d), true);
        }
      }
    });

    monthSel.addEventListener('change', jumpDate);
    yearSel.addEventListener('change', jumpDate);

    // Bam ra ngoai -> dong
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closePopup();
    });

    // Dong bang Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('show')) {
        closePopup();
      }
    });

    updateDisplay();
    renderCalendar();

    return {
      el: wrap,
      input: oldInput,
      getValue: function () { return oldInput.value; },
      setValue: function (isoStr) {
        selected = parseISO(isoStr);
        if (selected) {
          viewMonth = selected.getMonth();
          viewYear = selected.getFullYear();
        }
        updateDisplay();
        renderCalendar();
      }
    };
  }

  // --- API public ---
  window.VNDatePicker = {
    create: createDatePicker,
    toVN: toVN,
    toISO: toISO,
    parseISO: parseISO
  };

  /**
   * Tu dong thay the moi <input type="date"> tim duoc trong DOM.
   * Ban goi ham nay sau khi DOM da san (DOMContentLoaded).
   */
  window.initVNDatePickers = function (map) {
    map = map || {};
    Object.keys(map).forEach(function (inputId) {
      var o = map[inputId] || {};
      o.inputId = inputId;
      var inst = createDatePicker(o);
      if (inst && window.__vnPickers) window.__vnPickers[inputId] = inst;
    });
  };
})();
