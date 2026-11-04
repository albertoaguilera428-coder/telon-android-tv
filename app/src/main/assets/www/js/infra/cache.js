/*
Telón - Caché en memoria con tamaño máximo
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Las cachés de los addons virtuales guardaban cada búsqueda y cada ficha para siempre: en
una sesión larga en un televisor (poca memoria) eso solo crece. Esta caché tiene un tope
y una vida útil; al llenarse descarta la entrada usada hace más tiempo (LRU).

Se apoya en Map, que conserva el orden de inserción: volver a insertar una clave al
leerla la pasa al final, así la primera es siempre la menos usada. Leer, guardar y
descartar cuestan O(1).
*/
(function (Telon) {
  'use strict';

  function createBoundedCache({ maximo, vidaMs }) {
    const entradas = new Map();

    function get(clave) {
      const entrada = entradas.get(clave);
      if (!entrada) return undefined;
      entradas.delete(clave);
      if (Date.now() - entrada.ts >= vidaMs) return undefined;
      entradas.set(clave, entrada);
      return entrada.valor;
    }

    function set(clave, valor) {
      entradas.delete(clave);
      entradas.set(clave, { valor, ts: Date.now() });
      if (entradas.size > maximo) entradas.delete(entradas.keys().next().value);
    }

    // Si dos pantallas piden lo mismo mientras carga, cada una hace su petición: preferimos eso
    // a mantener promesas pendientes en la caché y tener que limpiarlas cuando fallan.
    async function getOrLoad(clave, cargador) {
      const guardado = get(clave);
      if (guardado !== undefined) return guardado;
      const valor = await cargador();
      set(clave, valor);
      return valor;
    }

    return { get, set, getOrLoad, size: () => entradas.size };
  }

  Telon.infra.cache = { createBoundedCache };
})(window.Telon = window.Telon || {});
