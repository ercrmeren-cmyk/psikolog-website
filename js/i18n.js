/**
 * UI strings generated from JavaScript (toasts, validation, calendar, interactive sections).
 * Static page text lives in the HTML (ES) and i18n/en.json (EN, built by tools/build-en.mjs).
 * The active language is read from <html lang>.
 */
(function () {
  'use strict';

  var STRINGS = {
    es: {
      'toast.close': 'Cerrar',
      'error.generic': 'Algo salió mal. Por favor, actualiza la página.',
      'error.connection': 'Error de conexión. Por favor, inténtalo de nuevo.',

      'form.tooManyBlankLines': 'No se permiten más de 2 líneas vacías consecutivas.',
      'form.minChars': 'El mensaje debe contener al menos 10 caracteres significativos (letras o números).',
      'form.required': 'Por favor, complete todos los campos.',
      'form.invalidEmail': 'Por favor, ingrese un correo electrónico válido.',
      'form.sending': 'Enviando...',
      'form.sentInline': '¡Tu mensaje se ha enviado correctamente!',
      'form.sentToast': '¡Mensaje enviado con éxito!',
      'form.failInline': 'No se pudo enviar el mensaje. Inténtelo de nuevo más tarde.',
      'form.failToast': 'Ocurrió un error al enviar. Inténtelo de nuevo más tarde.',

      'plan.individual': 'Sesión individual — €85',
      'plan.primera': 'Primera cita — €70',
      'plan.bono4': 'Bono 4 sesiones — €320',

      'carousel.dot': 'Grupo {n} de {total}',
      'lightbox.label': 'Vista ampliada del testimonio',
      'lightbox.close': 'Cerrar vista ampliada',

      'cal.months': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      'cal.weekdays': ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
      'cal.date': '{d} de {month} de {y}',
      'cal.unavailable': ', no disponible',
      'cal.today': ', hoy',
      'cal.title': 'Disponibilidad',
      'cal.closeCalendar': 'Cerrar calendario',
      'cal.subtitle': 'Selecciona un día para consultar disponibilidad (próximamente podrás enviar tu solicitud).',
      'cal.prevMonth': 'Mes anterior',
      'cal.nextMonth': 'Mes siguiente',
      'cal.timeHeading': 'Franja horaria',
      'cal.formHeading': 'Datos de reserva',
      'cal.name': 'Nombre',
      'cal.email': 'Correo electrónico',
      'cal.phone': 'Teléfono',
      'cal.note': 'Nota',
      'cal.notePlaceholder': 'Motivo de consulta (opcional)',
      'cal.consent': 'He leído y acepto la {link}.',
      'cal.consentLink': 'política de privacidad',
      'cal.secure': 'Tus datos están seguros y se transmiten cifrados.',
      'cal.submit': 'Reservar cita',
      'cal.success': 'Gracias. Hemos recibido tu solicitud. Recibirás un correo electrónico de confirmación cuando procesemos tu petición. También te contactaremos pronto para confirmar la cita.',
      'cal.close': 'Cerrar',
      'cal.error': 'Hubo un problema. Por favor, intenta de nuevo o contáctanos directamente.',
      'cal.retry': 'Reintentar',
      'cal.required': 'Este campo es obligatorio.',
      'cal.invalidEmail': 'Introduce un correo válido.',
      'cal.consentRequired': 'Debes aceptar la política de privacidad para continuar.',
      'cal.mail.title': 'Reserva (calendario web)',
      'cal.mail.date': 'Fecha',
      'cal.mail.slot': 'Franja',
      'cal.mail.phone': 'Teléfono',
      'cal.mail.note': 'Nota',

      'breathe.inhale': 'Inhala',
      'breathe.hold': 'Sostén',
      'breathe.exhale': 'Exhala',
      'breathe.idle': 'Respira',
      'breathe.cycle': 'Ciclo {n} de {total}',
      'breathe.done': 'Ejercicio completado',
      'breathe.start': 'Empezar',
      'breathe.stop': 'Detener',
      'breathe.repeat': 'Repetir',

      'mirror.none': 'Ninguna marcada todavía',
      'mirror.count': 'Has marcado {n} de {total}',
      'mirror.high.title': 'Llevas demasiado tiempo en alerta',
      'mirror.high.text': 'Cuando tantas frases resuenan a la vez, no hablamos de un mal día: hablamos de un cuerpo y una mente que llevan mucho tiempo sosteniendo la tensión. Eso agota a cualquiera, y no tienes que seguir sosteniéndolo sola.',
      'mirror.mid.title': 'Esto no es debilidad, es un patrón',
      'mirror.mid.text': 'Lo que has marcado no dice nada malo de ti. Son formas que aprendiste para protegerte y que hoy te están pesando. Los patrones se pueden entender y se pueden cambiar; ese es justo el trabajo que hacemos en terapia.',
      'mirror.low.title': 'Aunque parezcan pocas, cuentan',
      'mirror.low.text': 'Puede que no sean muchas, pero si te acompañan casi todos los días, ya están ocupando espacio. No hace falta llegar al límite para pedir ayuda.',
      'mirror.zero.title': 'Quizá no era por ti',
      'mirror.zero.text': 'No has marcado ninguna, y está bien. Aun así, algo te ha traído hasta aquí. A veces merece la pena escuchar eso, aunque todavía no tenga nombre.'
    },

    en: {
      'toast.close': 'Close',
      'error.generic': 'Something went wrong. Please refresh the page.',
      'error.connection': 'Connection error. Please try again.',

      'form.tooManyBlankLines': 'No more than two consecutive blank lines are allowed.',
      'form.minChars': 'Your message must contain at least 10 meaningful characters (letters or numbers).',
      'form.required': 'Please fill in all fields.',
      'form.invalidEmail': 'Please enter a valid email address.',
      'form.sending': 'Sending...',
      'form.sentInline': 'Your message has been sent successfully!',
      'form.sentToast': 'Message sent successfully!',
      'form.failInline': 'Your message could not be sent. Please try again later.',
      'form.failToast': 'Something went wrong while sending. Please try again later.',

      'plan.individual': 'Individual session — €85',
      'plan.primera': 'First appointment — €70',
      'plan.bono4': '4-session package — €320',

      'carousel.dot': 'Group {n} of {total}',
      'lightbox.label': 'Enlarged view of testimonial',
      'lightbox.close': 'Close enlarged view',

      'cal.months': ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'],
      'cal.weekdays': ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      'cal.date': '{d} {month} {y}',
      'cal.unavailable': ', unavailable',
      'cal.today': ', today',
      'cal.title': 'Availability',
      'cal.closeCalendar': 'Close calendar',
      'cal.subtitle': 'Select a day to check availability and request an appointment.',
      'cal.prevMonth': 'Previous month',
      'cal.nextMonth': 'Next month',
      'cal.timeHeading': 'Time slot',
      'cal.formHeading': 'Booking details',
      'cal.name': 'Name',
      'cal.email': 'Email',
      'cal.phone': 'Phone',
      'cal.note': 'Note',
      'cal.notePlaceholder': 'Reason for your enquiry (optional)',
      'cal.consent': 'I have read and accept the {link}.',
      'cal.consentLink': 'privacy policy',
      'cal.secure': 'Your details are kept secure and sent encrypted.',
      'cal.submit': 'Book appointment',
      'cal.success': 'Thank you, we have received your request. You will receive a confirmation email once it has been processed, and we will be in touch shortly to confirm your appointment.',
      'cal.close': 'Close',
      'cal.error': 'Something went wrong. Please try again or contact us directly.',
      'cal.retry': 'Try again',
      'cal.required': 'This field is required.',
      'cal.invalidEmail': 'Please enter a valid email address.',
      'cal.consentRequired': 'You must accept the privacy policy to continue.',
      'cal.mail.title': 'Booking (website calendar)',
      'cal.mail.date': 'Date',
      'cal.mail.slot': 'Time slot',
      'cal.mail.phone': 'Phone',
      'cal.mail.note': 'Note',

      'breathe.inhale': 'Breathe in',
      'breathe.hold': 'Hold',
      'breathe.exhale': 'Breathe out',
      'breathe.idle': 'Breathe',
      'breathe.cycle': 'Cycle {n} of {total}',
      'breathe.done': 'Exercise complete',
      'breathe.start': 'Start',
      'breathe.stop': 'Stop',
      'breathe.repeat': 'Repeat',

      'mirror.none': 'None selected yet',
      'mirror.count': 'You’ve selected {n} of {total}',
      'mirror.high.title': 'You’ve been on high alert for too long',
      'mirror.high.text': 'When so many of these resonate at once, it isn’t just a bad day: it’s a body and mind that have been holding tension for a long time. That would exhaust anyone, and you don’t have to keep carrying it alone.',
      'mirror.mid.title': 'This isn’t weakness, it’s a pattern',
      'mirror.mid.text': 'What you’ve selected says nothing bad about you. These are ways you learnt to protect yourself, and today they’re weighing you down. Patterns can be understood and they can change; that’s exactly the work we do in therapy.',
      'mirror.low.title': 'They may seem few, but they count',
      'mirror.low.text': 'There may not be many, but if they’re with you almost every day, they’re already taking up space. You don’t need to reach breaking point to ask for help.',
      'mirror.zero.title': 'Perhaps this isn’t about you',
      'mirror.zero.text': 'You haven’t selected any, and that’s fine. Even so, something brought you here. Sometimes it’s worth listening to that, even if it doesn’t have a name yet.'
    }
  };

  var htmlLang = (document.documentElement.getAttribute('lang') || 'es').slice(0, 2).toLowerCase();
  var lang = STRINGS[htmlLang] ? htmlLang : 'es';

  function t(key, vars) {
    var value = STRINGS[lang][key];
    if (value == null) value = STRINGS.es[key];
    if (value == null) {
      console.warn('[i18n] missing key:', key);
      return key;
    }
    if (vars && typeof value === 'string') {
      value = value.replace(/\{(\w+)\}/g, function (m, name) {
        return vars[name] != null ? String(vars[name]) : m;
      });
    }
    return value;
  }

  window.PSIKO_I18N = { lang: lang, t: t, strings: STRINGS };
})();
