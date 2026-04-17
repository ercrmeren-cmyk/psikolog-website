// js/script.js - Versión final optimizada con validación de textarea
(function(){
  'use strict';

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

  // Reemplazar formulario para limpiar listeners antiguos
  const oldForm = document.getElementById('contactForm');
  if (oldForm) {
    const newForm = oldForm.cloneNode(true);
    oldForm.parentNode.replaceChild(newForm, oldForm);
  }
  initContactForm();

 // ========== MOBİL MENÜ (SAĞLAM VERSİYON) ==========
(function() {
  // Menü öğelerini her seferinde yeniden seç (sayfa değişse bile çalışsın)
  function initMobileMenu() {
    const toggleBtn = document.getElementById('menuToggle');
    const nav = document.getElementById('mainNav');
    
    if (!toggleBtn || !nav) return;
    
    // Eski event listener'ları temizlemek için yeni bir klon oluştur (opsiyonel)
    // Bu, aynı butona birden fazla listener eklenmesini engeller
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    // Menüyü aç/kapat
    newToggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      nav.classList.toggle('active');
    });
    
    // Menü içindeki linklere tıklanınca menüyü kapat
    const navLinks = nav.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('active');
      });
    });
    
    // Sayfa dışına tıklanınca menüyü kapat (opsiyonel)
    document.addEventListener('click', function(event) {
      if (nav.classList.contains('active') && 
          !nav.contains(event.target) && 
          event.target !== newToggleBtn) {
        nav.classList.remove('active');
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

})();