/*
Telón - Pruebas del reproductor: fuentes, episodios, toques y gestos
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lo que hace el reproductor cuando el video avisa algo (falla, termina, se pausa) y cuando
el usuario toca o desliza. Se maneja como lo haría una persona: eventos del <video>,
toques en la pantalla y botones del reproductor.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../support/app-driver');

const CON_PERFIL = { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' };
const ANIMACION_CAMBIO_EPISODIO_MS = 220;

async function openPlayer(modo = 'android-phone') {
  const app = loadApp({ modo, almacen: CON_PERFIL });
  await app.settle(2);
  app.click('.card[data-k*="tt001"]');
  await app.settle(2);
  app.click('[data-act="play:0"]');
  await app.settle(3);
  const reproductor = app.Telon.app.state.estado.reproductor;
  return { app, reproductor, video: reproductor.video };
}

// jsdom no reproduce: fijamos a mano lo que el navegador informaría (posición y duración).
function setPosition(video, segundos, duracion = 600) {
  Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: segundos });
  Object.defineProperty(video, 'duration', { configurable: true, writable: true, value: duracion });
}

function swipe(app, desdeY, hastaY) {
  const escenario = app.document.querySelector('#player .stage');
  const toque = (tipo, propiedad, y) => {
    const evento = new app.window.Event(tipo, { bubbles: true });
    Object.defineProperty(evento, propiedad, { value: [{ clientX: 100, clientY: y }] });
    escenario.dispatchEvent(evento);
  };
  toque('touchstart', 'touches', desdeY);
  toque('touchend', 'changedTouches', hastaY);
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const centerText = app => app.document.querySelector('#pcenter').textContent;
const toastText = app => app.document.querySelector('#toast').textContent;

// ============================================================
// FUENTES
// ============================================================

// En Samsung todas las fuentes van por el <video> (los embeds necesitan el WebView de Android).
test('si la fuente falla, prueba la siguiente y avisa; sin más fuentes muestra el error con salidas', async () => {
  const { app, reproductor, video } = await openPlayer('tizen');
  const urlActual = () => reproductor.sesion.fuentes[reproductor.sesion.indiceFuente].url;
  assert.equal(video.getAttribute('src'), urlActual());
  const primera = urlActual();
  video.dispatchEvent(new app.window.Event('error'));
  assert.notEqual(urlActual(), primera);
  assert.equal(video.getAttribute('src'), urlActual());
  assert.match(toastText(app), /Probando otra fuente/);
  while (reproductor.sesion.indiceFuente < reproductor.sesion.fuentes.length - 1) video.dispatchEvent(new app.window.Event('error'));
  video.dispatchEvent(new app.window.Event('error'));
  assert.match(centerText(app), /No se pudo reproducir este episodio/);
  assert.ok(app.document.querySelector('#pcenter [data-p="retry"]'), 'ofrece reintentar');
  assert.ok(app.document.querySelector('#pcenter [data-p="sources"]'), 'ofrece elegir otra fuente');
  app.close();
});

test('si falla la última fuente, el error se queda a la vista aunque play() también se rechace', async () => {
  const { app, reproductor, video } = await openPlayer('tizen');
  // Así se comporta el navegador: el intento de reproducir una fuente rota también se rechaza, y
  // ese rechazo llega después del aviso de error.
  const noSoportada = Object.assign(new app.window.Error('sin fuente compatible'), { name: 'NotSupportedError' });
  video.play = () => Promise.reject(noSoportada);
  while (reproductor.sesion.indiceFuente < reproductor.sesion.fuentes.length - 1) video.dispatchEvent(new app.window.Event('error'));
  video.dispatchEvent(new app.window.Event('error'));
  await new Promise(r => setTimeout(r, 0));
  assert.match(centerText(app), /No se pudo reproducir este episodio/);
  assert.ok(app.document.querySelector('#pcenter [data-p="retry"]'), 'Reintentar sigue a la vista');
  app.close();
});

test('si el navegador bloquea la reproducción automática, aparece el botón de play', async () => {
  const { app, video } = await openPlayer('tizen');
  const bloqueada = Object.assign(new app.window.Error('falta un toque'), { name: 'NotAllowedError' });
  video.play = () => Promise.reject(bloqueada);
  app.click('[data-p="sources"]');
  app.click('[data-p="src:1"]');
  await new Promise(r => setTimeout(r, 0));
  assert.ok(app.document.querySelector('#pcenter .bubble'));
  app.close();
});

test('cambiar de fuente sigue desde el mismo segundo', async () => {
  const { app, reproductor, video } = await openPlayer();
  setPosition(video, 77);
  app.click('[data-p="sources"]');
  app.click('[data-p="src:1"]');
  assert.equal(video.getAttribute('src'), reproductor.sesion.fuentes[1].url);
  assert.equal(app.document.querySelector('#psheet').innerHTML, '', 'el panel se cierra');
  setPosition(video, 0);
  video.dispatchEvent(new app.window.Event('loadedmetadata'));
  assert.equal(video.currentTime, 77);
  app.close();
});

// ============================================================
// EPISODIOS
// ============================================================

test('al terminar un episodio pasa solo al siguiente', async () => {
  const { app, reproductor, video } = await openPlayer();
  setPosition(video, 600);
  video.dispatchEvent(new app.window.Event('ended'));
  assert.match(centerText(app), /Cargando siguiente capítulo/);
  await wait(ANIMACION_CAMBIO_EPISODIO_MS + 50);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 1);
  app.close();
});

test('al terminar el último episodio queda en pausa, sin saltar a ningún lado', async () => {
  const { app, reproductor, video } = await openPlayer();
  const ultimo = reproductor.sesion.episodios.length - 1;
  app.click('[data-p="eps"]');
  app.click('[data-p="pseason:2"]');
  app.click(`[data-p="ep:${ultimo}"]`);
  await app.settle(2);
  video.dispatchEvent(new app.window.Event('ended'));
  await wait(ANIMACION_CAMBIO_EPISODIO_MS + 50);
  assert.equal(reproductor.sesion.indice, ultimo);
  assert.ok(app.document.querySelector('#pcenter .bubble'), 'muestra el botón de reproducir');
  app.close();
});

test('deslizar hacia arriba pasa al siguiente episodio y el toque al soltar no pausa', async () => {
  const { app, reproductor, video } = await openPlayer();
  let reproducciones = 0;
  video.play = () => { reproducciones++; return Promise.resolve(); };
  swipe(app, 600, 300);
  app.click('[data-p="tap"]'); // El navegador dispara un "click" al soltar el dedo.
  assert.equal(reproducciones, 0, 'el toque del gesto no cuenta como tocar el video');
  await wait(ANIMACION_CAMBIO_EPISODIO_MS + 50);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 1);
  app.close();
});

test('deslizar hacia abajo en el primer episodio avisa y no cambia nada', async () => {
  const { app, reproductor } = await openPlayer();
  swipe(app, 300, 600);
  assert.match(toastText(app), /Es el primer episodio/);
  assert.equal(reproductor.sesion.indice, 0);
  app.close();
});

test('un deslizamiento corto o de lado no cambia de episodio', async () => {
  const { app, reproductor } = await openPlayer();
  swipe(app, 400, 360);
  await wait(ANIMACION_CAMBIO_EPISODIO_MS + 50);
  assert.equal(reproductor.sesion.indice, 0);
  app.close();
});

// ============================================================
// TOQUES Y CONTROLES
// ============================================================

test('con los controles ocultos, el primer toque los muestra y el segundo reproduce o pausa', async () => {
  const { app, video } = await openPlayer();
  const contenedor = app.document.querySelector('#player');
  let reproducciones = 0;
  video.play = () => { reproducciones++; return Promise.resolve(); };
  contenedor.classList.add('hide-ui');
  app.click('[data-p="tap"]');
  assert.ok(!contenedor.classList.contains('hide-ui'), 'aparecen los controles');
  assert.equal(reproducciones, 0, 'el primer toque no reproduce');
  app.click('[data-p="tap"]');
  assert.equal(reproducciones, 1);
  app.close();
});

test('al pausar se ven los controles y el botón de reproducir', async () => {
  const { app, video } = await openPlayer();
  const contenedor = app.document.querySelector('#player');
  contenedor.classList.add('hide-ui');
  video.dispatchEvent(new app.window.Event('pause'));
  assert.ok(!contenedor.classList.contains('hide-ui'));
  assert.ok(app.document.querySelector('#pcenter .bubble'));
  app.close();
});

test('al empezar a reproducir, los controles se ocultan solos a los dos segundos', async () => {
  const { app, video } = await openPlayer();
  const contenedor = app.document.querySelector('#player');
  video.dispatchEvent(new app.window.Event('playing'));
  assert.equal(centerText(app), '', 'se quita el "cargando"');
  assert.ok(!contenedor.classList.contains('hide-ui'));
  await wait(2100);
  assert.ok(contenedor.classList.contains('hide-ui'));
  app.close();
});

test('silenciar y cambiar la velocidad se aplican al video y se ven en la barra', async () => {
  const { app, video } = await openPlayer();
  app.click('[data-p="mute"]');
  assert.equal(video.muted, true);
  assert.match(app.document.querySelector('[data-p="mute"]').textContent, /Mute/);
  app.click('[data-p="speed"]');
  assert.notEqual(video.playbackRate, 1);
  assert.match(app.document.querySelector('[data-p="speed"]').textContent, new RegExp(video.playbackRate + 'x'));
  app.close();
});

// ============================================================
// SUBTÍTULOS
// ============================================================

test('apagar los subtítulos oculta todas las pistas y prenderlos las vuelve a mostrar', async () => {
  const { app, video } = await openPlayer();
  const pista = { mode: 'showing', cues: null, addEventListener() {} };
  video.textTracks.length = 1;
  video.textTracks[0] = pista;
  app.click('[data-p="subs"]');
  app.click('[data-p="subtoggle"]');
  assert.equal(pista.mode, 'disabled');
  app.click('[data-p="subtoggle"]');
  assert.equal(pista.mode, 'showing');
  app.close();
});

test('cada subtítulo nuevo aparece en la línea que eligió el usuario', async () => {
  const { app, reproductor } = await openPlayer();
  app.click('[data-p="subs"]');
  app.click('[data-p="subpos:-1"]');
  const linea = reproductor.sesion.lineaSubs;
  let alCambiar = null;
  const cue = { line: 'auto' };
  const pista = { mode: 'disabled', activeCues: [cue], addEventListener: (tipo, funcion) => { if (tipo === 'cuechange') alCambiar = funcion; } };
  // El navegador avisa "addtrack" a este manejador (las pistas falsas de jsdom no despachan eventos).
  app.Telon.ui.playerSubtitles.onTrackAdded({ track: pista });
  alCambiar();
  assert.equal(cue.line, linea);
  assert.equal(pista.mode, 'showing', 'con subtítulos activos la pista nueva se muestra');
  app.close();
});
