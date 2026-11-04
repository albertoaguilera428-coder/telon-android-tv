/*
Telón - Dominio: orden de las fuentes de video
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

"Calidad preferida" (Ajustes) se guardaba pero nadie la usaba. Aquí se aplica: entre las
fuentes disponibles, primero las que dicen tener esa calidad. Con "Auto" el orden queda
como llegó (el addon que responde primero va primero).
*/
'use strict';

const CALIDAD_AUTOMATICA = 'Auto';

// "1080p" coincide con "1080p", "1080", "FullHD 1080"; no con "10800" ni "21080". Una calidad sin
// número ("Auto") no coincide con nada. Mayúsculas o minúsculas dan igual: solo cuentan los dígitos.
function matchesQuality(fuente, calidad) {
  const numero = String(calidad).replace(/\D/g, '');
  if (!numero) return false;
  const texto = (fuente.name || '') + ' ' + (fuente.title || '');
  return new RegExp('(^|\\D)' + numero + '(\\D|$)').test(texto);
}

// Orden estable: las que coinciden adelante, sin cambiar el orden relativo de ningún grupo.
// Con "Auto" ninguna coincide y el orden queda como llegó. Siempre devuelve una lista nueva.
function rankByQuality(fuentes, calidad) {
  const coinciden = fuentes.filter(f => matchesQuality(f, calidad));
  return [...coinciden, ...fuentes.filter(f => !coinciden.includes(f))];
}

export { CALIDAD_AUTOMATICA, matchesQuality, rankByQuality };
