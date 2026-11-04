/*
Telón - Subtítulos del reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Busca el subtítulo del episodio, lo agrega al <video>, lo muestra u oculta y aplica la
posición y el tamaño que eligió el usuario. Los navegadores de TV tratan las pistas de
forma distinta, por eso varias operaciones toleran que el navegador se niegue.
*/
'use strict';

import { logIgnored } from '../infra/log.js';
import { estado } from '../app/state.js';
import * as playback from '../app/playback-service.js';

const current = () => estado.reproductor;
const AVISO_VISIBLE_MS = 600;
const AVISO_SALIDA_MS = 300;

// ============================================================
// PISTAS
// ============================================================

function forEachTrack(video, funcion) {
  for (let i = 0; i < video.textTracks.length; i++) funcion(video.textTracks[i]);
}

function setTracksVisible(reproductor, visibles) {
  forEachTrack(reproductor.video, pista => { pista.mode = visibles ? 'showing' : 'disabled'; });
}

// Con los subtítulos activados, muestra todas las pistas que haya hasta ahora.
function showTracksIfEnabled(reproductor) {
  if (!reproductor.sesion.subsActivos) return;
  setTracksVisible(reproductor, true);
  applyCueStyle(reproductor);
}

function moveCue(cue, linea) {
  try {
    cue.line = linea;
  } catch (error) {
    logIgnored('El navegador no dejó mover un subtítulo', error);
  }
}

// Cada cue nuevo llega con la posición del archivo; la reemplazamos por la que eligió el usuario.
function onTrackAdded(evento) {
  const reproductor = current();
  if (!reproductor || !evento.track) return;
  if (reproductor.sesion.subsActivos) evento.track.mode = 'showing';
  const lineaInicial = reproductor.sesion.lineaSubs;
  evento.track.addEventListener('cuechange', () => {
    const cues = evento.track.activeCues;
    if (!cues) return;
    for (let i = 0; i < cues.length; i++) moveCue(cues[i], current() ? current().sesion.lineaSubs : lineaInicial);
  });
}

async function attachSubtitle(reproductor, episodio, token) {
  try {
    const subtitulo = await playback.findSubtitleTrack(reproductor.sesion.referencia.type, episodio.id);
    if (!subtitulo || !reproductor.sesion.isCurrentLoad(token)) return;
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

// ============================================================
// POSICIÓN Y TAMAÑO
// ============================================================

function applyCueStyle(reproductor) {
  const v = reproductor.video;
  if (!v) return;
  forEachTrack(v, pista => {
    if (!pista.cues) return;
    for (let c = 0; c < pista.cues.length; c++) moveCue(pista.cues[c], reproductor.sesion.lineaSubs);
  });
  const tamano = reproductor.sesion.tamanoSubs;
  let estiloSubs = document.getElementById('_subStyle');
  if (!estiloSubs) {
    estiloSubs = document.createElement('style');
    estiloSubs.id = '_subStyle';
    document.head.appendChild(estiloSubs);
  }
  estiloSubs.textContent = `#player video::cue{font-size:${tamano}px!important;line-height:${tamano + 8}px!important}`;
}

// Aviso breve en el centro ("▲ Posición", "24px Tamaño") para que el cambio se note aunque no haya
// un subtítulo en pantalla en ese momento.
let temporizadorAviso;
function flashSubtitleHint(valor, etiqueta) {
  let aviso = document.getElementById('_subFlash');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = '_subFlash';
    document.body.appendChild(aviso);
  }
  aviso.innerHTML = `<span class="aviso-valor">${valor}</span><span class="aviso-etiqueta">${etiqueta}</span>`;
  aviso.className = 'aviso-subtitulos';
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    aviso.classList.add('saliendo');
    setTimeout(() => { aviso.remove(); }, AVISO_SALIDA_MS);
  }, AVISO_VISIBLE_MS);
}

export { setTracksVisible, showTracksIfEnabled, onTrackAdded, attachSubtitle, applyCueStyle, flashSubtitleHint };
