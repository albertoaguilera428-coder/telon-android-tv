/*
Telón - Almacenamiento local
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Envoltura mínima de localStorage con prefijo y JSON. Solo la usan los repositorios de
app/state.js: las pantallas nunca leen ni escriben aquí directamente.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const PREFIJO_ALMACEN = 'telon.';

  const store = {
    get(clave, porDefecto) {
      try {
        const valor = localStorage.getItem(PREFIJO_ALMACEN + clave);
        return valor ? JSON.parse(valor) : porDefecto;
      } catch (error) {
        logIgnored('No se pudo leer ' + clave + ' del almacenamiento', error);
        return porDefecto;
      }
    },
    set(clave, valor) {
      try {
        localStorage.setItem(PREFIJO_ALMACEN + clave, JSON.stringify(valor));
      } catch (error) {
        // Si localStorage se llena, perdemos este guardado pero la app sigue viva.
        logIgnored('No se pudo guardar ' + clave, error);
      }
    },
    clearAll() {
      localStorage.clear();
    }
  };

  Telon.infra.storage = { store };
})(window.Telon = window.Telon || {});
