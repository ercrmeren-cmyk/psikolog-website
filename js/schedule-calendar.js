/**
 * Self-contained scheduling calendar modal (vanilla JS).
 * Opens from .sched-cta__trigger; modal appended once to document.body.
 *
 * EmailJS: replace placeholders in EMAILJS_CONFIG with your dashboard values.
 * Template variables: selected_date, selected_time, user_name, user_email, user_phone, user_note,
 *                    recaptcha_token. Keep RECAPTCHA_SITE_KEY in sync with the reCAPTCHA script URL on each page.
 * GDPR: users must accept the privacy policy checkbox before submit.
 */
(function () {
  'use strict';

  /** ——— Google reCAPTCHA v3 — replace YOUR_SITE_KEY with https://www.google.com/recaptcha/admin ——— */
  var RECAPTCHA_SITE_KEY = 'YOUR_SITE_KEY';

  /** ——— EmailJS: replace with your real IDs from https://dashboard.emailjs.com ——— */
  var EMAILJS_CONFIG = {
    publicKey: 'YOUR_PUBLIC_KEY',
    serviceId: 'YOUR_SERVICE_ID',
    templateId: 'YOUR_TEMPLATE_ID'
  };

  var DIALOG_ID = 'sched-calendar-dialog';
  var MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  /** Monday-first weekday labels (Lunes … Domingo) */
  var WD_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Escape HTML-special characters before values are emailed (mitigates XSS in downstream templates). */
  function sanitizeInput(str) {
    if (str == null) return '';
    var s = String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  function prepareNoteForSubmit(raw) {
    var s = (raw || '').trim();
    s = normalizeNoteNewlines(s);
    s = stripNoteDisallowed(s);
    if (s.length > NOTE_MAX_CHARS) s = s.slice(0, NOTE_MAX_CHARS);
    return sanitizeInput(s);
  }

  /** One-hour slots 09:00–17:00 (labels for UI) */
  function getTimeSlotDefs() {
    var slots = [];
    for (var h = 9; h < 17; h++) {
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

  function getSlotById(id) {
    var defs = getTimeSlotDefs();
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
          var isWeekend = dow === 0 || dow === 6;
          var todayStart = new Date(todayY, todayM, todayD);
          var cellStart = new Date(y, m, d);
          var isPast = cellStart.getTime() < todayStart.getTime();
          var isDisabled = isPast || isWeekend;

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

  function renderTimeSlots(timeGrid, selectedSlotId) {
    var defs = getTimeSlotDefs();
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
    renderTimeSlots(grid, selectedSlotId);
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

  function placeholdersStillDefault() {
    return (
      EMAILJS_CONFIG.publicKey.indexOf('YOUR_') === 0 ||
      EMAILJS_CONFIG.serviceId.indexOf('YOUR_') === 0 ||
      EMAILJS_CONFIG.templateId.indexOf('YOUR_') === 0
    );
  }

  /**
   * Returns a reCAPTCHA v3 token, or a sentinel when the site key is still a placeholder.
   * Rejects if the library failed to load or execute (caller shows a friendly message).
   */
  function getRecaptchaToken() {
    return new Promise(function (resolve, reject) {
      if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY.indexOf('YOUR_') === 0) {
        resolve('pending_recaptcha_configuration');
        return;
      }
      if (typeof grecaptcha === 'undefined' || typeof grecaptcha.ready !== 'function') {
        reject(new Error('recaptcha_unavailable'));
        return;
      }
      grecaptcha.ready(function () {
        grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: 'booking_request' })
          .then(resolve)
          .catch(function () {
            reject(new Error('recaptcha_execute_failed'));
          });
      });
    });
  }

  function sendWithEmailJS(templateParams) {
    if (typeof emailjs === 'undefined' || !emailjs.send) {
      return Promise.reject(new Error('EmailJS no cargó'));
    }

    if (placeholdersStillDefault()) {
      return Promise.reject(new Error('Configura EmailJS en EMAILJS_CONFIG'));
    }

    /** @emailjs/browser v4: init(publicKey), then send(serviceId, templateId, params) — no 4th arg */
    if (typeof emailjs.init === 'function') {
      try {
        emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
      } catch (e1) {
        try {
          emailjs.init(EMAILJS_CONFIG.publicKey);
        } catch (e2) { /* ignore */ }
      }
    }

    return emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams
    );
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

    function refreshCalendar() {
      renderMonth(refs.grid, refs.monthLabel, viewYear, viewMonth, selectedDateKey);
      updateTimeSection(refs, selectedDateKey, selectedSlotId);
      if (!selectedDateKey || !selectedSlotId) {
        updateBookingSection(refs, false);
        clearFormFields(refs);
      }
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

      getRecaptchaToken()
        .then(function (token) {
          var slotInfo = getSlotById(selectedSlotId);
          var templateParams = {
            selected_date: formatDateSpanish(selectedDateKey),
            selected_time: slotInfo ? slotInfo.compact : '',
            user_name: sanitizeInput((refs.inputName.value || '').trim()),
            user_email: sanitizeInput((refs.inputEmail.value || '').trim()),
            user_phone: sanitizeInput((refs.inputPhone.value || '').trim()),
            user_note: prepareNoteForSubmit(refs.inputNote.value),
            recaptcha_token: token
          };
          return sendWithEmailJS(templateParams);
        })
        .then(
          function () {
            restoreSubmitState();
            clearFormFields(refs);
            updateSubmitEnabled(refs);
            showSuccess(refs);
          },
          function (err) {
            restoreSubmitState();
            var code = err && err.message;
            if (code === 'recaptcha_unavailable' || code === 'recaptcha_execute_failed') {
              showSystemMsg(
                refs,
                'No se pudo completar la verificación de seguridad. Por favor, recarga la página e inténtalo de nuevo.'
              );
              updateSubmitEnabled(refs);
              return;
            }
            showErrorPanel(refs);
          }
        );
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
