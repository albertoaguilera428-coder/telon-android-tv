/*
Telón - Polyfills
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Los televisores Samsung de 2020 (Tizen 5.5) traen un Chromium 69. La sintaxis moderna la
rebaja esbuild al empaquetar el .wgt, pero las funciones nuevas del lenguaje hay que
rellenarlas a mano. Solo agregamos las que la app usa de verdad.
*/
(function () {
  'use strict';

  // ============================================================
  // Promise.allSettled (Chromium 76+)
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
