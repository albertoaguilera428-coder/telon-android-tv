/*
Telón - Dominio: orden de las fuentes de video
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

"Calidad preferida" (Ajustes) se guardaba pero nadie la usaba. Aquí se aplica: entre las
fuentes disponibles, primero las que dicen tener esa calidad. Con "Auto" el orden queda
como llegó (el addon que responde primero va primero).
*/
(function (Telon) {
  'use strict';

  const CALIDAD_AUTOMATICA = 'Auto';

  // "1080p" coincide con "1080p", "1080", "FullHD 1080"; no con "10800" ni "21080".
  function matchesQuality(fuente, calidad) {
    const numero = String(calidad).replace(/\D/g, '');
    if (!numero) return false;
    const texto = ((fuente.name || '') + ' ' + (fuente.title || '')).toLowerCase();
    return new RegExp('(^|\\D)' + numero + '(p|\\D|$)').test(texto);
  }

  // Orden estable: las que coinciden adelante, sin cambiar el orden relativo de ningún grupo.
  function rankByQuality(fuentes, calidad) {
    if (!calidad || calidad === CALIDAD_AUTOMATICA) return fuentes.slice();
    return [...fuentes.filter(f => matchesQuality(f, calidad)), ...fuentes.filter(f => !matchesQuality(f, calidad))];
  }

  Telon.domain.sources = { CALIDAD_AUTOMATICA, matchesQuality, rankByQuality };
})(window.Telon = window.Telon || {});
