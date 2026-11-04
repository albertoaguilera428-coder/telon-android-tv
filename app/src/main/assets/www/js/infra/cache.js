/*
Telón - Caché en memoria (cache-aside) con tamaño máximo
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Guarda por un rato lo que ya descargamos de los sitios (catálogos, búsquedas, fichas)
para no repetir el trabajo. No es la fuente de verdad: si se borra, se vuelve a pedir.

  - Tamaño máximo y vida útil: al llenarse descarta lo usado hace más tiempo (LRU); en una
    sesión larga en un televisor (poca memoria) no puede crecer sin fin.
  - Una sola carga por clave: si cuatro catálogos piden la misma búsqueda a la vez, sale
    una petición y los cuatro reciben el resultado (evita la estampida).
  - Los errores no se guardan: el siguiente pedido vuelve a intentar.
  - Lo guardado se congela: todos reciben el mismo objeto y nadie puede cambiarlo por los demás.

Se apoya en Map, que conserva el orden de inserción: volver a insertar una clave al leerla
la pasa al final, así la primera es siempre la menos usada. Leer, guardar y descartar
cuestan O(1).
*/
(function (Telon) {
  'use strict';

  // ============================================================
  // AYUDAS
  // ============================================================

  function deepFreeze(valor) {
    if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
      Object.freeze(valor);
      Object.values(valor).forEach(deepFreeze);
    }
    return valor;
  }

  // ============================================================
  // CACHÉ
  // ============================================================

  function createBoundedCache({ maximo, vidaMs }) {
    const entradas = new Map();
    // Cargas en curso por clave (single-flight): mientras una está en vuelo, los demás la esperan.
    const enCurso = new Map();
    const metricas = { aciertos: 0, fallos: 0, descartes: 0, cargasCompartidas: 0 };

    function get(clave) {
      const entrada = entradas.get(clave);
      if (!entrada) { metricas.fallos++; return undefined; }
      entradas.delete(clave);
      if (Date.now() - entrada.ts >= vidaMs) { metricas.fallos++; return undefined; }
      entradas.set(clave, entrada);
      metricas.aciertos++;
      return entrada.valor;
    }

    function set(clave, valor) {
      entradas.delete(clave);
      entradas.set(clave, { valor: deepFreeze(valor), ts: Date.now() });
      if (entradas.size > maximo) {
        entradas.delete(entradas.keys().next().value);
        metricas.descartes++;
      }
    }

    function getOrLoad(clave, cargador) {
      if (enCurso.has(clave)) {
        metricas.cargasCompartidas++;
        return enCurso.get(clave);
      }
      const guardado = get(clave);
      if (guardado !== undefined) return Promise.resolve(guardado);
      // La carga arranca ya (como antes de la caché); si el cargador lanza, se vuelve un rechazo.
      const carga = new Promise(resolver => resolver(cargador())).then(valor => {
        set(clave, valor);
        return entradas.get(clave).valor;
      });
      enCurso.set(clave, carga);
      // Se quita al terminar, bien o mal: un error no queda guardado como si fuera el valor.
      const liberar = () => { if (enCurso.get(clave) === carga) enCurso.delete(clave); };
      carga.then(liberar, liberar);
      return carga;
    }

    // Invalidación explícita: cuando el usuario pide recargar, la caché no puede ganarle.
    function clear() {
      entradas.clear();
      enCurso.clear();
    }

    const stats = () => ({ ...metricas, tamano: entradas.size, maximo });

    return { get, set, getOrLoad, clear, stats, size: () => entradas.size };
  }

  Telon.infra.cache = { createBoundedCache };
})(window.Telon = window.Telon || {});
