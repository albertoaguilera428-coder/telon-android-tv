/*
Telón - Control remoto de TV
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Recibe las teclas del control (MainActivity en Android TV, el adaptador de plataforma en
Samsung) como códigos de Android KeyEvent. Con el reproductor abierto controlan el
video; en el resto de la app mueven el foco al elemento más cercano en esa dirección.
*/
(function (Telon) {
  'use strict';

  const { estado } = Telon.state;
  const { closePlayer, loadVideo, togglePlayback } = Telon.ui.player;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Códigos de android.view.KeyEvent.
  const TECLA = {
    ARRIBA: 19, ABAJO: 20, IZQUIERDA: 21, DERECHA: 22, CENTRO: 23, ENTER: 66,
    PLAY_PAUSA: 85, STOP: 86, SIGUIENTE: 87, ANTERIOR: 88, RETROCEDER: 89, ADELANTAR: 90, PLAY: 126, PAUSA: 127
  };
  const SALTO_SEGUNDOS = 10;
  // Tolerancia en px para no saltar a un elemento que está "casi" en la misma línea del lado contrario.
  const UMBRAL_DIRECCION_PX = 20;
  const DIRECCION_POR_TECLA = { 19: 'up', 20: 'down', 21: 'left', 22: 'right' };

  // ============================================================
  // NAVEGACIÓN POR FOCO
  // ============================================================

  const centerOf = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

  function isInDirection(direccion, dx, dy) {
    if (direccion === 'right') return dx >= UMBRAL_DIRECCION_PX;
    if (direccion === 'left') return dx <= -UMBRAL_DIRECCION_PX;
    if (direccion === 'down') return dy >= UMBRAL_DIRECCION_PX;
    return dy <= -UMBRAL_DIRECCION_PX;
  }

  // Preferimos lo que está en la misma fila (o columna); lo demás se penaliza fuerte para que el
  // foco no salte en diagonal a otra sección cuando todavía quedan tarjetas en la fila actual.
  function scoreCandidate(direccion, rectActual, dx, dy) {
    if (direccion === 'left' || direccion === 'right') {
      const mismaFila = Math.abs(dy) < Math.max(rectActual.height * 0.7, 25);
      return mismaFila ? Math.abs(dx) : Math.abs(dx) + Math.abs(dy) * 10;
    }
    const mismaColumna = Math.abs(dx) < Math.max(rectActual.width * 0.7, 25);
    return mismaColumna ? Math.abs(dy) : Math.abs(dy) + Math.abs(dx) * 3;
  }

  // Lógica pura: recibe rectángulos y devuelve el índice del mejor candidato (o -1).
  function pickNextFocus(rectActual, rectsCandidatos, direccion) {
    const origen = centerOf(rectActual);
    let mejor = -1, mejorPuntaje = Infinity;
    rectsCandidatos.forEach((rect, i) => {
      const destino = centerOf(rect);
      const dx = destino.x - origen.x, dy = destino.y - origen.y;
      if (!isInDirection(direccion, dx, dy)) return;
      const puntaje = scoreCandidate(direccion, rectActual, dx, dy);
      if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = i; }
    });
    return mejor;
  }

  function listFocusable() {
    return [...document.querySelectorAll('button,a,input,[tabindex]')].filter(elemento => {
      if (elemento.hidden || elemento.offsetParent === null) return false;
      const rect = elemento.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function moveTvFocus(direccion) {
    const enfocables = listFocusable();
    if (!enfocables.length) return;
    const actual = document.activeElement;
    if (!actual || actual === document.body || !enfocables.includes(actual)) {
      // Por separado a propósito: con una lista de selectores querySelector devuelve el primero
      // en el orden del documento, no la pestaña activa.
      const primero = document.querySelector('#nav button.on') || document.querySelector('#nav button') || enfocables[0];
      if (primero) primero.focus();
      return;
    }
    const candidatos = enfocables.filter(elemento => elemento !== actual);
    const indice = pickNextFocus(actual.getBoundingClientRect(), candidatos.map(c => c.getBoundingClientRect()), direccion);
    if (indice < 0) return;
    candidatos[indice].focus();
    candidatos[indice].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ============================================================
  // TECLAS CON EL REPRODUCTOR ABIERTO
  // ============================================================

  const playOrIgnore = v => v.play().catch(() => {});
  const seekBack = v => { v.currentTime = Math.max(0, v.currentTime - SALTO_SEGUNDOS); };
  // Adelantar sí se topa con la duración; retroceder no la necesita (en vivo puede no existir).
  const seekForward = v => { v.currentTime = Math.min(v.duration || 0, v.currentTime + SALTO_SEGUNDOS); };
  const goToEpisode = (reproductor, salto) => {
    const destino = reproductor.indice + salto;
    if (destino >= 0 && destino < reproductor.episodios.length) loadVideo(destino);
  };
  const doNothing = () => {};

  // Arriba y abajo se ignoran a propósito: en el reproductor no hay a dónde mover el foco y no
  // queremos que se salga del video.
  const ACCIONES_REPRODUCTOR = {
    [TECLA.PLAY_PAUSA]: r => togglePlayback(r.video),
    [TECLA.CENTRO]: r => togglePlayback(r.video),
    [TECLA.ENTER]: r => togglePlayback(r.video),
    [TECLA.PLAY]: r => playOrIgnore(r.video),
    [TECLA.PAUSA]: r => r.video.pause(),
    [TECLA.STOP]: () => closePlayer(),
    [TECLA.RETROCEDER]: r => seekBack(r.video),
    [TECLA.IZQUIERDA]: r => seekBack(r.video),
    [TECLA.ADELANTAR]: r => seekForward(r.video),
    [TECLA.DERECHA]: r => seekForward(r.video),
    [TECLA.SIGUIENTE]: r => goToEpisode(r, 1),
    [TECLA.ANTERIOR]: r => goToEpisode(r, -1),
    [TECLA.ARRIBA]: doNothing,
    [TECLA.ABAJO]: doNothing
  };

  // Devuelve true si la tecla ya se atendió.
  function handlePlayerKey(reproductor, codigoTecla) {
    if (!Object.prototype.hasOwnProperty.call(ACCIONES_REPRODUCTOR, codigoTecla)) return false;
    ACCIONES_REPRODUCTOR[codigoTecla](reproductor);
    return true;
  }

  function handleTvKey(codigoTecla) {
    const reproductor = estado.reproductor;
    if (reproductor && reproductor.video && handlePlayerKey(reproductor, codigoTecla)) return;
    if (codigoTecla === TECLA.CENTRO || codigoTecla === TECLA.ENTER) {
      const enfocado = document.activeElement;
      if (enfocado && enfocado !== document.body) enfocado.click();
      return;
    }
    if (DIRECCION_POR_TECLA[codigoTecla]) moveTvFocus(DIRECCION_POR_TECLA[codigoTecla]);
  }

  // Nombre histórico: MainActivity llama window._tvKey desde onKeyDown.
  window._tvKey = handleTvKey;

  Telon.ui.tvRemote = { TECLA, pickNextFocus, moveTvFocus, handleTvKey };
})(window.Telon = window.Telon || {});
