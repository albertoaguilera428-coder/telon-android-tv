/*
Telón - Pintado de pantallas y navegación
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

render() decide qué pantalla se pinta según la pestaña activa, arma la barra de
navegación, conserva el scroll y en TV devuelve el foco al botón equivalente. Cada
pantalla vive en su archivo (*-screen.js y home.js).
*/
'use strict';

import { $ } from './dom.js';
import * as plataforma from '../infra/platform.js';
import { estado, updateState } from '../app/state.js';
import { clearCards } from './components.js';
import { homeHTML, homeBody, loadHome } from './home.js';
import { profileScreenHTML } from './profiles-screen.js';
import { addonsHTML } from './addons-screen.js';
import { libHTML } from './library-screen.js';
import { settingsHTML } from './settings-screen.js';
import { ICONOS } from './icons.js';

// ============================================================
// CONSTANTES
// ============================================================

const PESTANAS_NAVEGACION = [['home', 'Inicio', ICONOS.home], ['lib', 'Biblioteca', ICONOS.lib], ['settings', 'Ajustes', ICONOS.gear]];
// Esperamos a que el DOM nuevo esté pintado antes de poner el foco del control remoto.
const ESPERA_FOCO_TV_MS = 50;

// ============================================================
// RENDER PRINCIPAL
// ============================================================

const PANTALLAS = { addons: addonsHTML, settings: settingsHTML, lib: libHTML };

// render() reemplaza el HTML y el botón enfocado desaparece. Recordamos qué acción tenía para
// devolverle el foco al botón equivalente: si no, cada clic te mandaba a otro lado de la pantalla.
function describeFocusedButton() {
  const enfocado = document.activeElement;
  if (!enfocado || !enfocado.dataset || !enfocado.dataset.act) return null;
  return { accion: enfocado.dataset.act, clave: enfocado.dataset.k };
}

function findEquivalentButton(descripcion) {
  if (!descripcion) return null;
  return [...document.querySelectorAll('#screen [data-act], #nav [data-act]')]
    .find(b => b.dataset.act === descripcion.accion && b.dataset.k === descripcion.clave) || null;
}

// En TV no hay dedo que toque: si nadie tiene el foco, el control remoto no sirve. Sin botón
// equivalente, la prioridad es la pestaña activa, luego la pantalla. Se consulta por separado
// porque una lista de selectores devuelve el primero en orden del documento, no por prioridad.
function restoreTvFocus(descripcion) {
  setTimeout(() => {
    // Si alguien ya puso el foco en un campo a propósito (abrir el buscador), se respeta.
    if (document.activeElement && document.activeElement.matches('#screen input')) return;
    const objetivo = findEquivalentButton(descripcion) || document.querySelector('#nav button.on')
      || document.querySelector('#screen button') || document.querySelector('#nav button');
    if (objetivo) { objetivo.focus(); objetivo.scrollIntoView({ block: 'nearest' }); }
  }, ESPERA_FOCO_TV_MS);
}

// En TV la barra superior del celular (buscar, recargar, perfil) no se muestra: buscar va en la
// navegación; recargar y cambiar de perfil están en Ajustes.
function navigationHTML() {
  const pestanas = PESTANAS_NAVEGACION.map(([clave, etiqueta, icono]) => {
    const activa = estado.pestana === clave && !(plataforma.esTv && estado.busquedaAbierta && clave === 'home');
    return `<button class="${activa ? 'on' : ''}" data-act="tab:${clave}" ${activa ? 'aria-current="page"' : ''}><span class="pill">${icono}</span>${etiqueta}</button>`;
  }).join('');
  if (!plataforma.esTv) return pestanas;
  const buscando = estado.busquedaAbierta;
  return pestanas + `<button class="${buscando ? 'on' : ''}" data-act="search" ${buscando ? 'aria-current="page"' : ''}><span class="pill">${ICONOS.search}</span>Buscar</button>`;
}

// Pestaña que está pintada ahora: el scroll solo se conserva al repintar esa misma.
let pestanaPintada = null;

function render() {
  const focoPrevio = describeFocusedButton();
  if (estado.pantallaPerfiles) {
    pestanaPintada = null;
    $('#screen').innerHTML = profileScreenHTML();
    $('#nav').innerHTML = '';
    // Sin esto, al crear o borrar un perfil el foco se perdía y el control no tenía de dónde partir.
    if (plataforma.esTv) restoreTvFocus(focoPrevio);
    return;
  }
  // Al repintar la misma pestaña conservamos el scroll, si no cada toque te mandaría al inicio de
  // la lista. Al cambiar de pestaña se empieza arriba: el scroll de otra pantalla no significa nada.
  const mismaPestana = pestanaPintada === estado.pestana;
  pestanaPintada = estado.pestana;
  // La pantalla se pinta de nuevo entera: las tarjetas que se registren son las únicas a la vista.
  clearCards();
  const scrollActual = document.querySelector('#screen .scroll');
  const scrollPrevio = scrollActual && mismaPestana ? scrollActual.scrollTop : 0;
  const pantalla = $('#screen');
  if (estado.pestana === 'home') {
    pantalla.innerHTML = homeHTML();
    homeBody();
  } else {
    pantalla.innerHTML = (PANTALLAS[estado.pestana] || libHTML)();
  }
  const scrollNuevo = document.querySelector('#screen .scroll');
  if (scrollNuevo && scrollPrevio) scrollNuevo.scrollTop = scrollPrevio;
  $('#nav').innerHTML = navigationHTML();
  if (plataforma.esTv) restoreTvFocus(focoPrevio);
}

function setTab(pestana) {
  updateState({ pestana, confirmarBorrado: null });
  if (pestana === 'home' && estado.filas === null && estado.addons.length && !estado.cargando) loadHome();
}

export { render, setTab };
