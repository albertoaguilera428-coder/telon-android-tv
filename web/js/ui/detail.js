/*
Telón - Ficha de serie
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Muestra la ficha de una serie o película: datos, botón de reproducir o continuar,
guardar en la lista y la grilla de episodios por temporada.
*/
'use strict';

import * as plataforma from '../infra/platform.js';
import { $, escapeHTML, toneClass, cssUrl } from './dom.js';
import { getCountryCode } from '../domain/countries.js';
import { episodeLabel, episodeNumber, listSeasons, episodesInSeason } from '../domain/episodes.js';
import { estado, updateState, refKey, isInLibrary, toggleLibrary } from '../app/state.js';
import { prepareTitle, fetchFullMeta, warmUpSources } from '../app/catalog-service.js';
import { toast, skeletonDetailHTML, posterHTML } from './components.js';
import { ICONOS } from './icons.js';

// ============================================================
// CARGA
// ============================================================

// En TV, la tarjeta que abrió la ficha: al cerrarla, el foco vuelve ahí y no a la barra.
let claveQueAbrio = null;

// Pinta enseguida con lo que ya sabemos (nombre y póster de la tarjeta) y completa al llegar la ficha.
async function openDetail(referencia) {
  prepareTitle(referencia);
  const abridor = document.activeElement;
  claveQueAbrio = abridor && abridor.dataset ? abridor.dataset.k || null : null;
  // Cada cambio de estado.detalle repinta la ficha (main.js está suscrito).
  updateState({ detalle: { referencia, cargando: true, ficha: null, episodios: [] }, temporadaDetalle: null });
  const { ficha, episodios, aviso } = await fetchFullMeta(referencia);
  // El usuario pudo cerrar o abrir otra ficha mientras esperábamos; esta respuesta ya no aplica.
  if (!estado.detalle || estado.detalle.referencia !== referencia) return;
  updateState({ detalle: { referencia, cargando: false, ficha, episodios, aviso } });
  warmUpSources(referencia, ficha);
}

// ============================================================
// PARTES DE LA FICHA
// ============================================================

function episodesHTML(detalle, entradaHistorial) {
  if (detalle.episodios.length <= 1) return '';
  const temporadas = listSeasons(detalle.episodios);
  const temporadaElegida = estado.temporadaDetalle != null ? estado.temporadaDetalle : temporadas[0];
  const chipsTemporada = temporadas.length > 1
    ? `<div class="season-chips">${temporadas.map(t => `<button class="chip${t === temporadaElegida ? ' on' : ''}" data-act="season:${t}">${t === 0 ? 'Especiales' : 'Temporada ' + t}</button>`).join('')}</div>`
    : '';
  const botones = episodesInSeason(detalle.episodios, temporadaElegida).map(({ episodio, i }) => {
    const numero = escapeHTML(episodeNumber(episodio, i));
    return `<button class="ep ${entradaHistorial && entradaHistorial.idx === i ? 'seen' : ''}" data-act="play:${i}" aria-label="Episodio ${numero}">${numero}</button>`;
  }).join('');
  return `<section class="d-episodios"><h2 class="subtitulo">Episodios</h2>${chipsTemporada}<div class="eps">${botones}</div></section>`;
}

function detailBodyHTML(detalle, ficha) {
  if (detalle.cargando) return skeletonDetailHTML();
  const entradaHistorial = estado.historial[refKey(detalle.referencia)];
  const actual = entradaHistorial ? Math.min(entradaHistorial.idx, detalle.episodios.length - 1) : 0;
  const pastillas = [getCountryCode(ficha), ...(ficha.genres || []).slice(0, 3), ficha.releaseInfo || ficha.year,
    detalle.episodios.length > 1 ? detalle.episodios.length + ' episodios' : ''].filter(Boolean);
  const textoReproducir = entradaHistorial && entradaHistorial.t > 1 ? 'Continuar ' + escapeHTML(episodeLabel(detalle.episodios, actual)) : 'Reproducir';
  return `${pastillas.length ? `<div class="pills">${pastillas.map(p => `<i>${escapeHTML(p)}</i>`).join('')}</div>` : ''}
    ${ficha.description ? `<p class="desc">${escapeHTML(ficha.description)}</p>` : ''}
    ${detalle.aviso ? `<p class="err">${escapeHTML(detalle.aviso)}</p>` : ''}
    <div class="actions"><button class="btn" data-act="play:${actual}">${ICONOS.play}${textoReproducir}</button>
    <button class="btn out" data-act="savelib">${isInLibrary(detalle.referencia) ? ICONOS.saveOn + 'Guardado' : ICONOS.save + 'Guardar'}</button></div>
    ${episodesHTML(detalle, entradaHistorial)}`;
}

// Encabezado: ambiente de color con el póster desenfocado detrás; el póster nítido y el título
// van en el cuerpo (en TV, póster a la izquierda e información a la derecha).
// ============================================================
// FOCO DEL CONTROL REMOTO (TV)
// ============================================================

// Repintar la ficha reemplaza sus botones: el foco vuelve al equivalente (por ejemplo, la
// temporada recién elegida). Si venía de afuera (recién abierta o al cerrar el reproductor), va a
// «Reproducir», que es lo que casi siempre se quiere hacer.
function restoreDetailFocus(contenedor, accionPrevia, cargando) {
  const botones = [...contenedor.querySelectorAll('[data-act]')];
  const equivalente = accionPrevia && botones.find(boton => boton.dataset.act === accionPrevia);
  if (equivalente) { equivalente.focus(); return; }
  if (cargando) return;
  const reproducir = botones.find(boton => boton.dataset.act.startsWith('play:'));
  (reproducir || botones[0]).focus();
}

function returnFocusToOpener() {
  const tarjeta = claveQueAbrio && [...document.querySelectorAll('#screen [data-k]')].find(elemento => elemento.dataset.k === claveQueAbrio);
  if (!tarjeta) return;
  tarjeta.focus();
  tarjeta.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ============================================================
// PINTADO DE LA FICHA
// ============================================================

function renderDetail() {
  const detalle = estado.detalle, contenedor = $('#detail');
  if (!detalle) {
    const estabaAbierta = !contenedor.hidden;
    contenedor.hidden = true;
    contenedor.innerHTML = '';
    if (plataforma.esTv && estabaAbierta) returnFocusToOpener();
    return;
  }
  const enfocado = document.activeElement;
  const accionPrevia = enfocado && contenedor.contains(enfocado) && enfocado.dataset ? enfocado.dataset.act : null;
  contenedor.hidden = false;
  const ficha = detalle.ficha || detalle.referencia, fondo = cssUrl(ficha.background || ficha.poster);
  const variableImagen = fondo ? ` style="--imagen:${escapeHTML(fondo)}"` : '';
  contenedor.innerHTML = `<div class="dhero ${toneClass(ficha.name)}"${variableImagen}><span class="hero-ambiente"></span><span class="hero-arte"></span><button class="iconbtn" data-act="closedetail" aria-label="Volver">${ICONOS.back}</button></div>
  <div class="dbody"><div class="d-cabecera"><div class="d-poster">${posterHTML(ficha)}</div><div class="d-info"><h1>${escapeHTML(ficha.name)}</h1>${detailBodyHTML(detalle, ficha)}</div></div></div>`;
  if (plataforma.esTv) restoreDetailFocus(contenedor, accionPrevia, detalle.cargando);
}

function closeDetail() {
  updateState({ detalle: null });
}

// ============================================================
// MI LISTA
// ============================================================

function toggleLib(referencia) {
  const guardada = toggleLibrary(referencia, (estado.detalle && estado.detalle.ficha) || {});
  toast(guardada ? 'Guardado en tu lista' : 'Quitado de tu lista');
}

export { openDetail, renderDetail, closeDetail, toggleLib };
