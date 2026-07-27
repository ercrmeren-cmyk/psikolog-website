/**
 * PSICO-INTERACCIONES (deneysel)
 *
 * 1) Respiración guiada  — 4-4-6 ritminde rehberli nefes egzersizi
 * 2) ¿Te reconoces...?   — kendini tanıma listesi ve sonuç mesajı
 *
 * Bağımsız çalışır; sayfada ilgili bölümler yoksa sessizce çıkar.
 * Geri almak için: bu dosya + css/psico-interacciones.css silinir.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================================
     1) RESPIRACIÓN GUIADA
     ===================================================================== */
  function initBreathing() {
    var root = document.querySelector('[data-breathe]');
    if (!root) return;

    var orb = root.querySelector('[data-breathe-orb]');
    var label = root.querySelector('[data-breathe-label]');
    var status = root.querySelector('[data-breathe-status]');
    var outro = root.querySelector('[data-breathe-outro]');
    var toggle = root.querySelector('[data-breathe-toggle]');
    var toggleLabel = toggle && toggle.querySelector('.pxi-btn__label');
    if (!orb || !label || !toggle) return;

    var PHASES = [
      { key: 'inhala', label: 'Inhala', ms: 4000 },
      { key: 'sosten', label: 'Sostén', ms: 4000 },
      { key: 'exhala', label: 'Exhala', ms: 6000 }
    ];
    var TOTAL_CYCLES = 3;

    var timerId = null;
    var running = false;
    var phaseIndex = 0;
    var cycle = 0;

    function setPhase(phase) {
      // her fazın kendi süresi kadar sürsün; azaltılmış hareket modunda anında
      var duration = reduceMotion ? 1 : phase.ms;
      orb.style.setProperty('--pxi-phase-ms', duration + 'ms');
      [].forEach.call(orb.querySelectorAll('.pxi-orb__core, .pxi-orb__ring'), function (el) {
        el.style.transitionDuration = duration + 'ms';
      });
      orb.dataset.phase = phase.key;
      label.textContent = phase.label;
      if (status) {
        status.textContent = 'Ciclo ' + (cycle + 1) + ' de ' + TOTAL_CYCLES;
      }
    }

    function step() {
      var phase = PHASES[phaseIndex];
      setPhase(phase);

      timerId = window.setTimeout(function () {
        phaseIndex += 1;
        if (phaseIndex >= PHASES.length) {
          phaseIndex = 0;
          cycle += 1;
          if (cycle >= TOTAL_CYCLES) {
            finish();
            return;
          }
        }
        step();
      }, phase.ms);
    }

    function start() {
      running = true;
      cycle = 0;
      phaseIndex = 0;
      if (outro) outro.hidden = true;
      if (toggleLabel) toggleLabel.textContent = 'Detener';
      toggle.setAttribute('aria-pressed', 'true');
      step();
    }

    function stop(silent) {
      running = false;
      window.clearTimeout(timerId);
      timerId = null;
      orb.dataset.phase = 'exhala';
      label.textContent = 'Respira';
      if (toggleLabel) toggleLabel.textContent = 'Empezar';
      toggle.setAttribute('aria-pressed', 'false');
      if (status && !silent) status.textContent = '';
    }

    function finish() {
      stop(true);
      if (status) status.textContent = 'Ejercicio completado';
      if (outro) outro.hidden = false;
      if (toggleLabel) toggleLabel.textContent = 'Repetir';
    }

    toggle.addEventListener('click', function () {
      if (running) {
        stop();
      } else {
        start();
      }
    });

    // sekme arka plana alınırsa ritim kayar; durdur
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && running) stop();
    });
  }

  /* =====================================================================
     2) ¿TE RECONOCES EN ESTO?
     ===================================================================== */
  function initMirror() {
    var root = document.querySelector('[data-mirror]');
    if (!root) return;

    var buttons = [].slice.call(root.querySelectorAll('[data-mirror-item]'));
    var fill = root.querySelector('[data-mirror-fill]');
    var count = root.querySelector('[data-mirror-count]');
    var result = root.querySelector('[data-mirror-result]');
    var resultTitle = root.querySelector('[data-mirror-result-title]');
    var resultText = root.querySelector('[data-mirror-result-text]');
    if (!buttons.length) return;

    var total = buttons.length;

    // Eşik değerleri büyükten küçüğe taranır: seçilen sayıya uyan ilk mesaj alınır.
    var MESSAGES = [
      {
        min: 6,
        title: 'Llevas demasiado tiempo en alerta',
        text: 'Cuando tantas frases resuenan a la vez, no hablamos de un mal día: hablamos de un cuerpo y una mente que llevan mucho tiempo sosteniendo la tensión. Eso agota a cualquiera, y no tienes que seguir sosteniéndolo sola.'
      },
      {
        min: 3,
        title: 'Esto no es debilidad, es un patrón',
        text: 'Lo que has marcado no dice nada malo de ti. Son formas que aprendiste para protegerte y que hoy te están pesando. Los patrones se pueden entender y se pueden cambiar; ese es justo el trabajo que hacemos en terapia.'
      },
      {
        min: 1,
        title: 'Aunque parezcan pocas, cuentan',
        text: 'Puede que no sean muchas, pero si te acompañan casi todos los días, ya están ocupando espacio. No hace falta llegar al límite para pedir ayuda.'
      },
      {
        min: 0,
        title: 'Quizá no era por ti',
        text: 'No has marcado ninguna, y está bien. Aun así, algo te ha traído hasta aquí. A veces merece la pena escuchar eso, aunque todavía no tenga nombre.'
      }
    ];

    function selectedCount() {
      return buttons.filter(function (b) {
        return b.getAttribute('aria-pressed') === 'true';
      }).length;
    }

    function messageFor(n) {
      for (var i = 0; i < MESSAGES.length; i += 1) {
        if (n >= MESSAGES[i].min) return MESSAGES[i];
      }
      return MESSAGES[MESSAGES.length - 1];
    }

    var revealTimer = null;

    function update() {
      var n = selectedCount();

      if (fill) fill.style.transform = 'scaleX(' + (n / total) + ')';
      if (count) {
        count.textContent = n === 0
          ? 'Ninguna marcada todavía'
          : 'Has marcado ' + n + ' de ' + total;
      }

      // Sonucu her tıklamada değil, kullanıcı durakladıktan sonra göster;
      // böylece seçim yaparken araya girmez.
      window.clearTimeout(revealTimer);

      if (n === 0) {
        if (result) {
          result.classList.remove('is-visible');
          result.hidden = true;
        }
        return;
      }

      revealTimer = window.setTimeout(function () {
        var msg = messageFor(n);
        if (resultTitle) resultTitle.textContent = msg.title;
        if (resultText) resultText.textContent = msg.text;
        if (result) {
          result.hidden = false;
          // hidden kaldırıldıktan sonra reflow'u zorla; aksi halde tarayıcı
          // iki stili tek karede birleştirir ve geçiş hiç oynamaz
          void result.offsetWidth;
          result.classList.add('is-visible');
        }
      }, 900);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
        update();
      });
    });

    update();
  }

  function init() {
    initBreathing();
    initMirror();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
