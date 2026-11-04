/*
Telón - Registro de errores que no interrumpen al usuario
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Hay fallos esperables (un addon caído, un subtítulo que no baja) en los que lo correcto
es seguir con lo que hay. No los tragamos en silencio: quedan en la consola, que se ve
desde chrome://inspect en Android y desde Tizen Studio en Samsung.
*/
(function (Telon) {
  'use strict';

  function logIgnored(contexto, error) {
    console.warn('[Telón] ' + contexto, error);
  }

  Telon.infra = Telon.infra || {};
  Telon.infra.log = { logIgnored };
})(window.Telon = window.Telon || {});
