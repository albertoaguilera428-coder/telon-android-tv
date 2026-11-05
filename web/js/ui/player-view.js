/*
Telón - Vista del reproductor
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lo que el reproductor dibuja encima del video: la plantilla, el centro (cargando, pausa,
error), la barra lateral, el título y los paneles de episodios, subtítulos y fuentes.
No reproduce nada ni guarda nada: solo lee el reproductor actual y pinta.
*/
'use strict';

import * as plataforma from '../infra/platform.js';
import { episodeLabel, episodeNumber, seasonOf, listSeasons, episodesInSeason } from '../domain/episodes.js';
import { estado, isInLibrary } from '../app/state.js';
import { $, escapeHTML, safeUrl } from './dom.js';
import { ICONOS } from './icons.js';

const current = () => estado.reproductor;

// ============================================================
// FOCO DEL CONTROL REMOTO (TV)
// ============================================================

// La barra y los paneles se vuelven a pintar después de cada acción (silenciar, velocidad,
// subtítulos). En TV el botón enfocado desaparecía con el repintado y el foco se perdía: se
// devuelve al botón equivalente (mismo data-p).
function repaintKeepingFocus(contenedor, pintar) {
  const enfocado = document.activeElement;
  const accionPrevia = plataforma.esTv && enfocado && contenedor.contains(enfocado) && enfocado.dataset ? enfocado.dataset.p : null;
  pintar();
  if (!accionPrevia) return;
  const equivalente = [...contenedor.querySelectorAll('[data-p]')].find(boton => boton.dataset.p === accionPrevia);
  if (equivalente) equivalente.focus();
}

// El botón que abrió el panel: al cerrarlo, el foco vuelve ahí. Se guarda también su acción por
// si la barra se repintó mientras el panel estaba abierto (el botón original ya no existe).
let botonQueAbrioPanel = null;
let accionQueAbrioPanel = null;

// ============================================================
// PLANTILLA
// ============================================================

const playerTemplateHTML = () => `<div class="stage" data-p="tap"><video playsinline webkit-playsinline preload="auto"></video></div><div class="shade"></div>
  <button class="pbtn" data-p="back" aria-label="Cerrar reproductor">${ICONOS.back}</button>
  <button class="srcchip" data-p="sources" aria-label="Cambiar fuente"><i></i><span id="psrc">Buscando fuente…</span></button>
  <div class="rail" id="prail"></div>
  <div class="center" id="pcenter"></div>
  <div class="pinfo"><h2 id="ptitle"></h2><span id="pep"></span></div>
  <div class="pbar" id="pbar"><i id="pfill"></i></div>
  <div id="psheet"></div>`;

// ============================================================
// CENTRO (CARGANDO, PAUSA, ERROR)
// ============================================================

function loadingHTML(texto) {
  const reproductor = current();
  const poster = reproductor && reproductor.sesion.ficha && safeUrl(reproductor.sesion.ficha.poster);
  const imagen = poster ? `<img class="carga-poster" src="${escapeHTML(poster)}" alt="">` : '';
  return `<div class="carga">${imagen}<div class="spin"></div><span class="carga-texto">${texto}</span></div>`;
}

const CENTROS = {
  transition: () => loadingHTML('Cargando siguiente capítulo…'),
  loading: () => loadingHTML('Cargando capítulo…'),
  paused: () => `<span class="bubble">${ICONOS.playBig}</span>`,
  error: mensaje => `<div class="msg" role="alert">${escapeHTML(mensaje)}</div><div class="fila-acciones"><button class="btn" data-p="retry">Reintentar</button><button class="btn out" data-p="sources">Fuentes</button></div>`
};

function setCenter(modo, mensaje) {
  const centro = $('#pcenter');
  if (!centro) return;
  centro.innerHTML = CENTROS[modo] ? CENTROS[modo](mensaje) : '';
  // Si falla la reproducción, en TV el foco va a «Reintentar»: si no, no había cómo llegar.
  if (modo === 'error' && plataforma.esTv) centro.querySelector('[data-p="retry"]').focus();
}

function setProgressBar(fraccion) {
  $('#pfill').style.width = fraccion ? (fraccion * 100) + '%' : '0';
}

// ============================================================
// TÍTULO, FUENTE Y BARRA LATERAL
// ============================================================

function sourceLabel(reproductor) {
  const fuente = reproductor.sesion.fuentes[reproductor.sesion.indiceFuente];
  if (!fuente) return reproductor.estadoCarga === 'error' ? 'Sin fuente' : 'Buscando fuente…';
  const detalle = fuente.name || fuente.title;
  return fuente.addon.manifest.name + (detalle ? ' · ' + detalle.split('\n')[0] : '');
}

function railHTML(reproductor) {
  const sesion = reproductor.sesion;
  const guardado = isInLibrary(sesion.referencia);
  return `<button data-p="save" class="${guardado ? 'on' : ''}" aria-label="Guardar en mi lista">${guardado ? ICONOS.saveOn : ICONOS.save}Guardar</button>`
    + (sesion.episodios.length > 1 ? `<button data-p="eps" aria-label="Lista de episodios">${ICONOS.eps}Episodios</button>` : '')
    + (sesion.fuentes.length > 1 ? `<button data-p="sources" aria-label="Fuentes">${ICONOS.layers}Fuentes</button>` : '')
    + `<button data-p="subs" class="${sesion.subsActivos ? 'on' : ''}" aria-label="Subtítulos">${sesion.subsActivos ? ICONOS.subs : ICONOS.subsOff}Subs</button>`
    + `<button data-p="mute" aria-label="${sesion.silenciado ? 'Activar sonido' : 'Silenciar'}">${sesion.silenciado ? ICONOS.mute : ICONOS.vol}${sesion.silenciado ? 'Mute' : 'Sonido'}</button>`
    + `<button data-p="speed" aria-label="Velocidad">${ICONOS.speed}${sesion.velocidad === 1 ? '1x' : sesion.velocidad + 'x'}</button>`;
}

function updatePlayerUI() {
  const reproductor = current();
  if (!reproductor) return;
  const sesion = reproductor.sesion;
  const episodio = sesion.episodios[sesion.indice];
  const etiquetaEp = episodeLabel(sesion.episodios, sesion.indice);
  const tituloEp = episodio.title && episodio.title !== sesion.ficha.name ? episodio.title : '';
  $('#ptitle').textContent = sesion.ficha.name;
  $('#pep').textContent = [etiquetaEp && etiquetaEp + ' de ' + sesion.episodios.length, tituloEp].filter(Boolean).join(' · ');
  $('#psrc').textContent = sourceLabel(reproductor);
  repaintKeepingFocus($('#prail'), () => { $('#prail').innerHTML = railHTML(reproductor); });
}

// ============================================================
// PANELES (EPISODIOS, SUBTÍTULOS, FUENTES)
// ============================================================

const sheetHeaderHTML = titulo => `<div class="sh"><h3>${titulo}</h3><button class="iconbtn" data-p="closesheet" aria-label="Cerrar">${ICONOS.close}</button></div>`;

function episodesSheetHTML(reproductor) {
  const sesion = reproductor.sesion;
  const temporadas = listSeasons(sesion.episodios);
  const episodioActual = sesion.episodios[sesion.indice];
  const temporadaActual = episodioActual ? seasonOf(episodioActual) : temporadas[0];
  const temporadaElegida = estado.temporadaReproductor != null ? estado.temporadaReproductor : temporadaActual;
  const chipsTemporada = temporadas.length > 1
    ? `<div class="season-chips">${temporadas.map(t => `<button class="chip${t === temporadaElegida ? ' on' : ''}" data-p="pseason:${t}">${t === 0 ? 'Esp' : 'T' + t}</button>`).join('')}</div>`
    : '';
  const botones = episodesInSeason(sesion.episodios, temporadaElegida).map(({ episodio, i }) => {
    const numero = escapeHTML(episodeNumber(episodio, i));
    return `<button class="ep ${i === sesion.indice ? 'cur' : ''}" data-p="ep:${i}" aria-label="Episodio ${numero}">${numero}</button>`;
  }).join('');
  return `${sheetHeaderHTML('Episodios')}${chipsTemporada}
    <div class="eps">${botones}</div>`;
}

function subtitlesSheetHTML(reproductor) {
  const tamanoSubs = reproductor.sesion.tamanoSubs;
  return `${sheetHeaderHTML('Subtítulos')}
    <div class="set-card"><div class="itext"><b>Activados</b></div><button class="switch" role="switch" aria-checked="${reproductor.sesion.subsActivos}" data-p="subtoggle"><i></i></button></div>
    <div class="ajuste-fila"><span>Posición</span><div class="fila-acciones"><button class="chip" data-p="subpos:-1" aria-label="Subir">${ICONOS.up}Arriba</button><button class="chip" data-p="subpos:1" aria-label="Bajar">${ICONOS.down}Abajo</button></div></div>
    <div class="ajuste-fila"><span>Tamaño (${tamanoSubs}px)</span><div class="fila-acciones"><button class="chip" data-p="subsize:-2" aria-label="Menor">A−</button><button class="chip" data-p="subsize:2" aria-label="Mayor">A+</button></div></div>`;
}

function sourcesSheetHTML(reproductor) {
  const sesion = reproductor.sesion;
  const opciones = sesion.fuentes.length
    ? sesion.fuentes.map((f, i) => `<button class="srcopt ${i === sesion.indiceFuente ? 'on' : ''}" data-p="src:${i}">${escapeHTML(f.addon.manifest.name)}<span>${escapeHTML(((f.name || '') + ' ' + (f.title || '')).trim().split('\n')[0] || 'Fuente ' + (i + 1))}</span></button>`).join('')
    : '<p class="desc">Ningún addon activo ofrece fuentes para este episodio.</p>';
  return sheetHeaderHTML('Fuentes') + opciones;
}

const PANELES = { eps: episodesSheetHTML, subs: subtitlesSheetHTML, src: sourcesSheetHTML };

// En TV el foco entra al panel (al episodio o fuente actual, o al primer ajuste) y, al
// cerrarlo, vuelve al botón que lo abrió.
// En orden de preferencia. Se prueban de a uno: con una lista de selectores, querySelector
// devuelve el primero en el orden de la página (sería el botón de cerrar).
const PRIMER_FOCO_PANEL = ['.ep.cur', '.srcopt.on', '.switch', '.ep', '.srcopt', '.sheet [data-p]:not([data-p="keep"])'];

function focusPanelOpener() {
  const abridor = botonQueAbrioPanel && botonQueAbrioPanel.isConnected ? botonQueAbrioPanel
    : accionQueAbrioPanel && [...document.querySelectorAll('#player [data-p]')].find(boton => boton.dataset.p === accionQueAbrioPanel && boton.offsetParent !== null);
  botonQueAbrioPanel = accionQueAbrioPanel = null;
  if (abridor) abridor.focus();
}

function playerSheet(modo) {
  const reproductor = current(), caja = $('#psheet');
  const estabaAbierto = Boolean(reproductor.panel);
  if (!estabaAbierto && modo && plataforma.esTv) {
    const enfocado = document.activeElement;
    botonQueAbrioPanel = enfocado && enfocado.dataset && enfocado.dataset.p ? enfocado : null;
    accionQueAbrioPanel = botonQueAbrioPanel ? enfocado.dataset.p : null;
  }
  reproductor.panel = modo;
  if (!modo) {
    caja.innerHTML = '';
    if (plataforma.esTv) focusPanelOpener();
    return;
  }
  repaintKeepingFocus(caja, () => {
    caja.innerHTML = `<div class="sheetbg" data-p="closesheet"><div class="sheet" data-p="keep"><div class="grab"></div>${PANELES[modo](reproductor)}</div></div>`;
  });
  if (plataforma.esTv && !caja.contains(document.activeElement)) {
    const primero = PRIMER_FOCO_PANEL.map(selector => caja.querySelector(selector)).find(Boolean);
    if (primero) primero.focus();
  }
}

export { playerTemplateHTML, setCenter, setProgressBar, updatePlayerUI, playerSheet };
