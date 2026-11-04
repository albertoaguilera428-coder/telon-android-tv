/*
Telón - Polyfills
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Los televisores Samsung más viejos que soportamos (2021, Tizen 6.5) traen Chromium 85. La
sintaxis moderna la rebaja esbuild al empaquetar el .wgt; las funciones nuevas del
lenguaje se rellenan aquí. Solo agregamos las que la app usa de verdad.
*/
(function () {
  'use strict';

  // ============================================================
  // Promise.allSettled (Chromium 76+): ya viene en Tizen 6.5; queda por navegadores de escritorio viejos.
  // ============================================================
  if (typeof Promise.allSettled !== 'function') {
    Promise.allSettled = function (promesas) {
      return Promise.all(Array.from(promesas, promesa => Promise.resolve(promesa).then(
        value => ({ status: 'fulfilled', value }),
        reason => ({ status: 'rejected', reason })
      )));
    };
  }
})();
