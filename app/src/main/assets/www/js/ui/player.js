/*
Telón - Reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Reproduce episodio por episodio con el <video> nativo: busca fuentes en todos los
addons, arranca con la primera que llega, cambia de fuente si una falla, guarda el
progreso para "Continuar viendo" y maneja subtítulos, velocidad y paneles.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const plataforma = Telon.infra.platform;
  const { episodeLabel, episodeNumber, seasonOf, listSeasons, episodesInSeason } = Telon.domain.episodes;
  const { resumePosition } = Telon.domain.progress;
  const { SUBTITULOS, estado, preferencias, refKey, findAddon, isInLibrary } = Telon.app.state;
  const { fetchFullMeta } = Telon.app.catalogService;
  const playback = Telon.app.playbackService;
  const { $, escapeHTML } = Telon.ui.dom;
  const { toast } = Telon.ui.components;
  const { renderDetail, toggleLib } = Telon.ui.detail;
  const { homeBody } = Telon.ui.home;
  const { render } = Telon.ui.screens;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const OCULTAR_UI_TRAS_REPRODUCIR_MS = 2000;
  const OCULTAR_UI_TRAS_TOQUE_MS = 3000;
  const GUARDAR_PROGRESO_CADA_MS = 3000;
  // Algunos reproductores agregan las pistas de subtítulos tarde; reintentamos activarlas un rato.
  const REINTENTOS_SUBTITULOS = 10;
  const ANIMACION_CAMBIO_EPISODIO_MS = 220;
  const DESLIZAMIENTO_MINIMO_PX = 70;
  const VELOCIDADES = [1, 1.5, 1.8, 2];
  const LINEA_SUBS = { min: -12, max: -1, porDefecto: SUBTITULOS.lineaPorDefecto };
  const TAMANO_SUBS = { min: 12, max: 36, porDefecto: SUBTITULOS.tamanoPorDefecto };

  const clamp = (valor, min, max) => Math.max(min, Math.min(max, valor));
  const current = () => estado.reproductor;


  // ============================================================
  // APERTURA
  // ============================================================

  const PLANTILLA_REPRODUCTOR = () => `<div class="stage" data-p="tap"><video playsinline webkit-playsinline preload="auto"></video></div><div class="shade"></div>
    <button class="pbtn" data-p="back" aria-label="Cerrar reproductor">${ICONOS.back}</button>
    <button class="srcchip" data-p="sources" aria-label="Cambiar fuente"><i></i><span id="psrc">Buscando fuente…</span></button>
    <div class="rail" id="prail"></div>
    <div class="center" id="pcenter"></div>
    <div class="pinfo"><h2 id="ptitle"></h2><span id="pep"></span></div>
    <div class="pbar" id="pbar"><i id="pfill"></i></div>
    <div id="psheet"></div>`;

  function openPlayer(referencia, ficha, episodios, indice) {
    const esNarto = playback.isVerticalFormat(referencia);
    const reproductor = estado.reproductor = {
      referencia, ficha, episodios, indice, clave: refKey(referencia), fuentes: [], indiceFuente: 0, token: 0,
      silenciado: false, velocidad: 1, subsActivos: preferencias.subtitlesEnabledFor(esNarto),
      lineaSubs: preferencias.subtitleLine(), tamanoSubs: preferencias.subtitleSize(),
      reanudarEn: 0, ultimoGuardado: 0, panel: null, deslizado: false, estadoCarga: 'loading', horizontal: !esNarto
    };
    plataforma.setOrientation(esNarto ? 'portrait' : 'landscape');
    const contenedor = $('#player');
    contenedor.hidden = false;
    contenedor.innerHTML = PLANTILLA_REPRODUCTOR();
    reproductor.video = contenedor.querySelector('video');
    attachVideoListeners(reproductor);
    attachSwipeGesture(reproductor, contenedor.querySelector('.stage'));
    loadVideo(indice);
  }

  function scheduleHideUi(reproductor, espera) {
    clearTimeout(reproductor._temporizadorUi);
    reproductor._temporizadorUi = setTimeout(() => {
      if (current() && !current().video.paused) $('#player').classList.add('hide-ui');
    }, espera);
  }

  function attachVideoListeners(reproductor) {
    const v = reproductor.video;
    v.addEventListener('playing', () => {
      setCenter('');
      clearTimeout(reproductor._temporizadorUi);
      reproductor._temporizadorUi = setTimeout(() => $('#player').classList.add('hide-ui'), OCULTAR_UI_TRAS_REPRODUCIR_MS);
    });
    v.addEventListener('waiting', () => { if (!v.paused) setCenter('loading'); });
    v.addEventListener('pause', () => {
      if (v.ended || reproductor.estadoCarga !== 'ok') return;
      setCenter('paused');
      $('#player').classList.remove('hide-ui');
      clearTimeout(reproductor._temporizadorUi);
    });
    v.addEventListener('loadedmetadata', () => onMetadataLoaded(reproductor));
    v.textTracks.addEventListener('addtrack', onTrackAdded);
    v.addEventListener('timeupdate', () => {
      if (v.duration) $('#pfill').style.width = (v.currentTime / v.duration * 100) + '%';
      const ahora = Date.now();
      if (ahora - reproductor.ultimoGuardado > GUARDAR_PROGRESO_CADA_MS && v.currentTime > 0) {
        reproductor.ultimoGuardado = ahora;
        saveProgress();
      }
    });
    v.addEventListener('ended', () => {
      saveProgress(true);
      if (reproductor.indice < reproductor.episodios.length - 1) { setCenter('transition'); changeEpisode(1); } else setCenter('paused');
    });
    v.addEventListener('error', () => {
      if (!v.getAttribute('src')) return;
      if (reproductor.indiceFuente < reproductor.fuentes.length - 1) {
        reproductor.indiceFuente++;
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
    const enableAutoSubs = () => {
      if (!reproductor.subsActivos) return;
      for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = 'showing';
      applyCueStyle(reproductor);
    };
    enableAutoSubs();
    for (let intento = 1; intento <= REINTENTOS_SUBTITULOS; intento++) setTimeout(enableAutoSubs, intento * 1000);
    applyCueStyle(reproductor);
  }

  function onTrackAdded(evento) {
    const reproductor = current();
    if (!reproductor || !evento.track) return;
    if (reproductor.subsActivos) evento.track.mode = 'showing';
    const lineaInicial = reproductor.lineaSubs || LINEA_SUBS.porDefecto;
    // Cada cue nuevo llega con la posición del archivo; la reemplazamos por la que eligió el usuario.
    evento.track.addEventListener('cuechange', () => {
      const cues = evento.track.activeCues;
      if (!cues) return;
      for (let i = 0; i < cues.length; i++) {
        try {
          cues[i].line = current() ? current().lineaSubs : lineaInicial;
        } catch (error) {
          logIgnored('El navegador no dejó mover un subtítulo', error);
        }
      }
    });
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
      setTimeout(() => { reproductor.deslizado = false; }, 400);
      changeEpisode(dy < 0 ? 1 : -1);
    }, { passive: true });
  }

  // ============================================================
  // EPISODIOS Y PROGRESO
  // ============================================================

  function changeEpisode(direccion) {
    const reproductor = current();
    if (!reproductor) return;
    const siguiente = reproductor.indice + direccion;
    if (siguiente < 0 || siguiente >= reproductor.episodios.length) {
      toast(direccion > 0 ? 'Es el último episodio' : 'Es el primer episodio');
      return;
    }
    saveProgress(true);
    reproductor.video.classList.add(direccion > 0 ? 'out-up' : 'out-down');
    setTimeout(() => {
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
    playback.saveProgress(reproductor, segundos, reproductor.video.duration || 0);
  }

  async function attachSubtitle(reproductor, episodio, token) {
    try {
      const subtitulo = await playback.findSubtitleTrack(reproductor.referencia.type, episodio.id);
      if (!subtitulo || token !== reproductor.token) return;
      const pista = document.createElement('track');
      pista.kind = 'subtitles';
      pista.label = subtitulo.etiqueta;
      pista.srclang = subtitulo.idioma;
      pista.default = true;
      pista.src = subtitulo.src;
      reproductor.video.appendChild(pista);
      pista.track.mode = 'showing';
    } catch (error) {
      // Si el subtítulo no baja, el episodio igual se ve; no vale la pena cortar la reproducción.
      logIgnored('No se pudo cargar el subtítulo', error);
    }
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
    reproductor.indice = i;
    reproductor.fuentes = [];
    reproductor.indiceFuente = 0;
    reproductor.estadoCarga = 'loading';
    const token = ++reproductor.token, episodio = reproductor.episodios[i];
    resetVideoElement(reproductor.video);
    const embedAnterior = $('#player .embed-frame');
    if (embedAnterior) embedAnterior.remove();
    $('#pfill').style.width = '0';
    reproductor.reanudarEn = resumePosition(estado.historial[reproductor.clave], i, episodio.id);
    updatePlayerUI();
    setCenter('loading');
    let yaInicio = false;
    const onFirst = fuentes => {
      if (token !== reproductor.token || yaInicio) return;
      yaInicio = true;
      reproductor.fuentes = fuentes;
      reproductor.indiceFuente = 0;
      playStream();
    };
    attachSubtitle(reproductor, episodio, token).catch(error => logIgnored('Falló la búsqueda de subtítulos', error));
    const todasLasFuentes = await playback.findStreams(reproductor.referencia.type, episodio.id, onFirst);
    if (token !== reproductor.token) return;
    if (!todasLasFuentes.length) {
      reproductor.estadoCarga = 'error';
      setCenter('error', 'Ningún addon activo ofrece una fuente para este episodio.');
      updatePlayerUI();
      return;
    }
    reproductor.fuentes = todasLasFuentes;
    updatePlayerUI();
  }

  // ============================================================
  // FUENTES
  // ============================================================

  function startNativeVideo(reproductor, url) {
    const v = reproductor.video;
    v.style.display = '';
    v.src = url;
    v.muted = reproductor.silenciado;
    v.playbackRate = reproductor.velocidad;
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
    const fuente = reproductor.fuentes[reproductor.indiceFuente];
    reproductor.estadoCarga = 'ok';
    const iframeAnterior = $('#player').querySelector('.embed-frame');
    if (iframeAnterior) iframeAnterior.remove();
    if (fuente._tipo === 'embed') { playEmbed(reproductor, fuente); return; }
    startNativeVideo(reproductor, fuente.url);
    reproductor.video.play().catch(() => setCenter('paused'));
    updatePlayerUI();
  }

  // ============================================================
  // INTERFAZ DEL REPRODUCTOR
  // ============================================================

  function loadingHTML(texto) {
    const reproductor = current();
    const poster = reproductor && reproductor.ficha && reproductor.ficha.poster;
    const imagen = poster ? `<img src="${escapeHTML(poster)}" style="width:120px;border-radius:12px;margin-bottom:12px" alt="">` : '';
    return `<div style="display:flex;flex-direction:column;align-items:center">${imagen}<div class="spin" style="margin-bottom:8px"></div><span style="color:#fff;font-size:15px">${texto}</span></div>`;
  }

  const CENTROS = {
    transition: () => loadingHTML('Cargando siguiente capítulo…'),
    loading: () => loadingHTML('Cargando capítulo…'),
    paused: () => `<span class="bubble">${ICONOS.playBig}</span>`,
    error: mensaje => `<div class="msg" role="alert">${escapeHTML(mensaje)}</div><div style="display:flex;gap:8px"><button class="btn" data-p="retry">Reintentar</button><button class="btn out" style="background:#000000aa" data-p="sources">Fuentes</button></div>`
  };

  function setCenter(modo, mensaje) {
    const centro = $('#pcenter');
    if (!centro) return;
    centro.innerHTML = CENTROS[modo] ? CENTROS[modo](mensaje) : '';
  }

  let temporizadorAviso;
  function flashSubtitleHint(valor, etiqueta) {
    let aviso = document.getElementById('_subFlash');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.id = '_subFlash';
      document.body.appendChild(aviso);
    }
    aviso.innerHTML = `<span style="font-size:32px;font-weight:700">${valor}</span><span style="font-size:13px;color:#aaa">${etiqueta}</span>`;
    aviso.style.cssText = 'position:fixed;top:35%;left:50%;transform:translate(-50%,-50%);z-index:200;background:rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:16px 28px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;pointer-events:none;animation:_sfIn .35s ease';
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => {
      aviso.style.opacity = '0';
      aviso.style.transition = 'opacity .3s';
      setTimeout(() => { aviso.remove(); }, 300);
    }, 600);
  }

  function applyCueStyle(reproductor) {
    const v = reproductor.video;
    if (!v) return;
    for (let t = 0; t < v.textTracks.length; t++) {
      const pista = v.textTracks[t];
      if (!pista.cues) continue;
      for (let c = 0; c < pista.cues.length; c++) {
        try {
          pista.cues[c].line = reproductor.lineaSubs;
        } catch (error) {
          logIgnored('El navegador no dejó mover un subtítulo', error);
        }
      }
    }
    const reglaCss = `#player video::cue{font-size:${reproductor.tamanoSubs}px!important;line-height:${reproductor.tamanoSubs + 8}px!important}`;
    let estiloSubs = document.getElementById('_subStyle');
    if (!estiloSubs) {
      estiloSubs = document.createElement('style');
      estiloSubs.id = '_subStyle';
      document.head.appendChild(estiloSubs);
    }
    estiloSubs.textContent = reglaCss;
  }

  function sourceLabel(reproductor) {
    const fuente = reproductor.fuentes[reproductor.indiceFuente];
    if (!fuente) return reproductor.estadoCarga === 'error' ? 'Sin fuente' : 'Buscando fuente…';
    const detalle = fuente.name || fuente.title;
    return fuente.addon.manifest.name + (detalle ? ' · ' + detalle.split('\n')[0] : '');
  }

  function railHTML(reproductor) {
    const guardado = isInLibrary(reproductor.referencia);
    return `<button data-p="save" class="${guardado ? 'on' : ''}" aria-label="Guardar en mi lista">${guardado ? ICONOS.saveOn : ICONOS.save}Guardar</button>`
      + (reproductor.episodios.length > 1 ? `<button data-p="eps" aria-label="Lista de episodios">${ICONOS.eps}Episodios</button>` : '')
      + (reproductor.fuentes.length > 1 ? `<button data-p="sources" aria-label="Fuentes">${ICONOS.layers}Fuentes</button>` : '')
      + `<button data-p="subs" class="${reproductor.subsActivos ? 'on' : ''}" aria-label="Subtítulos">${reproductor.subsActivos ? ICONOS.subs : ICONOS.subsOff}Subs</button>`
      + `<button data-p="mute" aria-label="${reproductor.silenciado ? 'Activar sonido' : 'Silenciar'}">${reproductor.silenciado ? ICONOS.mute : ICONOS.vol}${reproductor.silenciado ? 'Mute' : 'Sonido'}</button>`
      + `<button data-p="speed" aria-label="Velocidad">${ICONOS.speed}${reproductor.velocidad === 1 ? '1x' : reproductor.velocidad + 'x'}</button>`;
  }

  function updatePlayerUI() {
    const reproductor = current();
    if (!reproductor) return;
    const episodio = reproductor.episodios[reproductor.indice];
    const etiquetaEp = episodeLabel(reproductor.episodios, reproductor.indice);
    const tituloEp = episodio.title && episodio.title !== reproductor.ficha.name ? episodio.title : '';
    $('#ptitle').textContent = reproductor.ficha.name;
    $('#pep').textContent = [etiquetaEp && etiquetaEp + ' de ' + reproductor.episodios.length, tituloEp].filter(Boolean).join(' · ');
    $('#psrc').textContent = sourceLabel(reproductor);
    $('#prail').innerHTML = railHTML(reproductor);
  }

  // ============================================================
  // PANELES (EPISODIOS, SUBTÍTULOS, FUENTES)
  // ============================================================

  const sheetHeaderHTML = titulo => `<div class="sh"><h3>${titulo}</h3><button class="iconbtn" data-p="closesheet" aria-label="Cerrar">${ICONOS.close}</button></div>`;

  function episodesSheetHTML(reproductor) {
    const temporadas = listSeasons(reproductor.episodios);
    const episodioActual = reproductor.episodios[reproductor.indice];
    const temporadaActual = episodioActual ? seasonOf(episodioActual) : temporadas[0];
    const temporadaElegida = estado.temporadaReproductor != null ? estado.temporadaReproductor : temporadaActual;
    const chipsTemporada = temporadas.length > 1
      ? `<div class="season-chips">${temporadas.map(t => `<button class="chip${t === temporadaElegida ? ' on' : ''}" data-p="pseason:${t}">${t === 0 ? 'Esp' : 'T' + t}</button>`).join('')}</div>`
      : '';
    const botones = episodesInSeason(reproductor.episodios, temporadaElegida).map(({ episodio, i }) => {
      const numero = escapeHTML(episodeNumber(episodio, i));
      return `<button class="ep ${i === reproductor.indice ? 'cur' : ''}" data-p="ep:${i}" aria-label="Episodio ${numero}">${numero}</button>`;
    }).join('');
    return `${sheetHeaderHTML('Episodios')}${chipsTemporada}
      <div class="eps">${botones}</div>`;
  }

  function subtitlesSheetHTML(reproductor) {
    const tamanoSubs = reproductor.tamanoSubs || TAMANO_SUBS.porDefecto;
    return `${sheetHeaderHTML('Subtítulos')}
      <div class="set-card" style="background:var(--superficie-2);border:1px solid var(--borde);border-radius:10px;padding:14px"><div class="itext"><b style="color:#fff">Activados</b></div><button class="switch" role="switch" aria-checked="${reproductor.subsActivos}" data-p="subtoggle"><i></i></button></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0"><span style="font-size:14px;color:#ccc">Posición</span><div style="display:flex;gap:8px"><button class="chip" data-p="subpos:-1" aria-label="Subir">▲ Arriba</button><button class="chip" data-p="subpos:1" aria-label="Bajar">▼ Abajo</button></div></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0"><span style="font-size:14px;color:#ccc">Tamaño (${tamanoSubs}px)</span><div style="display:flex;gap:8px"><button class="chip" data-p="subsize:-2" aria-label="Menor">A−</button><button class="chip" data-p="subsize:2" aria-label="Mayor">A+</button></div></div>`;
  }

  function sourcesSheetHTML(reproductor) {
    const opciones = reproductor.fuentes.length
      ? reproductor.fuentes.map((f, i) => `<button class="srcopt ${i === reproductor.indiceFuente ? 'on' : ''}" data-p="src:${i}">${escapeHTML(f.addon.manifest.name)}<span>${escapeHTML(((f.name || '') + ' ' + (f.title || '')).trim().split('\n')[0] || 'Fuente ' + (i + 1))}</span></button>`).join('')
      : '<p class="desc">Ningún addon activo ofrece fuentes para este episodio.</p>';
    return sheetHeaderHTML('Fuentes') + opciones;
  }

  const PANELES = { eps: episodesSheetHTML, subs: subtitlesSheetHTML, src: sourcesSheetHTML };

  function playerSheet(modo) {
    const reproductor = current(), caja = $('#psheet');
    reproductor.panel = modo;
    if (!modo) { caja.innerHTML = ''; return; }
    caja.innerHTML = `<div class="sheetbg" data-p="closesheet"><div class="sheet" data-p="keep"><div class="grab"></div>${PANELES[modo](reproductor)}</div></div>`;
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
    reproductor.token++;
    reproductor.video.pause();
    reproductor.video.removeAttribute('src');
    reproductor.video.load();
    estado.reproductor = null;
    const contenedor = $('#player');
    contenedor.hidden = true;
    contenedor.innerHTML = '';
    if (estado.detalle) renderDetail();
    // El progreso cambió: refrescamos "Continuar viendo" o el historial si están a la vista.
    if (estado.pestana === 'home') homeBody(); else if (estado.pestana === 'lib') render();
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
    estado.detalle = { referencia, cargando: false, ficha, episodios };
    $('#detail').hidden = false;
    renderDetail();
    openPlayer(referencia, ficha, episodios, indice);
  }

  // ============================================================
  // ACCIONES DEL REPRODUCTOR (data-p)
  // ============================================================

  function togglePlayback(v) {
    if (v.paused) v.play().catch(error => logIgnored('El navegador no dejó reproducir', error)); else v.pause();
  }

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

  const ACCIONES_REPRODUCTOR = {
    keep: () => {},
    tap: handleTap,
    back: () => closePlayer(),
    subs: () => playerSheet('subs'),
    subtoggle: reproductor => {
      reproductor.subsActivos = !reproductor.subsActivos;
      const pistas = reproductor.video.textTracks;
      for (let i = 0; i < pistas.length; i++) pistas[i].mode = reproductor.subsActivos ? 'showing' : 'disabled';
      updatePlayerUI();
      playerSheet('subs');
    },
    subpos: (reproductor, argumento) => {
      reproductor.lineaSubs = clamp((reproductor.lineaSubs || LINEA_SUBS.porDefecto) + (+argumento), LINEA_SUBS.min, LINEA_SUBS.max);
      preferencias.saveSubtitleLine(reproductor.lineaSubs);
      updateSubtitleSetting(reproductor, { valor: +argumento < 0 ? '▲' : '▼', etiqueta: 'Posición' });
    },
    subsize: (reproductor, argumento) => {
      reproductor.tamanoSubs = clamp((reproductor.tamanoSubs || TAMANO_SUBS.porDefecto) + (+argumento), TAMANO_SUBS.min, TAMANO_SUBS.max);
      preferencias.saveSubtitleSize(reproductor.tamanoSubs);
      updateSubtitleSetting(reproductor, { valor: reproductor.tamanoSubs + 'px', etiqueta: 'Tamaño' });
    },
    mute: reproductor => {
      reproductor.silenciado = !reproductor.silenciado;
      reproductor.video.muted = reproductor.silenciado;
      updatePlayerUI();
    },
    save: reproductor => { toggleLib(reproductor.referencia); updatePlayerUI(); },
    eps: () => playerSheet('eps'),
    sources: () => playerSheet('src'),
    closesheet: () => playerSheet(null),
    pseason: (reproductor, argumento) => { estado.temporadaReproductor = +argumento; playerSheet('eps'); },
    ep: (reproductor, argumento) => {
      playerSheet(null);
      if (+argumento === reproductor.indice) return;
      saveProgress(true);
      loadVideo(+argumento);
    },
    // Al cambiar de fuente seguimos desde el mismo segundo.
    src: (reproductor, argumento) => {
      playerSheet(null);
      reproductor.indiceFuente = +argumento;
      reproductor.reanudarEn = reproductor.video.currentTime;
      playStream();
    },
    speed: reproductor => {
      reproductor.velocidad = VELOCIDADES[(VELOCIDADES.indexOf(reproductor.velocidad) + 1) % VELOCIDADES.length];
      reproductor.video.playbackRate = reproductor.velocidad;
      updatePlayerUI();
    },
    retry: reproductor => loadVideo(reproductor.indice)
  };

  function playerClick(evento) {
    const reproductor = current();
    if (!reproductor) return;
    const boton = evento.target.closest('[data-p]');
    if (!boton) return;
    const [accion, argumento] = boton.dataset.p.split(':');
    if (Object.prototype.hasOwnProperty.call(ACCIONES_REPRODUCTOR, accion)) ACCIONES_REPRODUCTOR[accion](reproductor, argumento);
  }

  Telon.ui.player = { openPlayer, closePlayer, loadVideo, playerSheet, playerClick, saveProgress, resume, togglePlayback };
})(window.Telon = window.Telon || {});
