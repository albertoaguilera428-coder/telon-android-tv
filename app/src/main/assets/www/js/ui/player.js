/*
Telón - Reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

El núcleo de la reproducción con el <video> nativo: abre y cierra el reproductor, busca
fuentes en todos los addons, arranca con la primera que llega, cambia de fuente si una
falla, pasa de episodio y guarda el progreso para "Continuar viendo".

Lo que se dibuja vive en player-view.js, los subtítulos en player-subtitles.js y lo que
hace cada botón en player-actions.js.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const plataforma = Telon.infra.platform;
  const { resumePosition } = Telon.domain.progress;
  const { createPlaybackSession } = Telon.domain.playbackSession;
  const { estado, updateState, preferencias, findAddon } = Telon.app.state;
  const { fetchFullMeta } = Telon.app.catalogService;
  const playback = Telon.app.playbackService;
  const { $ } = Telon.ui.dom;
  const { toast } = Telon.ui.components;
  const { playerTemplateHTML, setCenter, setProgressBar, updatePlayerUI, playerSheet } = Telon.ui.playerView;
  const subtitulos = Telon.ui.playerSubtitles;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const OCULTAR_UI_TRAS_REPRODUCIR_MS = 2000;
  const GUARDAR_PROGRESO_CADA_MS = 3000;
  // Algunos reproductores agregan las pistas de subtítulos tarde; reintentamos activarlas un rato.
  const REINTENTOS_SUBTITULOS = 10;
  const ANIMACION_CAMBIO_EPISODIO_MS = 220;
  const DESLIZAMIENTO_MINIMO_PX = 70;
  const IGNORAR_TOQUE_TRAS_DESLIZAR_MS = 400;

  const clamp = (valor, min, max) => Math.max(min, Math.min(max, valor));
  const current = () => estado.reproductor;

  // ============================================================
  // APERTURA
  // ============================================================

  function openPlayer(referencia, ficha, episodios, indice) {
    const esNarto = playback.isVerticalFormat(referencia);
    // Las reglas viven en la sesión (dominio); aquí solo queda el estado de la vista.
    const sesion = createPlaybackSession({ referencia, ficha, episodios, indice, subsActivos: preferencias.subtitlesEnabledFor(esNarto),
      lineaSubs: preferencias.subtitleLine(), tamanoSubs: preferencias.subtitleSize() });
    const reproductor = {
      sesion, reanudarEn: 0, ultimoGuardado: 0, panel: null, deslizado: false, estadoCarga: 'loading', horizontal: !esNarto,
      temporizadores: new Set()
    };
    updateState({ reproductor });
    plataforma.setOrientation(esNarto ? 'portrait' : 'landscape');
    const contenedor = $('#player');
    contenedor.hidden = false;
    contenedor.innerHTML = playerTemplateHTML();
    reproductor.video = contenedor.querySelector('video');
    attachVideoListeners(reproductor);
    attachSwipeGesture(reproductor, contenedor.querySelector('.stage'));
    loadVideo(indice);
  }

  // ============================================================
  // TEMPORIZADORES DEL REPRODUCTOR
  // ============================================================

  // Cada temporizador cierra sobre este reproductor (su sesión, su <video>). Si se dejan vivos al
  // cerrarlo, retienen todo eso en memoria y se ejecutan sobre un reproductor que ya no existe.
  // Por eso se registran aquí y closePlayer() los libera de una vez.
  function schedule(reproductor, funcion, ms) {
    const id = setTimeout(() => {
      reproductor.temporizadores.delete(id);
      funcion();
    }, ms);
    reproductor.temporizadores.add(id);
    return id;
  }

  function cancel(reproductor, id) {
    clearTimeout(id);
    reproductor.temporizadores.delete(id);
  }

  function releaseTimers(reproductor) {
    reproductor.temporizadores.forEach(id => clearTimeout(id));
    reproductor.temporizadores.clear();
  }

  function scheduleHideUi(reproductor, espera) {
    cancel(reproductor, reproductor._temporizadorUi);
    reproductor._temporizadorUi = schedule(reproductor, () => {
      if (current() && !current().video.paused) $('#player').classList.add('hide-ui');
    }, espera);
  }

  // ============================================================
  // EVENTOS DEL VIDEO
  // ============================================================

  function attachVideoListeners(reproductor) {
    const v = reproductor.video;
    v.addEventListener('playing', () => {
      setCenter('');
      cancel(reproductor, reproductor._temporizadorUi);
      reproductor._temporizadorUi = schedule(reproductor, () => $('#player').classList.add('hide-ui'), OCULTAR_UI_TRAS_REPRODUCIR_MS);
    });
    v.addEventListener('waiting', () => { if (!v.paused) setCenter('loading'); });
    v.addEventListener('pause', () => {
      if (v.ended || reproductor.estadoCarga !== 'ok') return;
      setCenter('paused');
      $('#player').classList.remove('hide-ui');
      cancel(reproductor, reproductor._temporizadorUi);
    });
    v.addEventListener('loadedmetadata', () => onMetadataLoaded(reproductor));
    v.textTracks.addEventListener('addtrack', subtitulos.onTrackAdded);
    v.addEventListener('timeupdate', () => {
      if (v.duration) setProgressBar(v.currentTime / v.duration);
      const ahora = Date.now();
      if (ahora - reproductor.ultimoGuardado > GUARDAR_PROGRESO_CADA_MS && v.currentTime > 0) {
        reproductor.ultimoGuardado = ahora;
        saveProgress();
      }
    });
    v.addEventListener('ended', () => {
      saveProgress(true);
      if (reproductor.sesion.indice < reproductor.sesion.episodios.length - 1) { setCenter('transition'); changeEpisode(1); } else setCenter('paused');
    });
    v.addEventListener('error', () => {
      if (!v.getAttribute('src')) return;
      if (reproductor.sesion.advanceSource()) {
        playStream();
        toast('Probando otra fuente…');
      } else {
        setCenter('error', 'No se pudo reproducir este episodio. Prueba con otra fuente o revisa el addon.');
      }
    });
  }

  function onMetadataLoaded(reproductor) {
    const v = reproductor.video;
    v.classList.toggle('contain', v.videoWidth >= v.videoHeight);
    if (reproductor.reanudarEn > 1 && reproductor.reanudarEn < v.duration - 5) v.currentTime = reproductor.reanudarEn;
    reproductor.reanudarEn = 0;
    subtitulos.showTracksIfEnabled(reproductor);
    for (let intento = 1; intento <= REINTENTOS_SUBTITULOS; intento++) schedule(reproductor, () => subtitulos.showTracksIfEnabled(reproductor), intento * 1000);
    subtitulos.applyCueStyle(reproductor);
  }

  // En el celular lo natural para pasar de capítulo es deslizar vertical, como en las apps de dramas cortos.
  function attachSwipeGesture(reproductor, escenario) {
    let y0 = null, x0 = 0;
    escenario.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }, { passive: true });
    escenario.addEventListener('touchend', e => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0, dx = e.changedTouches[0].clientX - x0;
      y0 = null;
      if (Math.abs(dy) <= DESLIZAMIENTO_MINIMO_PX || Math.abs(dy) <= Math.abs(dx) * 1.5) return;
      // Marcamos el deslizamiento para que el "tap" que dispara el navegador al soltar no pause el video.
      reproductor.deslizado = true;
      schedule(reproductor, () => { reproductor.deslizado = false; }, IGNORAR_TOQUE_TRAS_DESLIZAR_MS);
      changeEpisode(dy < 0 ? 1 : -1);
    }, { passive: true });
  }

  // ============================================================
  // EPISODIOS Y PROGRESO
  // ============================================================

  function changeEpisode(direccion) {
    const reproductor = current();
    if (!reproductor) return;
    if (!reproductor.sesion.canMove(direccion)) {
      toast(direccion > 0 ? 'Es el último episodio' : 'Es el primer episodio');
      return;
    }
    const siguiente = reproductor.sesion.indice + direccion;
    saveProgress(true);
    reproductor.video.classList.add(direccion > 0 ? 'out-up' : 'out-down');
    schedule(reproductor, () => {
      if (current() !== reproductor) return;
      reproductor.video.classList.remove('out-up', 'out-down');
      loadVideo(siguiente);
    }, ANIMACION_CAMBIO_EPISODIO_MS);
  }

  function saveProgress(forzar) {
    const reproductor = current();
    if (!reproductor || !reproductor.video) return;
    const segundos = reproductor.video.currentTime || 0;
    if (!forzar && segundos < 1) return;
    playback.saveProgress(reproductor.sesion, segundos, reproductor.video.duration || 0);
  }

  function resetVideoElement(v) {
    v.pause();
    v.removeAttribute('src');
    v.style.display = '';
    v.querySelectorAll('track').forEach(pista => pista.remove());
    v.load();
  }

  // token: cada carga incrementa el número; las respuestas de cargas anteriores se descartan al llegar.
  async function loadVideo(i) {
    const reproductor = current();
    if (!reproductor) return;
    const token = reproductor.sesion.selectEpisode(i), episodio = reproductor.sesion.episodio;
    reproductor.estadoCarga = 'loading';
    resetVideoElement(reproductor.video);
    const embedAnterior = $('#player .embed-frame');
    if (embedAnterior) embedAnterior.remove();
    setProgressBar(0);
    reproductor.reanudarEn = resumePosition(estado.historial[reproductor.sesion.clave], i, episodio.id);
    updatePlayerUI();
    setCenter('loading');
    let yaInicio = false;
    const onFirst = fuentes => {
      if (!reproductor.sesion.isCurrentLoad(token) || yaInicio) return;
      yaInicio = true;
      reproductor.sesion.setSources(fuentes);
      playStream();
    };
    subtitulos.attachSubtitle(reproductor, episodio, token).catch(error => logIgnored('Falló la búsqueda de subtítulos', error));
    const todasLasFuentes = await playback.findStreams(reproductor.sesion.referencia.type, episodio.id, onFirst);
    if (!reproductor.sesion.isCurrentLoad(token)) return;
    if (!todasLasFuentes.length) {
      reproductor.estadoCarga = 'error';
      setCenter('error', 'Ningún addon activo ofrece una fuente para este episodio.');
      updatePlayerUI();
      return;
    }
    reproductor.sesion.replaceSources(todasLasFuentes);
    updatePlayerUI();
  }

  // ============================================================
  // FUENTES
  // ============================================================

  function startNativeVideo(reproductor, url) {
    const v = reproductor.video;
    v.style.display = '';
    v.src = url;
    v.muted = reproductor.sesion.silenciado;
    v.playbackRate = reproductor.sesion.velocidad;
  }

  // El embed abre la web del sitio encima (MainActivity); cuando aparece el m3u8 volvemos al <video>.
  function playEmbed(reproductor, fuente) {
    reproductor.video.style.display = 'none';
    reproductor._embedActivo = true;
    window._embedOpened = () => { if (current() === reproductor) setCenter(''); };
    window._embedClosed = () => { if (current() === reproductor) { reproductor._embedActivo = false; closePlayer(); } };
    window._embedVideoFound = urlVideo => {
      if (current() !== reproductor) return;
      reproductor._embedActivo = false;
      startNativeVideo(reproductor, urlVideo);
      reproductor.estadoCarga = 'ok';
      setCenter('');
      updatePlayerUI();
    };
    if (!plataforma.openEmbed(fuente.url, fuente._referente || '')) setCenter('error', 'No se pudo cargar el reproductor.');
  }

  function playStream() {
    const reproductor = current();
    if (!reproductor) return;
    const fuente = reproductor.sesion.fuentes[reproductor.sesion.indiceFuente];
    reproductor.estadoCarga = 'ok';
    const iframeAnterior = $('#player').querySelector('.embed-frame');
    if (iframeAnterior) iframeAnterior.remove();
    if (fuente._tipo === 'embed') { playEmbed(reproductor, fuente); return; }
    startNativeVideo(reproductor, fuente.url);
    reproductor.video.play().catch(() => setCenter('paused'));
    updatePlayerUI();
  }

  function togglePlayback(v) {
    if (v.paused) v.play().catch(error => logIgnored('El navegador no dejó reproducir', error)); else v.pause();
  }

  // ============================================================
  // CIERRE Y REANUDACIÓN
  // ============================================================

  function closePlayer() {
    const reproductor = current();
    if (!reproductor) return;
    plataforma.setOrientation(plataforma.esTv ? 'landscape' : 'portrait');
    plataforma.closeEmbed();
    saveProgress(true);
    reproductor.sesion.invalidate();
    releaseTimers(reproductor);
    reproductor.video.pause();
    reproductor.video.removeAttribute('src');
    reproductor.video.load();
    const contenedor = $('#player');
    contenedor.hidden = true;
    contenedor.innerHTML = '';
    // Al quedar sin reproductor, main.js repinta la ficha y lo que haya debajo con el progreso nuevo.
    updateState({ reproductor: null });
  }

  async function resume(clave) {
    const entrada = estado.historial[clave];
    if (!entrada) return;
    const addon = findAddon(entrada.base);
    if (!addon) { toast('El addon de esta serie ya no está instalado'); return; }
    const referencia = { base: entrada.base, type: entrada.type, id: entrada.id, name: entrada.name, poster: entrada.poster };
    toast('Cargando…');
    // Sin red, fetchFullMeta devuelve lo que quedó en el historial: alcanza para retomar el episodio.
    const { ficha, episodios } = await fetchFullMeta(referencia);
    const indice = clamp(entrada.idx, 0, episodios.length - 1);
    updateState({ detalle: { referencia, cargando: false, ficha, episodios } });
    openPlayer(referencia, ficha, episodios, indice);
  }

  Telon.ui.player = { openPlayer, closePlayer, loadVideo, playStream, playerSheet, saveProgress, scheduleHideUi, resume, togglePlayback };
})(window.Telon = window.Telon || {});
