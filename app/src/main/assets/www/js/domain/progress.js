/*
Telón - Dominio: progreso e historial
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Qué se guarda de lo que vas viendo, cuándo un episodio cuenta como terminado y qué
aparece en "Continuar viendo". Lógica pura: la hora llega como parámetro.
*/
(function (Telon) {
  'use strict';

  const { episodeLabel } = Telon.domain.episodes;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Suficiente para "Continuar viendo" sin que el historial crezca sin límite en el almacenamiento.
  const MAXIMO_HISTORIAL = 60;
  const MAXIMO_CONTINUAR_VIENDO = 10;
  // Si quedan menos de 3 segundos lo damos por visto, para que "Continuar" no reabra los créditos.
  const MARGEN_FINAL_S = 3;
  // Menos de un segundo visto no es progreso: es haber abierto el episodio.
  const MINIMO_SEGUNDOS_VISTOS = 1;

  // ============================================================
  // REGLAS
  // ============================================================

  const refKey = r => r.base + '|' + r.type + '|' + r.id;

  // Los nombres de campo (key, idx, t, dur, ts…) son los que ya están guardados en los dispositivos.
  function buildHistoryEntry({ referencia, ficha, episodios, indice, clave }, segundos, duracion, ahora) {
    return { key: clave, base: referencia.base, type: referencia.type, id: referencia.id, name: ficha.name, poster: ficha.poster,
      idx: indice, videoId: episodios[indice].id, label: episodeLabel(episodios, indice), total: episodios.length,
      t: duracion && segundos > duracion - MARGEN_FINAL_S ? 0 : segundos, dur: duracion, ts: ahora };
  }

  const progressPercent = entrada => entrada.dur ? Math.min(100, Math.round(entrada.t / entrada.dur * 100)) : 0;

  // Conserva las entradas más recientes; el orden de inserción del objeto queda de más nueva a más vieja.
  function trimHistory(historial, maximo = MAXIMO_HISTORIAL) {
    const recortado = {};
    Object.values(historial).sort((a, b) => b.ts - a.ts).slice(0, maximo).forEach(e => { recortado[e.key] = e; });
    return recortado;
  }

  const sortByRecent = historial => Object.values(historial).sort((a, b) => b.ts - a.ts);

  const continueWatching = historial => sortByRecent(historial)
    .filter(e => e.t > MINIMO_SEGUNDOS_VISTOS).slice(0, MAXIMO_CONTINUAR_VIENDO);

  // Solo se retoma en el mismo episodio y con el mismo video que se guardó.
  const resumePosition = (entrada, indice, idVideo) => entrada && entrada.idx === indice && entrada.videoId === idVideo ? entrada.t : 0;

  Telon.domain.progress = { refKey, buildHistoryEntry, progressPercent, trimHistory, sortByRecent, continueWatching, resumePosition };
})(window.Telon = window.Telon || {});
