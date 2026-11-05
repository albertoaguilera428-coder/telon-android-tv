/*
Telón - Dominio: sesión de reproducción
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lo que se está viendo y sus reglas: qué episodio, qué fuente, a qué velocidad, con o sin
sonido y cómo se ven los subtítulos. Los datos se leen como propiedades pero solo cambian
a través de los métodos, que cuidan los límites (la línea de subtítulos va de −12 a −1,
no se pasa de la última fuente, el episodio existe…). Así ninguna pantalla puede dejar la
sesión en un estado inválido. No conoce el <video> ni el DOM: eso es de la pantalla.
*/
'use strict';

import { refKey } from './progress.js';

// ============================================================
// CONSTANTES
// ============================================================

const VELOCIDADES = [1, 1.5, 1.8, 2];
// La línea es la posición vertical de WebVTT contada desde abajo (−1 pegado al borde).
const LIMITES_SUBTITULOS = Object.freeze({
  linea: Object.freeze({ min: -12, max: -1, porDefecto: -4 }),
  tamano: Object.freeze({ min: 12, max: 36, porDefecto: 20 })
});

const clamp = (valor, min, max) => Math.max(min, Math.min(max, valor));
const toNumberOr = (valor, porDefecto) => (Number.isFinite(Number(valor)) && valor !== null && valor !== '' ? Number(valor) : porDefecto);

// ============================================================
// SESIÓN
// ============================================================

function createPlaybackSession({ referencia, ficha, episodios, indice = 0, subsActivos = true, lineaSubs, tamanoSubs }) {
  if (!episodios || !episodios.length) throw new RangeError('una sesión de reproducción necesita al menos un episodio');
  const listaEpisodios = Object.freeze(episodios.slice());
  const ultimoEpisodio = listaEpisodios.length - 1;
  const { linea: LINEA, tamano: TAMANO } = LIMITES_SUBTITULOS;

  // Estado privado: solo estos métodos lo cambian.
  let indiceActual = clamp(Math.trunc(toNumberOr(indice, 0)), 0, ultimoEpisodio);
  let fuentes = Object.freeze([]);
  let indiceFuente = 0;
  // Cada carga de episodio recibe un número; las respuestas de cargas anteriores se descartan.
  let token = 0;
  let velocidad = VELOCIDADES[0];
  let silenciado = false;
  let subtitulos = Boolean(subsActivos);
  let linea = clamp(toNumberOr(lineaSubs, LINEA.porDefecto), LINEA.min, LINEA.max);
  let tamano = clamp(toNumberOr(tamanoSubs, TAMANO.porDefecto), TAMANO.min, TAMANO.max);

  const sesion = {
    // ---------- Episodios ----------
    canMove: direccion => indiceActual + direccion >= 0 && indiceActual + direccion <= ultimoEpisodio,
    // Empieza la carga de otro episodio: olvida las fuentes y devuelve el número de esta carga.
    selectEpisode(i) {
      if (!Number.isInteger(i) || i < 0 || i > ultimoEpisodio) throw new RangeError('no existe el episodio ' + i);
      indiceActual = i;
      fuentes = Object.freeze([]);
      indiceFuente = 0;
      return ++token;
    },
    isCurrentLoad: numero => numero === token,
    // Al cerrar: cualquier respuesta que llegue después ya no aplica.
    invalidate() { token++; },

    // ---------- Fuentes ----------
    setSources(lista) {
      fuentes = Object.freeze(lista.slice());
      indiceFuente = 0;
    },
    // La lista completa puede llegar en otro orden que la primera: la fuente que se está
    // reproduciendo conserva su lugar para no saltar a otra.
    replaceSources(lista) {
      const actual = fuentes[indiceFuente];
      fuentes = Object.freeze(lista.slice());
      indiceFuente = Math.max(0, fuentes.indexOf(actual));
    },
    selectSource(i) {
      if (!Number.isInteger(i) || i < 0 || i >= fuentes.length) return false;
      indiceFuente = i;
      return true;
    },
    // Si la fuente actual falla: pasa a la siguiente, o devuelve false si no quedan.
    advanceSource() {
      if (indiceFuente >= fuentes.length - 1) return false;
      indiceFuente++;
      return true;
    },

    // ---------- Ajustes ----------
    cycleSpeed() {
      velocidad = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length];
      return velocidad;
    },
    toggleMute() { silenciado = !silenciado; return silenciado; },
    toggleSubtitles() { subtitulos = !subtitulos; return subtitulos; },
    moveSubtitleLine(delta) { linea = clamp(linea + delta, LINEA.min, LINEA.max); return linea; },
    resizeSubtitles(delta) { tamano = clamp(tamano + delta, TAMANO.min, TAMANO.max); return tamano; }
  };

  const soloLectura = getter => ({ get: getter, enumerable: true });
  Object.defineProperties(sesion, {
    referencia: soloLectura(() => referencia),
    ficha: soloLectura(() => ficha),
    clave: soloLectura(() => refKey(referencia)),
    episodios: soloLectura(() => listaEpisodios),
    indice: soloLectura(() => indiceActual),
    episodio: soloLectura(() => listaEpisodios[indiceActual]),
    fuentes: soloLectura(() => fuentes),
    indiceFuente: soloLectura(() => indiceFuente),
    fuenteActual: soloLectura(() => fuentes[indiceFuente]),
    velocidad: soloLectura(() => velocidad),
    silenciado: soloLectura(() => silenciado),
    subsActivos: soloLectura(() => subtitulos),
    lineaSubs: soloLectura(() => linea),
    tamanoSubs: soloLectura(() => tamano)
  });
  return Object.freeze(sesion);
}

export { VELOCIDADES, LIMITES_SUBTITULOS, createPlaybackSession };
