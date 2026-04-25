// js/script.js - Versión final optimizada con validación de textarea
(function(){
  'use strict';
  if (window.__psychSiteScriptInitialized) return;
  window.__psychSiteScriptInitialized = true;

  /* ---------- FUNCIONES AUXILIARES (TOAST) ---------- */
  function showToast(message, type = 'info', duration = 5000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    
    let icon = '💬';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-content">${message}</span>
      <button class="toast-close" aria-label="Cerrar">×</button>
    `;
    
    container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      setTimeout(() => toast.remove(), 300);
    };
    
    closeBtn.addEventListener('click', removeToast);
    if (duration > 0) setTimeout(removeToast, duration);
  }

  // Manejo global de errores (Español)
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('Error detectado:', {message, source, lineno, colno});
    showToast('Algo salió mal. Por favor, actualiza la página.', 'error', 6000);
    return true;
  };

  window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada:', event.reason);
    showToast('Error de conexión. Por favor, inténtalo de nuevo.', 'error', 5000);
    event.preventDefault();
  });

  // Limpieza de consola en producción
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
  }

  /* ---------- CARGA INICIAL (LOADER) ---------- */
  function initPageLoader() {
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.innerHTML = '<div class="loader-spinner"></div>';
    document.body.prepend(loader);
    
    window.addEventListener('load', function() {
      setTimeout(() => {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 500);
      }, 200);
    });
    
    setTimeout(() => {
      if (loader.parentNode) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 500);
      }
    }, 3000);
  }
  initPageLoader();

  /* ---------- IMÁGENES (LAZY + FADE-IN) ---------- */
  function enhanceImages() {
    const handleImage = (img) => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'));
        img.addEventListener('error', () => {
          img.classList.add('loaded');
          img.style.backgroundColor = '#f0f4f8';
        });
      }
      if (img.src.startsWith('data:')) img.classList.add('loaded');
    };

    document.querySelectorAll('img').forEach(handleImage);
    
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mut => {
        mut.addedNodes.forEach(node => {
          if (node.nodeName === 'IMG') handleImage(node);
          else if (node.nodeType === 1 && node.querySelectorAll) {
            node.querySelectorAll('img').forEach(handleImage);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  enhanceImages();

  /* ---------- VALIDACIÓN DE TEXTAREA (LÍNEAS VACÍAS Y CARACTERES) ---------- */
  function setupTextareaValidation() {
    const textarea = document.getElementById('message');
    if (!textarea) return;

    // Normalizar: máximo 2 saltos de línea consecutivos
    function normalizeNewlines(text) {
      return text.replace(/\n{3,}/g, '\n\n');
    }

    // Contar caracteres significativos (letras y números, excluyendo espacios y saltos)
    function countMeaningfulChars(text) {
      return text.replace(/[\s\n]/g, '').length;
    }

    // Mostrar advertencia si hay demasiadas líneas vacías
    function handleInput() {
      let value = textarea.value;
      const normalized = normalizeNewlines(value);
      
      if (normalized !== value) {
        textarea.value = normalized;
        // Mantener cursor al final
        textarea.setSelectionRange(normalized.length, normalized.length);
      }

      // Si el texto original tenía 3+ saltos, mostramos toast informativo
      if (/\n{3,}/.test(value)) {
        showToast('No se permiten más de 2 líneas vacías consecutivas.', 'info', 2000);
      }

      // Actualizar contador de caracteres (si existe)
      const charCounter = document.getElementById('charCounter');
      if (charCounter) {
        const len = textarea.value.length;
        const max = parseInt(textarea.getAttribute('maxlength'), 10);
        charCounter.textContent = len + ' / ' + max;
        charCounter.classList.toggle('warning', len >= max * 0.9);
        charCounter.classList.toggle('danger', len >= max);
      }
    }

    // Manejar pegado (paste) con normalización
    function handlePaste(e) {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      
      let newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
      newValue = normalizeNewlines(newValue);
      
      textarea.value = newValue;
      textarea.setSelectionRange(start + pastedText.length, start + pastedText.length);
      handleInput(); // Actualizar contador y validaciones visuales
    }

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('paste', handlePaste);
    
    // Validación extra al enviar el formulario: trim y mínimo 10 caracteres significativos
    const form = document.getElementById('contactForm');
    if (form) {
      form.addEventListener('submit', function(e) {
        let message = textarea.value;
        message = message.trim();
        message = normalizeNewlines(message);
        textarea.value = message;
        
        const meaningful = countMeaningfulChars(message);
        if (meaningful < 10) {
          e.preventDefault();
          showToast('El mensaje debe contener al menos 10 caracteres significativos (letras o números).', 'error', 4000);
          return false;
        }
      });
    }
    
    handleInput(); // Inicializar contador
  }

  /* ---------- FORMULARIO DE CONTACTO (ENVÍO) ---------- */
  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Enviar';
    const FORMSPREE_URL = 'https://formspree.io/f/xxxxx'; // Reemplazar con URL real

    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    const messageField = document.getElementById('message');
    const charCounter = document.getElementById('charCounter');

    // Inicializar validación de textarea
    setupTextareaValidation();

    // Contador de caracteres adicional (por si setupTextareaValidation no lo cubre)
    if (messageField && charCounter) {
      const updateCounter = () => {
        const len = messageField.value.length;
        const max = parseInt(messageField.getAttribute('maxlength'), 10);
        charCounter.textContent = len + ' / ' + max;
        charCounter.classList.toggle('warning', len >= max * 0.9);
        charCounter.classList.toggle('danger', len >= max);
      };
      messageField.addEventListener('input', updateCounter);
      updateCounter();
    }

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Validación básica
      if (!nameField.value.trim() || !emailField.value.trim() || !messageField.value.trim()) {
        showToast('Por favor, complete todos los campos.', 'error');
        return;
      }
      
      const email = emailField.value.trim();
      if (!/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(email)) {
        showToast('Por favor, ingrese un correo electrónico válido.', 'error');
        return;
      }
      
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }
      
      const formData = new FormData(form);
      
      try {
        if (FORMSPREE_URL.includes('xxxxx')) {
          // Modo prueba
          console.log('Datos del formulario (prueba):', Object.fromEntries(formData));
          await new Promise(resolve => setTimeout(resolve, 1000));
          showToast('¡Mensaje enviado con éxito!', 'success');
          form.reset();
          if (charCounter) charCounter.textContent = '0 / 500';
        } else {
          const response = await fetch(FORMSPREE_URL, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
          });
          if (response.ok) {
            showToast('¡Mensaje enviado con éxito!', 'success', 6000);
            form.reset();
            if (charCounter) charCounter.textContent = '0 / 500';
          } else {
            throw new Error('Error del servidor');
          }
        }
      } catch (error) {
        console.error('Error al enviar el formulario:', error);
        showToast('Ocurrió un error al enviar. Inténtelo de nuevo más tarde.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }

  initContactForm();

  /* ---------- CARRUSEL TESTIMONIOS (INICIO) ---------- */
  function initHomeReviewsCarousel() {
    const root = document.getElementById('home-reviews-carousel');
    if (!root || root.dataset.carouselInitialized === 'true') return;
    root.dataset.carouselInitialized = 'true';

    const track = document.getElementById('home-reviews-track');
    const viewport = root.querySelector('.home-reviews-carousel__viewport');
    const prevBtn = root.querySelector('.home-reviews-carousel__btn--prev');
    const nextBtn = root.querySelector('.home-reviews-carousel__btn--next');
    const dotsWrap = root.querySelector('.home-reviews-carousel__dots');
    if (!track || !viewport || !prevBtn || !nextBtn || !dotsWrap) return;

    const slides = Array.from(track.querySelectorAll('.home-reviews-carousel__slide'));
    const total = slides.length;
    if (total === 0) return;

    let index = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    function loadSlideImages(slideEl) {
      if (!slideEl) return;
      slideEl.querySelectorAll('img.home-reviews-carousel__img--lazy[data-src]').forEach(img => {
        const url = img.getAttribute('data-src');
        if (!url) return;
        img.removeAttribute('data-src');
        img.classList.remove('home-reviews-carousel__img--lazy');
        img.removeAttribute('loading');
        img.setAttribute('loading', 'eager');
        img.src = url;
      });
    }

    function syncUI() {
      track.style.setProperty('--home-carousel-index', String(index));
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === total - 1;
      slides.forEach((slide, i) => {
        slide.classList.toggle('home-reviews-carousel__slide--active', i === index);
      });
      dotsWrap.querySelectorAll('.home-reviews-carousel__dot').forEach((dot, i) => {
        const selected = i === index;
        dot.setAttribute('aria-selected', selected ? 'true' : 'false');
        dot.tabIndex = selected ? 0 : -1;
      });
    }

    function setIndex(next) {
      const clamped = Math.max(0, Math.min(total - 1, next));
      index = clamped;
      syncUI();
      loadSlideImages(slides[index]);
    }

    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'home-reviews-carousel__dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Grupo ${i + 1} de ${total}`);
      dot.addEventListener('click', () => setIndex(i));
      dotsWrap.appendChild(dot);
    });

    prevBtn.addEventListener('click', () => setIndex(index - 1));
    nextBtn.addEventListener('click', () => setIndex(index + 1));

    viewport.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex(index + 1);
      }
    });

    viewport.addEventListener(
      'touchstart',
      e => {
        if (!e.changedTouches.length) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true }
    );
    viewport.addEventListener(
      'touchend',
      e => {
        if (!e.changedTouches.length) return;
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) setIndex(index + 1);
        else setIndex(index - 1);
      },
      { passive: true }
    );

    setIndex(0);
  }

  function initHomeReviewsLightbox(carouselRoot) {
    if (!carouselRoot || carouselRoot.dataset.lightboxInitialized === 'true') return;
    carouselRoot.dataset.lightboxInitialized = 'true';

    let activeOverlay = null;
    let onKeyDown = null;

    function resolveImgUrl(img) {
      const ds = img.getAttribute('data-src');
      if (ds) return ds;
      const s = img.currentSrc || img.src;
      if (s && !s.startsWith('data:image/svg+xml')) return s;
      return '';
    }

    function closeLightbox() {
      if (!activeOverlay) return;
      const el = activeOverlay;
      activeOverlay.classList.remove('is-open');
      document.body.style.overflow = '';
      if (onKeyDown) {
        document.removeEventListener('keydown', onKeyDown);
        onKeyDown = null;
      }
      activeOverlay = null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.remove();
      };
      el.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 480);
    }

    function openLightbox(img) {
      const url = resolveImgUrl(img);
      if (!url) return;

      document.querySelectorAll('.home-reviews-lightbox').forEach(n => n.remove());
      document.body.style.overflow = '';
      if (onKeyDown) {
        document.removeEventListener('keydown', onKeyDown);
        onKeyDown = null;
      }
      activeOverlay = null;

      const overlay = document.createElement('div');
      overlay.className = 'home-reviews-lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Vista ampliada del testimonio');

      overlay.innerHTML =
        '<button type="button" class="home-reviews-lightbox__backdrop" aria-label="Cerrar vista ampliada"></button>' +
        '<div class="home-reviews-lightbox__inner">' +
        '<img class="home-reviews-lightbox__img" src="" alt="" decoding="async" />' +
        '</div>';

      const imgEl = overlay.querySelector('.home-reviews-lightbox__img');
      const backdrop = overlay.querySelector('.home-reviews-lightbox__backdrop');
      imgEl.src = url;
      imgEl.alt = img.alt || '';

      document.body.appendChild(overlay);
      activeOverlay = overlay;

      onKeyDown = function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeLightbox();
        }
      };
      document.addEventListener('keydown', onKeyDown);

      backdrop.addEventListener('click', closeLightbox);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('is-open'));
      });
    }

    carouselRoot.addEventListener('dblclick', function (e) {
      const img = e.target.closest('.home-review-card__img');
      if (!img || !carouselRoot.contains(img)) return;
      e.preventDefault();
      openLightbox(img);
    });
  }

  initHomeReviewsCarousel();

  (function () {
    const root = document.getElementById('home-reviews-carousel');
    if (root) initHomeReviewsLightbox(root);
  })();

 // ========== MOBİL MENÜ (SAĞLAM VERSİYON) ==========
(function() {
  // Menü öğelerini her seferinde yeniden seç (sayfa değişse bile çalışsın)
  function initMobileMenu() {
    const toggleBtn = document.getElementById('menuToggle');
    const nav = document.getElementById('mainNav');
    
    if (!toggleBtn || !nav) return;

    if (toggleBtn.dataset.menuInitialized === 'true') return;
    toggleBtn.dataset.menuInitialized = 'true';

    // Menüyü aç/kapat
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      nav.classList.toggle('active');
      toggleBtn.setAttribute('aria-expanded', nav.classList.contains('active') ? 'true' : 'false');
    });
    
    // Menü içindeki linklere tıklanınca menüyü kapat
    const navLinks = nav.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
    
    // Sayfa dışına tıklanınca menüyü kapat (opsiyonel)
    document.addEventListener('click', function(event) {
      if (nav.classList.contains('active') && 
          !nav.contains(event.target) && 
          event.target !== toggleBtn) {
        nav.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
  
  // Sayfa yüklendiğinde ve her sayfa değişiminde (SPA değil ama yine de)
  initMobileMenu();
  
  // Eğer sayfa dinamik olarak değişiyorsa (Turbolinks vb. yok) sorun yok.
  // Ancak yine de her yüklemede çalışacak.
})();

  /* ---------- SLIDER ---------- */
  const slides = document.querySelectorAll('.slide');
  const dotsContainer = document.getElementById('sliderDots');
  let currentSlide = 0;
  let slideInterval;

  function renderDots() {
    if(!dotsContainer) return;
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.classList.add('dot');
      if(idx === currentSlide) dot.classList.add('active');
      dot.addEventListener('click', () => goToSlide(idx));
      dotsContainer.appendChild(dot);
    });
  }

  function goToSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    slides.forEach((s,i) => s.classList.toggle('active', i === index));
    currentSlide = index;
    renderDots();
  }

  function nextSlide() { goToSlide(currentSlide + 1); }
  function prevSlide() { goToSlide(currentSlide - 1); }

  if(slides.length > 0) {
    renderDots();
    goToSlide(0);
    slideInterval = setInterval(nextSlide, 5000);
    document.getElementById('prevSlide')?.addEventListener('click', () => {
      prevSlide();
      clearInterval(slideInterval);
      slideInterval = setInterval(nextSlide, 5000);
    });
    document.getElementById('nextSlide')?.addEventListener('click', () => {
      nextSlide();
      clearInterval(slideInterval);
      slideInterval = setInterval(nextSlide, 5000);
    });
  }

  /* ---------- FADE-IN OBSERVER ---------- */
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

  /* ---------- SMOOTH SCROLL ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if(target) {
        e.preventDefault();
        target.scrollIntoView({behavior:'smooth'});
      }
    });
  });

  const cards = document.querySelectorAll('.p-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = 'opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.35s ease';
    observer.observe(card);
  });

  const sCards = document.querySelectorAll('.s-card');
  const sObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 120);
        sObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  sCards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(28px)';
    card.style.transition = 'opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.38s ease';
    sObserver.observe(card);
  });

  /* ---------- FAQ Accordion ---------- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-question').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        b.nextElementSibling.classList.remove('is-open');
      });
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        btn.nextElementSibling.classList.add('is-open');
      }
    });
  });

  const tCards = document.querySelectorAll('.mastesti-card');
  const tObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 130);
        tObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  tCards.forEach(card => {
    card.style.transition = 'opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.38s ease';
    tObserver.observe(card);
  });

})();