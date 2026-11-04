/*
Telón - Control remoto de TV
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Recibe las teclas del control (MainActivity en Android TV, el adaptador de plataforma en
Samsung) como códigos de Android KeyEvent y mueven el foco al elemento más cercano en esa
dirección. En el reproductor hay dos modos: mirando (izquierda y derecha adelantan o
retroceden, OK pausa, arriba o abajo muestran los controles) y en los controles (las
flechas recorren los botones del reproductor y OK los activa).
*/
'use strict';

import { estado } from '../app/state.js';
import { closePlayer, loadVideo, togglePlayback, scheduleHideUi } from './player.js';

// ============================================================
// CONSTANTES
// ============================================================

// Códigos de android.view.KeyEvent.
const TECLA = {
  ARRIBA: 19, ABAJO: 20, IZQUIERDA: 21, DERECHA: 22, CENTRO: 23, ENTER: 66,
  PLAY_PAUSA: 85, STOP: 86, SIGUIENTE: 87, ANTERIOR: 88, RETROCEDER: 89, ADELANTAR: 90, PLAY: 126, PAUSA: 127
};
const SALTO_SEGUNDOS = 10;
// Con cada tecla los controles del reproductor se muestran y se ocultan solos después de esto.
const OCULTAR_CONTROLES_TRAS_TECLA_MS = 4000;
// Tolerancia en px para no saltar a un elemento que está "casi" en la misma línea del lado contrario.
const UMBRAL_DIRECCION_PX = 20;
const DIRECCION_POR_TECLA = { 19: 'up', 20: 'down', 21: 'left', 22: 'right' };

// ============================================================
// NAVEGACIÓN POR FOCO
// ============================================================

const centerOf = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

// A los lados solo se pasa a algo de la misma fila: al final de una fila el foco se queda quieto
// en vez de saltar en diagonal a la barra de navegación o a otra sección.
const sharesRow = (a, b) => a.top < b.top + b.height && b.top < a.top + a.height;

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
    if ((direccion === 'left' || direccion === 'right') && !sharesRow(rectActual, rect)) return;
    const puntaje = scoreCandidate(direccion, rectActual, dx, dy);
    if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = i; }
  });
  return mejor;
}

// Solo cuenta la capa de arriba: un panel del reproductor, el reproductor, la ficha o la
// pantalla. Lo de abajo sigue en la página aunque esté tapado, y el foco no debe irse ahí.
function activeLayer() {
  const panel = document.querySelector('#player:not([hidden]) .sheet');
  if (panel) return panel;
  const capa = ['#player', '#detail'].map(selector => document.querySelector(selector)).find(elemento => elemento && !elemento.hidden);
  return capa || document;
}

function listFocusable(capa) {
  return [...capa.querySelectorAll('button,a,input,[tabindex]')].filter(elemento => {
    if (elemento.hidden || elemento.offsetParent === null) return false;
    const rect = elemento.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

const inNavBar = elemento => Boolean(elemento.closest('#nav'));

function focusAndReveal(elemento) {
  elemento.focus();
  elemento.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function moveTvFocus(direccion) {
  const enfocables = listFocusable(activeLayer());
  if (!enfocables.length) return;
  const actual = document.activeElement;
  if (!actual || actual === document.body || !enfocables.includes(actual)) {
    // Por separado a propósito: con una lista de selectores querySelector devuelve el primero
    // en el orden del documento, no la pestaña activa.
    const primero = enfocables.find(e => e.matches('#nav button.on')) || enfocables.find(inNavBar) || enfocables[0];
    focusAndReveal(primero);
    return;
  }
  const rectActual = actual.getBoundingClientRect();
  const elegir = lista => { const i = pickNextFocus(rectActual, lista.map(c => c.getBoundingClientRect()), direccion); return i < 0 ? null : lista[i]; };
  const candidatos = enfocables.filter(elemento => elemento !== actual);
  // Desde el contenido, la barra de navegación es el último recurso: primero lo que queda en la
  // pantalla (aunque esté fuera de vista por el scroll) y solo si no hay nada, la barra.
  const desdeContenido = !inNavBar(actual);
  let siguiente = (desdeContenido && elegir(candidatos.filter(e => !inNavBar(e)))) || elegir(candidatos);
  // Al subir del contenido a la barra se llega a la pestaña en la que se está, no a la más cercana.
  if (siguiente && desdeContenido && inNavBar(siguiente)) siguiente = candidatos.find(e => e.matches('#nav button.on')) || siguiente;
  if (siguiente) focusAndReveal(siguiente);
}

// ============================================================
// TECLAS CON EL REPRODUCTOR ABIERTO
// ============================================================

const playOrIgnore = v => v.play().catch(() => {});
const seekBack = v => { v.currentTime = Math.max(0, v.currentTime - SALTO_SEGUNDOS); };
// Adelantar se topa con la duración si la conocemos. En vivo (sin duración) solo avanzamos:
// antes se tomaba la duración como 0 y el video saltaba al inicio.
const seekForward = v => {
  const destino = v.currentTime + SALTO_SEGUNDOS;
  v.currentTime = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, destino) : destino;
};
const goToEpisode = (reproductor, salto) => {
  const destino = reproductor.sesion.indice + salto;
  if (destino >= 0 && destino < reproductor.sesion.episodios.length) loadVideo(destino);
};

// Las teclas multimedia funcionan siempre, se esté mirando o recorriendo los controles.
const TECLAS_MULTIMEDIA = {
  [TECLA.PLAY_PAUSA]: r => togglePlayback(r.video),
  [TECLA.PLAY]: r => playOrIgnore(r.video),
  [TECLA.PAUSA]: r => r.video.pause(),
  [TECLA.STOP]: () => closePlayer(),
  [TECLA.RETROCEDER]: r => seekBack(r.video),
  [TECLA.ADELANTAR]: r => seekForward(r.video),
  [TECLA.SIGUIENTE]: r => goToEpisode(r, 1),
  [TECLA.ANTERIOR]: r => goToEpisode(r, -1)
};

// Mirando: los controles no tienen el foco. Arriba o abajo los muestran y ponen el foco en el
// primero; antes no había forma de llegar a Episodios, Fuentes, Subtítulos ni al resto.
const focusFirstControl = () => {
  const primero = document.querySelector('#prail button') || document.querySelector('#player .pbtn');
  if (primero) primero.focus();
};
const TECLAS_MIRANDO = {
  [TECLA.CENTRO]: r => togglePlayback(r.video),
  [TECLA.ENTER]: r => togglePlayback(r.video),
  [TECLA.IZQUIERDA]: r => seekBack(r.video),
  [TECLA.DERECHA]: r => seekForward(r.video),
  [TECLA.ARRIBA]: focusFirstControl,
  [TECLA.ABAJO]: focusFirstControl
};

const hasKey = (tabla, codigo) => Object.prototype.hasOwnProperty.call(tabla, codigo);

function controlHasFocus() {
  const enfocado = document.activeElement, reproductor = document.getElementById('player');
  return Boolean(enfocado && enfocado !== document.body && reproductor && reproductor.contains(enfocado) && enfocado.matches('button'));
}

function revealControls(reproductor) {
  document.getElementById('player').classList.remove('hide-ui');
  scheduleHideUi(reproductor, OCULTAR_CONTROLES_TRAS_TECLA_MS);
}

// Devuelve true si la tecla ya se atendió.
function handlePlayerKey(reproductor, codigoTecla) {
  if (hasKey(TECLAS_MULTIMEDIA, codigoTecla)) { TECLAS_MULTIMEDIA[codigoTecla](reproductor); return true; }
  revealControls(reproductor);
  if (reproductor.panel || controlHasFocus()) {
    if (codigoTecla === TECLA.CENTRO || codigoTecla === TECLA.ENTER) { document.activeElement.click(); return true; }
    if (DIRECCION_POR_TECLA[codigoTecla]) { moveTvFocus(DIRECCION_POR_TECLA[codigoTecla]); return true; }
    return false;
  }
  if (!hasKey(TECLAS_MIRANDO, codigoTecla)) return false;
  TECLAS_MIRANDO[codigoTecla](reproductor);
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

export { TECLA, pickNextFocus, moveTvFocus, handleTvKey };
