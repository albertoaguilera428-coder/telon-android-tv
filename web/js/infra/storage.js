/*
Telón - Almacenamiento local
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Envoltura mínima de localStorage con prefijo y JSON. Solo la usan los repositorios de
app/state.js: las pantallas nunca leen ni escriben aquí directamente.
*/
'use strict';

import { logIgnored } from './log.js';
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
  // Devuelve false si no se pudo guardar (por ejemplo, almacenamiento lleno) para que quien
  // llama pueda avisarle al usuario en vez de dar por hecho algo que no pasó.
  set(clave, valor) {
    try {
      localStorage.setItem(PREFIJO_ALMACEN + clave, JSON.stringify(valor));
      return true;
    } catch (error) {
      logIgnored('No se pudo guardar ' + clave, error);
      return false;
    }
  },
  clearAll() {
    localStorage.clear();
  }
};

export { store };
