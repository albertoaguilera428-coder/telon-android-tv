/*
Telón - Dominio: datos de la cuenta
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Validamos antes de llamar a Firebase para dar el mensaje en español y ahorrar la petición.
*/
(function (Telon) {
  'use strict';

  const LARGO_MINIMO_CLAVE = 6;

  function validateRegistration(nombre, correo, clave) {
    if (!nombre.trim()) return 'Escribe tu nombre';
    if (!correo.trim()) return 'Escribe tu correo';
    if (clave.length < LARGO_MINIMO_CLAVE) return 'La contraseña debe tener al menos 6 caracteres';
    return null;
  }

  const validateLogin = (correo, clave) => !correo.trim() || !clave ? 'Escribe correo y contraseña' : null;

  Telon.domain.account = { LARGO_MINIMO_CLAVE, validateRegistration, validateLogin };
})(window.Telon = window.Telon || {});
