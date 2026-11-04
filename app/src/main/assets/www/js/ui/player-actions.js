/*
Telón - Acciones del reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Qué hace cada botón del reproductor (atributo data-p). Una tabla en lugar de una cadena
de if: agregar un botón es agregar una entrada.
*/
(function (Telon) {
  'use strict';

  const { estado, preferencias } = Telon.app.state;
  const { $ } = Telon.ui.dom;
  const { toggleLib } = Telon.ui.detail;
  const { updatePlayerUI, playerSheet } = Telon.ui.playerView;
  const { setTracksVisible, applyCueStyle, flashSubtitleHint } = Telon.ui.playerSubtitles;
  const { closePlayer, loadVideo, playStream, saveProgress, scheduleHideUi, togglePlayback } = Telon.ui.player;

  const OCULTAR_UI_TRAS_TOQUE_MS = 3000;

  // ============================================================
  // TOQUE EN EL VIDEO
  // ============================================================

  // Primer toque muestra los controles; con los controles a la vista, el toque pausa o reanuda.
  function handleTap(reproductor) {
    if (reproductor.deslizado || reproductor.panel) return;
    const contenedor = $('#player');
    if (contenedor.classList.contains('hide-ui')) {
      contenedor.classList.remove('hide-ui');
      scheduleHideUi(reproductor, OCULTAR_UI_TRAS_TOQUE_MS);
    } else {
      togglePlayback(reproductor.video);
    }
  }

  function updateSubtitleSetting(reproductor, cambio) {
    applyCueStyle(reproductor);
    flashSubtitleHint(cambio.valor, cambio.etiqueta);
    playerSheet('subs');
  }

  // ============================================================
  // TABLA DE ACCIONES (data-p)
  // ============================================================

  const ACCIONES_REPRODUCTOR = {
    keep: () => {},
    tap: handleTap,
    back: () => closePlayer(),
    subs: () => playerSheet('subs'),
    subtoggle: reproductor => {
      reproductor.sesion.toggleSubtitles();
      setTracksVisible(reproductor, reproductor.sesion.subsActivos);
      updatePlayerUI();
      playerSheet('subs');
    },
    subpos: (reproductor, argumento) => {
      preferencias.saveSubtitleLine(reproductor.sesion.moveSubtitleLine(+argumento));
      updateSubtitleSetting(reproductor, { valor: +argumento < 0 ? '▲' : '▼', etiqueta: 'Posición' });
    },
    subsize: (reproductor, argumento) => {
      preferencias.saveSubtitleSize(reproductor.sesion.resizeSubtitles(+argumento));
      updateSubtitleSetting(reproductor, { valor: reproductor.sesion.tamanoSubs + 'px', etiqueta: 'Tamaño' });
    },
    mute: reproductor => {
      reproductor.video.muted = reproductor.sesion.toggleMute();
      updatePlayerUI();
    },
    save: reproductor => { toggleLib(reproductor.sesion.referencia); updatePlayerUI(); },
    eps: () => playerSheet('eps'),
    sources: () => playerSheet('src'),
    closesheet: () => playerSheet(null),
    pseason: (reproductor, argumento) => { estado.temporadaReproductor = +argumento; playerSheet('eps'); },
    ep: (reproductor, argumento) => {
      playerSheet(null);
      if (+argumento === reproductor.sesion.indice) return;
      saveProgress(true);
      loadVideo(+argumento);
    },
    // Al cambiar de fuente seguimos desde el mismo segundo.
    src: (reproductor, argumento) => {
      playerSheet(null);
      if (!reproductor.sesion.selectSource(+argumento)) return;
      reproductor.reanudarEn = reproductor.video.currentTime;
      playStream();
    },
    speed: reproductor => {
      reproductor.video.playbackRate = reproductor.sesion.cycleSpeed();
      updatePlayerUI();
    },
    retry: reproductor => loadVideo(reproductor.sesion.indice)
  };

  function playerClick(evento) {
    const reproductor = estado.reproductor;
    if (!reproductor) return;
    const boton = evento.target.closest('[data-p]');
    if (!boton) return;
    const [accion, argumento] = boton.dataset.p.split(':');
    if (Object.prototype.hasOwnProperty.call(ACCIONES_REPRODUCTOR, accion)) ACCIONES_REPRODUCTOR[accion](reproductor, argumento);
  }

  Telon.ui.playerActions = { playerClick };
})(window.Telon = window.Telon || {});
