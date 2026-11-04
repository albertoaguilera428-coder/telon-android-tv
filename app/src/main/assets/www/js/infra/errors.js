/*
Telón - Tipos de error
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Distinguir qué falló permite decidir qué hacer: esperar ante un 429, avisar ante un
servidor caído, no confundir un dato inválido con un problema de red. Todos heredan de
Error (sirven donde se espera un Error y conservan la causa original) y su mensaje ya
está en español, listo para mostrar.
*/
(function (Telon) {
  'use strict';

  // ============================================================
  // TIPOS
  // ============================================================

  class TelonError extends Error {
    constructor(mensaje, opciones) {
      super(mensaje, opciones);
      this.name = new.target.name;
    }
  }

  class HttpError extends TelonError {
    constructor(status, opciones) {
      super('el servidor respondió con un error (HTTP ' + status + ')', opciones);
      this.status = status;
    }
  }

  class TimeoutError extends TelonError {
    constructor(opciones) { super('tiempo de espera agotado: el servidor tardó demasiado', opciones); }
  }

  class RateLimitError extends TelonError {
    constructor(segundos) {
      super('el servidor pidió esperar; reintenta en ' + segundos + ' s');
      this.segundos = segundos;
    }
  }

  class QueueFullError extends TelonError {
    constructor() { super('demasiadas peticiones en espera; inténtalo en un momento'); }
  }

  class NetworkError extends TelonError {
    constructor(opciones) { super('no se pudo conectar con el servidor', opciones); }
  }

  class InvalidDataError extends TelonError {}

  // Firebase identifica sus errores con un código (EMAIL_EXISTS, INVALID_PASSWORD…).
  class AuthError extends TelonError {
    constructor(codigo) {
      super('error de autenticación (' + codigo + ')');
      this.code = codigo;
    }
  }

  // ============================================================
  // MENSAJES PARA EL USUARIO
  // ============================================================

  // Nuestros errores ya tienen un mensaje pensado para mostrarse. Cualquier otro (un
  // "Unexpected token < in JSON" o un fallo de programación) no se muestra tal cual: queda
  // en la consola con logIgnored y el usuario ve un mensaje estable.
  function userMessageFor(error) {
    if (error instanceof TelonError) return error.message;
    // Por nombre y no con instanceof: así también reconoce errores creados en otro contexto (iframe, worker).
    // Un TypeError no se traduce como "sin conexión": también es el error típico de un bug. Los
    // fallos de red reales ya llegan como NetworkError desde infra/http.js.
    if (error && error.name === 'SyntaxError') return 'la respuesta del servidor no es válida';
    return 'ocurrió un error inesperado';
  }

  Telon.infra.errors = { TelonError, HttpError, TimeoutError, RateLimitError, QueueFullError, NetworkError, InvalidDataError, AuthError, userMessageFor };
})(window.Telon = window.Telon || {});
