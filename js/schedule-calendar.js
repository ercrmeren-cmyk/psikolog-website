/**
 * Self-contained scheduling calendar modal (vanilla JS).
 * Opens from .sched-cta__trigger; modal appended once to document.body.
 *
 * Booking requests POST to Cloudflare Worker (EmailJS proxy); no client-side EmailJS/reCAPTCHA.
 * GDPR: users must accept the privacy policy checkbox before submit.
 */
(function () {
  'use strict';

  var EMAIL_WORKER_URL =
    typeof window !== 'undefined' &&
    window.PSIKO_CONFIG &&
    window.PSIKO_CONFIG.EMAIL_WORKER_URL
      ? window.PSIKO_CONFIG.EMAIL_WORKER_URL
      : 'https://emailjs-proxy.ercorumlueren.workers.dev';

  var DIALOG_ID = 'sched-calendar-dialog';
  var MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  /** Monday-first weekday labels (Lunes … Domingo) */
  var WD_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Same maxlength as contact form "Mensaje" (iletisim.html). */
  var NOTE_MAX_CHARS = 500;

  /** Mirror js/script.js contact textarea: collapse 3+ consecutive newlines to two. */
  function normalizeNoteNewlines(text) {
    return String(text).replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Allow letters (Latin extended), digits, whitespace, punctuation . , ; : ! ? ¡ ¿ -
   * Strips symbols such as &lt; &gt; &amp; quotes, $, %, *, etc. (booking-specific).
   */
  function stripNoteDisallowed(str) {
    return String(str).replace(
      /[^\r\n\t \u0030-\u0039\u0041-\u005A\u0061-\u007A\u00C0-\u024F.,;:!?¡¿\-]/g,
      ''
    );
  }

  /** Plain text note for Worker JSON body (no HTML escaping). */
  function plainNoteForWorker(raw) {
    var s = (raw || '').trim();
    s = normalizeNoteNewlines(s);
    s = stripNoteDisallowed(s);
    if (s.length > NOTE_MAX_CHARS) s = s.slice(0, NOTE_MAX_CHARS);
    return s;
  }

  function buildBookingWorkerMessage(refs, selectedDateKey, selectedSlotId) {
    var slotInfo = getSlotById(selectedSlotId, selectedDateKey);
    var lines = [];
    lines.push('Reserva (calendario web)');
    lines.push('Fecha: ' + formatDateSpanish(selectedDateKey));
    if (slotInfo) lines.push('Franja: ' + slotInfo.label);
    var phone = (refs.inputPhone.value || '').trim();
    if (phone) lines.push('Teléfono: ' + phone);
    var note = plainNoteForWorker(refs.inputNote.value);
    if (note) lines.push('Nota: ' + note);
    return lines.join('\n');
  }

  function selectedDateSummary(selectedDateKey, selectedSlotId) {
    var slotInfo = getSlotById(selectedSlotId, selectedDateKey);
    return formatDateSpanish(selectedDateKey) + (slotInfo ? ' — ' + slotInfo.label : '');
  }

  /**
   * Opening hours (local weekday, Date#getDay: Sun=0 … Sat=6):
   * Mon & Fri: 09:00–18:00 (one-hour slots, last 17:00–18:00). Thu: 09:00–12:00 only.
   * Closed: Sat, Sun, Tue, Wed.
   */
  function buildOneHourSlots(startH, endHExclusive) {
    var slots = [];
    for (var h = startH; h < endHExclusive; h++) {
      var start = pad2(h) + ':00';
      var end = pad2(h + 1) + ':00';
      slots.push({
        id: String(h),
        label: start + ' – ' + end,
        compact: start + '-' + end
      });
    }
    return slots;
  }

  function getDayOfWeekFromDateKey(dateKey) {
    if (!dateKey || dateKey.indexOf('-') < 0) return null;
    var parts = dateKey.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d).getDay();
  }

  /** True if this weekday appears in the calendar as selectable (not past-only). */
  function isOpenBookingDay(dow) {
    if (dow === 1 || dow === 5) return true;
    if (dow === 4) return true;
    return false;
  }

  function getTimeSlotDefsForDayOfWeek(dow) {
    if (dow === 4) {
      return buildOneHourSlots(9, 12);
    }
    if (dow === 1 || dow === 5) {
      return buildOneHourSlots(9, 18);
    }
    return [];
  }

  function getSlotById(id, dateKey) {
    var dow = getDayOfWeekFromDateKey(dateKey);
    if (dow == null) return null;
    var defs = getTimeSlotDefsForDayOfWeek(dow);
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].id === id) return defs[i];
    }
    return null;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /** Monday = 0 … Sunday = 6 */
  function mondayWeekIndex(date) {
    var day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }

  /** "2026-05-01" → "1 de mayo de 2026" */
  function formatDateSpanish(dateKey) {
    if (!dateKey || dateKey.indexOf('-') < 0) return '';
    var parts = dateKey.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return dateKey;
    return d + ' de ' + MONTH_NAMES[m] + ' de ' + y;
  }

  function buildModalMarkup() {
    var wrap = document.createElement('div');
    wrap.className = 'sched-cal-root';
    wrap.innerHTML =
      '<div class="sched-cal-backdrop" data-sched-cal-close tabindex="-1" aria-hidden="true"></div>' +
      '<div class="sched-cal-modal" id="' + DIALOG_ID + '" role="dialog" aria-modal="true" aria-labelledby="sched-cal-title" aria-hidden="true" tabindex="-1">' +
        '<div class="sched-cal-modal__inner">' +
          '<div class="sched-cal-header">' +
            '<h2 class="sched-cal-title" id="sched-cal-title">Disponibilidad</h2>' +
            '<button type="button" class="sched-cal-close" data-sched-cal-close aria-label="Cerrar calendario">' +
              '<span aria-hidden="true">&times;</span>' +
            '</button>' +
          '</div>' +
          '<p class="sched-cal-subtitle">Selecciona un día para consultar disponibilidad (próximamente podrás enviar tu solicitud).</p>' +
          '<div class="sched-cal-toolbar">' +
            '<button type="button" class="sched-cal-nav sched-cal-nav--prev" aria-label="Mes anterior">&lsaquo;</button>' +
            '<span class="sched-cal-month-label" id="sched-cal-month-label"></span>' +
            '<button type="button" class="sched-cal-nav sched-cal-nav--next" aria-label="Mes siguiente">&rsaquo;</button>' +
          '</div>' +
          '<div class="sched-cal-weekdays" id="sched-cal-weekdays"></div>' +
          '<div class="sched-cal-grid" id="sched-cal-grid"></div>' +
          '<div id="sched-cal-time-wrap" class="sched-cal-time-wrap" hidden aria-hidden="true">' +
            '<p class="sched-cal-time-heading" id="sched-cal-time-heading">Franja horaria</p>' +
            '<div class="sched-cal-time-grid" id="sched-cal-time-grid" role="group" aria-labelledby="sched-cal-time-heading"></div>' +
          '</div>' +
          '<div id="sched-cal-booking-slot" class="sched-cal-booking-slot" hidden aria-hidden="true">' +
            '<div id="sched-cal-form-wrap" class="sched-cal-form-wrap" hidden>' +
              '<p class="sched-cal-form-heading">Datos de reserva</p>' +
              '<form id="sched-cal-form" class="sched-cal-form" novalidate>' +
                '<div class="sched-cal-field">' +
                  '<label class="sched-cal-label" for="sched-cal-name">Nombre <span class="sched-cal-req" aria-hidden="true">*</span></label>' +
                  '<input class="sched-cal-input" id="sched-cal-name" name="user_name" type="text" autocomplete="name" maxlength="120" required>' +
                '</div>' +
                '<div class="sched-cal-field">' +
                  '<label class="sched-cal-label" for="sched-cal-email">Correo electrónico <span class="sched-cal-req" aria-hidden="true">*</span></label>' +
                  '<input class="sched-cal-input" id="sched-cal-email" name="user_email" type="email" autocomplete="email" inputmode="email" maxlength="100" required>' +
                '</div>' +
                '<div class="sched-cal-field">' +
                  '<label class="sched-cal-label" for="sched-cal-phone">Teléfono</label>' +
                  '<input class="sched-cal-input" id="sched-cal-phone" name="user_phone" type="tel" autocomplete="tel" maxlength="40">' +
                '</div>' +
                '<div class="sched-cal-field">' +
                  '<label class="sched-cal-label" for="sched-cal-note">Nota</label>' +
                  '<textarea class="sched-cal-textarea" id="sched-cal-note" name="user_note" rows="3" maxlength="500" placeholder="Motivo de consulta (opcional)"></textarea>' +
                  '<div id="sched-cal-note-counter" class="sched-cal-char-counter" aria-live="polite">0 / 500</div>' +
                '</div>' +
                '<div class="sched-cal-field sched-cal-field--consent">' +
                  '<input type="checkbox" id="sched-cal-consent" name="privacy_consent" class="sched-cal-consent__input" value="1" autocomplete="off">' +
                  '<label class="sched-cal-consent__label" for="sched-cal-consent">' +
                    'He leído y acepto la <a href="privacy-policy.html" class="sched-cal-consent__link">política de privacidad</a>.' +
                  '</label>' +
                '</div>' +
                '<p class="sched-cal-security-strip" role="note">' +
                  '<span class="sched-cal-security-strip__icon" aria-hidden="true">🔒</span>' +
                  '<span class="sched-cal-security-strip__text">Tus datos están seguros y se transmiten cifrados.</span>' +
                '</p>' +
                '<p id="sched-cal-system-msg" class="sched-cal-system-msg" hidden role="alert"></p>' +
                '<button type="submit" class="sched-cal-submit" id="sched-cal-submit">Reservar cita</button>' +
              '</form>' +
            '</div>' +
            '<div id="sched-cal-success" class="sched-cal-feedback sched-cal-feedback--success" hidden>' +
              '<span class="sched-cal-feedback__icon" aria-hidden="true">✓</span>' +
              '<p class="sched-cal-feedback__text">Gracias. Hemos recibido tu solicitud. Recibirás un correo electrónico de confirmación cuando procesemos tu petición. También te contactaremos pronto para confirmar la cita.</p>' +
              '<button type="button" class="sched-cal-btn-secondary" id="sched-cal-success-close">Cerrar</button>' +
            '</div>' +
            '<div id="sched-cal-error" class="sched-cal-feedback sched-cal-feedback--error" hidden>' +
              '<p class="sched-cal-feedback__text">Hubo un problema. Por favor, intenta de nuevo o contáctanos directamente.</p>' +
              '<div class="sched-cal-feedback__actions">' +
                '<button type="button" class="sched-cal-btn-secondary" id="sched-cal-error-retry">Reintentar</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return wrap;
  }

  function renderWeekdayHeaders(container) {
    container.innerHTML = '';
    WD_LABELS.forEach(function (label) {
      var el = document.createElement('div');
      el.className = 'sched-cal-weekday';
      el.textContent = label;
      container.appendChild(el);
    });
  }

  function renderMonth(grid, labelEl, viewYear, viewMonth, selectedDateKey) {
    var now = new Date();
    var todayY = now.getFullYear();
    var todayM = now.getMonth();
    var todayD = now.getDate();

    labelEl.textContent =
      MONTH_NAMES[viewMonth].charAt(0).toUpperCase() + MONTH_NAMES[viewMonth].slice(1) +
      ' ' + viewYear;

    var first = new Date(viewYear, viewMonth, 1);
    var startPad = mondayWeekIndex(first);
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    grid.innerHTML = '';
    var totalCells = startPad + daysInMonth;
    var rows = Math.ceil(totalCells / 7);
    var dayNum = 1;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < 7; c++) {
        var idx = r * 7 + c;
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'sched-cal-day';

        if (idx < startPad || dayNum > daysInMonth) {
          cell.className += ' sched-cal-day--empty';
          cell.disabled = true;
          cell.setAttribute('aria-hidden', 'true');
          cell.textContent = '';
        } else {
          var y = viewYear;
          var m = viewMonth;
          var d = dayNum;
          var key = y + '-' + pad2(m + 1) + '-' + pad2(d);
          var cellDate = new Date(y, m, d);
          var dow = cellDate.getDay();
          var todayStart = new Date(todayY, todayM, todayD);
          var cellStart = new Date(y, m, d);
          var isPast = cellStart.getTime() < todayStart.getTime();
          var isDisabled = isPast || !isOpenBookingDay(dow);

          cell.textContent = String(d);

          if (isDisabled) {
            cell.classList.add('sched-cal-day--disabled');
            cell.disabled = true;
            cell.removeAttribute('data-date-key');
            cell.setAttribute('aria-disabled', 'true');
            cell.setAttribute(
              'aria-label',
              d + ' de ' + MONTH_NAMES[m] + ' de ' + y + ', no disponible'
            );
          } else {
            cell.dataset.dateKey = key;
            cell.setAttribute('aria-disabled', 'false');

            var labelSuffix = '';
            if (y === todayY && m === todayM && d === todayD) {
              cell.classList.add('sched-cal-day--today');
              labelSuffix = ', hoy';
            }
            cell.setAttribute(
              'aria-label',
              d + ' de ' + MONTH_NAMES[m] + ' de ' + y + labelSuffix
            );

            if (selectedDateKey === key) {
              cell.classList.add('sched-cal-day--selected');
              cell.setAttribute('aria-pressed', 'true');
            } else {
              cell.setAttribute('aria-pressed', 'false');
            }
          }

          dayNum++;
        }
        grid.appendChild(cell);
      }
    }
  }

  function renderTimeSlots(timeGrid, selectedSlotId, dateKey) {
    var dow = getDayOfWeekFromDateKey(dateKey);
    var defs = dow != null ? getTimeSlotDefsForDayOfWeek(dow) : [];
    timeGrid.innerHTML = '';
    defs.forEach(function (slot) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sched-cal-time-slot';
      btn.dataset.slotId = slot.id;
      btn.setAttribute('aria-label', slot.label);
      btn.textContent = slot.label;
      if (selectedSlotId === slot.id) {
        btn.classList.add('sched-cal-time-slot--selected');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
      timeGrid.appendChild(btn);
    });
  }

  function updateTimeSection(refs, dateKey, selectedSlotId) {
    var wrap = refs.timeWrap;
    var grid = refs.timeGrid;
    if (!dateKey) {
      wrap.hidden = true;
      wrap.setAttribute('aria-hidden', 'true');
      grid.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    wrap.setAttribute('aria-hidden', 'false');
    renderTimeSlots(grid, selectedSlotId, dateKey);
  }

  function updateBookingSection(refs, showFormAndSlot) {
    var slot = refs.bookingSlot;
    var fw = refs.formWrap;
    var ok = refs.successEl;
    var err = refs.errorEl;
    if (!showFormAndSlot) {
      slot.hidden = true;
      slot.setAttribute('aria-hidden', 'true');
      fw.hidden = true;
      ok.hidden = true;
      err.hidden = true;
      return;
    }
    slot.hidden = false;
    slot.setAttribute('aria-hidden', 'false');
    fw.hidden = false;
    ok.hidden = true;
    err.hidden = true;
  }

  function hideSystemMsg(refs) {
    if (!refs.systemMsg) return;
    refs.systemMsg.hidden = true;
    refs.systemMsg.textContent = '';
  }

  function showSystemMsg(refs, msg) {
    if (!refs.systemMsg) return;
    refs.systemMsg.textContent = msg;
    refs.systemMsg.hidden = false;
  }

  function updateNoteCounter(refs) {
    if (!refs.noteCounter || !refs.inputNote) return;
    var len = refs.inputNote.value.length;
    var max = NOTE_MAX_CHARS;
    refs.noteCounter.textContent = len + ' / ' + max;
    refs.noteCounter.classList.toggle('sched-cal-char-counter--warning', len >= max * 0.9);
    refs.noteCounter.classList.toggle('sched-cal-char-counter--danger', len >= max);
  }

  function clearFormFields(refs) {
    refs.form.reset();
    hideSystemMsg(refs);
    refs.form.querySelectorAll('.sched-cal-field-error').forEach(function (el) {
      el.classList.remove('sched-cal-field-error');
    });
    refs.form.querySelectorAll('.sched-cal-input-msg').forEach(function (el) {
      el.remove();
    });
    updateNoteCounter(refs);
  }

  function updateSubmitEnabled(refs) {
    if (!refs.submitBtn) return;
    var consentOk = refs.inputConsent && refs.inputConsent.checked;
    refs.submitBtn.disabled = !consentOk;
    refs.submitBtn.setAttribute('aria-disabled', consentOk ? 'false' : 'true');
  }

  function showSuccess(refs) {
    refs.formWrap.hidden = true;
    refs.successEl.hidden = false;
    refs.errorEl.hidden = true;
  }

  function showErrorPanel(refs) {
    refs.formWrap.hidden = true;
    refs.successEl.hidden = true;
    refs.errorEl.hidden = false;
  }

  function showFormAgain(refs) {
    refs.formWrap.hidden = false;
    refs.successEl.hidden = true;
    refs.errorEl.hidden = true;
  }

  function validateForm(refs) {
    var nameEl = refs.inputName;
    var emailEl = refs.inputEmail;
    var name = (nameEl.value || '').trim();
    var email = (emailEl.value || '').trim();

    refs.form.querySelectorAll('.sched-cal-input-msg').forEach(function (el) {
      el.remove();
    });
    refs.form.querySelectorAll('.sched-cal-field').forEach(function (el) {
      el.classList.remove('sched-cal-field-error');
    });

    var valid = true;

    if (!name) {
      valid = false;
      nameEl.closest('.sched-cal-field').classList.add('sched-cal-field-error');
      appendFieldMsg(nameEl, 'Este campo es obligatorio.');
    }

    if (!email) {
      valid = false;
      emailEl.closest('.sched-cal-field').classList.add('sched-cal-field-error');
      appendFieldMsg(emailEl, 'Este campo es obligatorio.');
    } else if (!EMAIL_REGEX.test(email)) {
      valid = false;
      emailEl.closest('.sched-cal-field').classList.add('sched-cal-field-error');
      appendFieldMsg(emailEl, 'Introduce un correo válido.');
    }

    var consentEl = refs.inputConsent;
    if (consentEl && !consentEl.checked) {
      valid = false;
      consentEl.closest('.sched-cal-field').classList.add('sched-cal-field-error');
      appendFieldMsg(consentEl, 'Debes aceptar la política de privacidad para continuar.');
    }

    return valid;
  }

  function appendFieldMsg(inputEl, msg) {
    var p = document.createElement('p');
    p.className = 'sched-cal-input-msg';
    p.textContent = msg;
    inputEl.parentNode.appendChild(p);
  }

  function ensureModal() {
    var existing = document.getElementById(DIALOG_ID);
    if (existing) return getModalRefs(existing.closest('.sched-cal-root'));

    var root = buildModalMarkup();
    document.body.appendChild(root);
    return getModalRefs(root);
  }

  function getModalRefs(root) {
    var form = root.querySelector('#sched-cal-form');
    return {
      root: root,
      backdrop: root.querySelector('.sched-cal-backdrop'),
      modal: root.querySelector('#' + DIALOG_ID),
      monthLabel: root.querySelector('#sched-cal-month-label'),
      grid: root.querySelector('#sched-cal-grid'),
      weekdays: root.querySelector('#sched-cal-weekdays'),
      btnPrev: root.querySelector('.sched-cal-nav--prev'),
      btnNext: root.querySelector('.sched-cal-nav--next'),
      timeWrap: root.querySelector('#sched-cal-time-wrap'),
      timeGrid: root.querySelector('#sched-cal-time-grid'),
      bookingSlot: root.querySelector('#sched-cal-booking-slot'),
      formWrap: root.querySelector('#sched-cal-form-wrap'),
      form: form,
      submitBtn: root.querySelector('#sched-cal-submit'),
      successEl: root.querySelector('#sched-cal-success'),
      errorEl: root.querySelector('#sched-cal-error'),
      btnSuccessClose: root.querySelector('#sched-cal-success-close'),
      btnErrorRetry: root.querySelector('#sched-cal-error-retry'),
      inputName: root.querySelector('#sched-cal-name'),
      inputEmail: root.querySelector('#sched-cal-email'),
      inputPhone: root.querySelector('#sched-cal-phone'),
      inputNote: root.querySelector('#sched-cal-note'),
      noteCounter: root.querySelector('#sched-cal-note-counter'),
      inputConsent: root.querySelector('#sched-cal-consent'),
      systemMsg: root.querySelector('#sched-cal-system-msg')
    };
  }

  function init() {
    var triggers = document.querySelectorAll('.sched-cta__trigger');
    if (!triggers.length) return;

    var refs = ensureModal();
    renderWeekdayHeaders(refs.weekdays);

    var viewYear;
    var viewMonth;
    var selectedDateKey = null;
    var selectedSlotId = null;

    function syncAppointmentDateInput() {
      var el = document.getElementById('appointment_date');
      if (!el) return;
      if (!selectedDateKey || !selectedSlotId) {
        el.value = '';
        return;
      }
      el.value = selectedDateSummary(selectedDateKey, selectedSlotId);
    }

    function refreshCalendar() {
      renderMonth(refs.grid, refs.monthLabel, viewYear, viewMonth, selectedDateKey);
      updateTimeSection(refs, selectedDateKey, selectedSlotId);
      if (!selectedDateKey || !selectedSlotId) {
        updateBookingSection(refs, false);
        clearFormFields(refs);
      }
      syncAppointmentDateInput();
    }

    function openModal() {
      refs.root.classList.add('is-open');
      refs.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sched-cal-open');
      refreshCalendar();
      refs.btnPrev.onclick = function () {
        var d = new Date(viewYear, viewMonth - 1, 1);
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        selectedDateKey = null;
        selectedSlotId = null;
        refreshCalendar();
        clearFormFields(refs);
        showFormAgain(refs);
        refs.successEl.hidden = true;
        refs.errorEl.hidden = true;
        updateBookingSection(refs, false);
      };
      refs.btnNext.onclick = function () {
        var d = new Date(viewYear, viewMonth + 1, 1);
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        selectedDateKey = null;
        selectedSlotId = null;
        refreshCalendar();
        clearFormFields(refs);
        showFormAgain(refs);
        refs.successEl.hidden = true;
        refs.errorEl.hidden = true;
        updateBookingSection(refs, false);
      };
      setTimeout(function () {
        refs.modal.focus();
      }, 10);
    }

    refs.grid.addEventListener('click', function (ev) {
      var btn = ev.target.closest(
        '.sched-cal-day:not(.sched-cal-day--empty):not(.sched-cal-day--disabled)'
      );
      if (!btn || !refs.grid.contains(btn)) return;
      var key = btn.dataset.dateKey;
      if (!key) return;

      selectedDateKey = key;
      selectedSlotId = null;

      refs.grid
        .querySelectorAll('.sched-cal-day:not(.sched-cal-day--empty):not(.sched-cal-day--disabled)')
        .forEach(function (el) {
        el.classList.remove('sched-cal-day--selected');
        el.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('sched-cal-day--selected');
      btn.setAttribute('aria-pressed', 'true');

      updateTimeSection(refs, selectedDateKey, selectedSlotId);
      updateBookingSection(refs, false);
      clearFormFields(refs);
      showFormAgain(refs);
      refs.successEl.hidden = true;
      refs.errorEl.hidden = true;

      refs.timeGrid.querySelectorAll('.sched-cal-time-slot').forEach(function (el) {
        el.classList.remove('sched-cal-time-slot--selected');
        el.setAttribute('aria-pressed', 'false');
      });

      syncAppointmentDateInput();
    });

    refs.timeGrid.addEventListener('click', function (ev) {
      var slotBtn = ev.target.closest('.sched-cal-time-slot');
      if (!slotBtn || !refs.timeGrid.contains(slotBtn)) return;
      selectedSlotId = slotBtn.dataset.slotId;

      refs.timeGrid.querySelectorAll('.sched-cal-time-slot').forEach(function (el) {
        el.classList.remove('sched-cal-time-slot--selected');
        el.setAttribute('aria-pressed', 'false');
      });
      slotBtn.classList.add('sched-cal-time-slot--selected');
      slotBtn.setAttribute('aria-pressed', 'true');

      updateBookingSection(refs, true);
      showFormAgain(refs);
      refs.successEl.hidden = true;
      refs.errorEl.hidden = true;

      syncAppointmentDateInput();
    });

    refs.form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideSystemMsg(refs);
      if (!validateForm(refs)) return;

      refs.submitBtn.disabled = true;

      var restoreSubmitState = function () {
        setTimeout(function () {
          updateSubmitEnabled(refs);
        }, 1800);
      };

      var payload = {
        from_name: (refs.inputName.value || '').trim(),
        reply_to: (refs.inputEmail.value || '').trim(),
        message: buildBookingWorkerMessage(refs, selectedDateKey, selectedSlotId),
        selected_date: selectedDateSummary(selectedDateKey, selectedSlotId)
      };

      fetch(EMAIL_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.json().then(function (json) {
            return { ok: response.ok, json: json };
          });
        })
        .then(function (res) {
          if (res.ok && res.json && res.json.success) {
            restoreSubmitState();
            clearFormFields(refs);
            updateSubmitEnabled(refs);
            var apEl = document.getElementById('appointment_date');
            if (apEl) apEl.value = '';
            showSuccess(refs);
          } else {
            throw new Error('worker_failed');
          }
        })
        .catch(function () {
          restoreSubmitState();
          updateSubmitEnabled(refs);
          showErrorPanel(refs);
        });
    });

    if (refs.inputConsent) {
      refs.inputConsent.addEventListener('change', function () {
        hideSystemMsg(refs);
        updateSubmitEnabled(refs);
      });
    }

    if (refs.inputNote) {
      function processNoteField() {
        var el = refs.inputNote;
        var v = el.value;
        v = normalizeNoteNewlines(v);
        var stripped = stripNoteDisallowed(v);
        if (stripped !== v) el.value = stripped;
        if (el.value.length > NOTE_MAX_CHARS) {
          el.value = el.value.slice(0, NOTE_MAX_CHARS);
        }
        updateNoteCounter(refs);
      }
      refs.inputNote.addEventListener('input', processNoteField);
      refs.inputNote.addEventListener('paste', function (e) {
        e.preventDefault();
        var pasted = (e.clipboardData || window.clipboardData).getData('text');
        var el = refs.inputNote;
        var start = el.selectionStart;
        var end = el.selectionEnd;
        var cur = el.value;
        var merged = cur.substring(0, start) + pasted + cur.substring(end);
        merged = normalizeNoteNewlines(merged);
        merged = stripNoteDisallowed(merged);
        if (merged.length > NOTE_MAX_CHARS) merged = merged.slice(0, NOTE_MAX_CHARS);
        el.value = merged;
        var pos = Math.min(start + pasted.length, merged.length);
        el.setSelectionRange(pos, pos);
        updateNoteCounter(refs);
      });
      updateNoteCounter(refs);
    }

    refs.btnErrorRetry.addEventListener('click', function () {
      showFormAgain(refs);
      hideSystemMsg(refs);
      updateSubmitEnabled(refs);
    });

    refs.btnSuccessClose.addEventListener('click', function () {
      closeModalAndReset();
      triggers.forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
    });

    function syncOpenFromTrigger() {
      var view = new Date();
      viewYear = view.getFullYear();
      viewMonth = view.getMonth();
      selectedDateKey = null;
      selectedSlotId = null;
      clearFormFields(refs);
      showFormAgain(refs);
      refs.successEl.hidden = true;
      refs.errorEl.hidden = true;
      updateBookingSection(refs, false);
      updateSubmitEnabled(refs);
      openModal();
    }

    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncOpenFromTrigger();
        btn.setAttribute('aria-expanded', 'true');
      });
    });

    function closeModalAndReset() {
      refs.root.classList.remove('is-open');
      refs.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sched-cal-open');
      selectedDateKey = null;
      selectedSlotId = null;
      clearFormFields(refs);
      showFormAgain(refs);
      refs.successEl.hidden = true;
      refs.errorEl.hidden = true;
      updateBookingSection(refs, false);
      if (viewYear != null && viewMonth != null) {
        renderMonth(refs.grid, refs.monthLabel, viewYear, viewMonth, null);
        updateTimeSection(refs, null, null);
      }
      updateSubmitEnabled(refs);
      syncAppointmentDateInput();
    }

    function closeModal() {
      closeModalAndReset();
    }

    refs.root.querySelectorAll('[data-sched-cal-close]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        closeModal();
        triggers.forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
        });
      });
    });

    refs.backdrop.addEventListener('click', function () {
      closeModal();
      triggers.forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
    });

    updateSubmitEnabled(refs);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && refs.root.classList.contains('is-open')) {
        closeModal();
        triggers.forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
