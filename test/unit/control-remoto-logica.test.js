/*
Telón - Pruebas de la lógica del control remoto (foco, capas y reproductor)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

jsdom no calcula posiciones: aquí cada botón recibe una posición fija y la prueba decide
dónde está cada cosa. Así se prueban directamente las reglas del control (a qué botón va el
foco, qué capa manda, qué hace cada tecla en el reproductor), que antes solo cubrían los
recorridos en Chromium y quedaban fuera de las pruebas de mutación.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');

const TECLA = { ARRIBA: 19, ABAJO: 20, IZQUIERDA: 21, DERECHA: 22, CENTRO: 23, ENTER: 66, PLAY_PAUSA: 85, STOP: 86, SIGUIENTE: 87, ANTERIOR: 88, RETROCEDER: 89, ADELANTAR: 90, PLAY: 126, PAUSA: 127 };
const CON_PERFIL = { profiles: [{ id: 'p', name: 'Ana', color: '#000' }], activeProfile: 'p' };

// ============================================================
// POSICIONES DE MENTIRA
// ============================================================

// Cada elemento se ubica con place(); el resto mide cero. Un elemento dentro de [hidden] no tiene
// offsetParent, igual que en un navegador.
function installLayout(app) {
  const w = app.window;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const r = this.__caja || { left: 0, top: 0, width: 0, height: 0 };
    return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.closest('[hidden]') ? null : this.parentElement; } });
  const revelados = [];
  w.HTMLElement.prototype.scrollIntoView = function () { revelados.push(this); };
  return { revelados };
}

const place = (elemento, left, top, width = 100, height = 40) => { elemento.__caja = { left, top, width, height }; return elemento; };

// Una pantalla con barra (Inicio activo, Biblioteca) y contenido: dos filas de botones.
function buildScreen(app) {
  const d = app.document;
  d.querySelector('#nav').innerHTML = '<button data-act="tab:home" class="on">Inicio</button><button data-act="tab:lib">Biblioteca</button>';
  d.querySelector('#screen').innerHTML = '<button data-act="a1">A1</button><button data-act="a2">A2</button><button data-act="b1">B1</button><button hidden data-act="oculto">X</button><button data-act="cero">Y</button>';
  const [inicio, biblioteca] = d.querySelectorAll('#nav button');
  place(inicio, 0, 0); place(biblioteca, 600, 0);
  const boton = act => d.querySelector(`[data-act="${act}"]`);
  place(boton('a1'), 0, 200); place(boton('a2'), 200, 200); place(boton('b1'), 0, 400); place(boton('oculto'), 0, 300);
  return { inicio, biblioteca, boton };
}

function loadRemote() {
  const app = loadApp({ modo: 'android-tv', hasta: 'js/ui/tv-remote.js' });
  const { revelados } = installLayout(app);
  return { app, remoto: app.Telon.ui.tvRemote, revelados, enfocado: () => app.document.activeElement };
}

// ============================================================
// MOVER EL FOCO
// ============================================================

test('sin nada enfocado, la primera flecha enfoca la pestaña activa de la barra', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { inicio } = buildScreen(app);
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), inicio);
  app.close();
});

test('sin pestaña activa, la primera flecha enfoca la primera de la barra; sin barra, lo primero que haya', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { inicio, boton } = buildScreen(app);
  inicio.classList.remove('on');
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), inicio);
  app.document.activeElement.blur();
  app.document.querySelector('#nav').innerHTML = '';
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), boton('a1'));
  app.close();
});

test('las flechas mueven el foco al botón más cercano en esa dirección y lo hacen visible', () => {
  const { app, remoto, enfocado, revelados } = loadRemote();
  const { boton } = buildScreen(app);
  boton('a1').focus();
  remoto.handleTvKey(TECLA.DERECHA);
  assert.equal(enfocado(), boton('a2'));
  assert.equal(revelados.at(-1), boton('a2'), 'se lleva a la vista');
  remoto.handleTvKey(TECLA.IZQUIERDA);
  assert.equal(enfocado(), boton('a1'));
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), boton('b1'), 'salta el botón oculto y el que mide cero');
  app.close();
});

test('un botón que mide cero de alto o de ancho no recibe el foco', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { boton } = buildScreen(app);
  place(boton('b1'), 0, 400, 100, 0);
  place(boton('cero'), 0, 600, 0, 40);
  boton('a1').focus();
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), boton('a1'), 'ni el de alto cero ni el de ancho cero cuentan');
  app.close();
});

test('el foco se lleva a la vista con el movimiento mínimo (sin saltos)', () => {
  const { app, remoto } = loadRemote();
  const { boton } = buildScreen(app);
  const opciones = [];
  boton('a2').scrollIntoView = valor => opciones.push(valor);
  boton('a1').focus();
  remoto.handleTvKey(TECLA.DERECHA);
  assert.deepEqual(plain(opciones), [{ block: 'nearest', inline: 'nearest' }]);
  app.close();
});

test('en una pantalla sin nada enfocable, las flechas no hacen nada ni fallan', () => {
  const { app, remoto } = loadRemote();
  app.document.querySelector('#nav').innerHTML = '';
  app.document.querySelector('#screen').innerHTML = '<p>Sin botones</p>';
  assert.doesNotThrow(() => remoto.handleTvKey(TECLA.ABAJO));
  app.close();
});

test('si no hay nada en esa dirección, el foco se queda donde está', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { boton } = buildScreen(app);
  boton('b1').focus();
  remoto.handleTvKey(TECLA.ABAJO);
  remoto.handleTvKey(TECLA.IZQUIERDA);
  assert.equal(enfocado(), boton('b1'));
  app.close();
});

test('desde el contenido, la barra es el último recurso y se llega a la pestaña activa', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { inicio, biblioteca, boton } = buildScreen(app);
  boton('b1').focus();
  remoto.handleTvKey(TECLA.ARRIBA);
  assert.equal(enfocado(), boton('a1'), 'primero lo que queda en el contenido');
  boton('a2').focus();
  inicio.classList.remove('on'); biblioteca.classList.add('on');
  remoto.handleTvKey(TECLA.ARRIBA);
  assert.equal(enfocado(), biblioteca, 'en la barra, la pestaña activa (no Inicio, que está más cerca)');
  app.close();
});

test('desde el contenido se prefiere lo de la pantalla aunque haya quedado fuera de vista y la barra esté más cerca', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { boton } = buildScreen(app);
  // a1 quedó arriba, fuera de la pantalla por el scroll; la barra está más cerca de b1.
  place(boton('a1'), 0, -600); place(boton('a2'), 200, -600);
  boton('b1').focus();
  remoto.handleTvKey(TECLA.ARRIBA);
  assert.equal(enfocado(), boton('a1'));
  app.close();
});

test('desde la barra se baja al contenido', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { inicio, boton } = buildScreen(app);
  inicio.focus();
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), boton('a1'));
  app.close();
});

test('con la ficha abierta solo cuenta la ficha; con el reproductor, solo el reproductor', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { boton } = buildScreen(app);
  const d = app.document;
  const ficha = d.querySelector('#detail');
  ficha.hidden = false;
  ficha.innerHTML = '<button data-act="closedetail">Volver</button>';
  place(ficha.firstChild, 0, 100);
  boton('b1').focus();
  remoto.handleTvKey(TECLA.ARRIBA);
  assert.equal(enfocado(), ficha.firstChild, 'el foco entra a la ficha, no va a lo que está detrás');
  const reproductor = d.querySelector('#player');
  reproductor.hidden = false;
  reproductor.innerHTML = '<button data-p="back">←</button>';
  place(reproductor.firstChild, 0, 50);
  ficha.firstChild.focus();
  remoto.moveTvFocus('up');
  assert.equal(enfocado(), reproductor.firstChild);
  app.close();
});

test('con un panel del reproductor abierto, el foco no sale del panel', () => {
  const { app, remoto, enfocado } = loadRemote();
  const reproductor = app.document.querySelector('#player');
  reproductor.hidden = false;
  reproductor.innerHTML = '<button data-p="back">←</button><div id="psheet"><div class="sheet"><button data-p="ep:0">1</button><button data-p="ep:1">2</button></div></div>';
  const [volver, ep0, ep1] = reproductor.querySelectorAll('button');
  place(volver, 0, 0); place(ep0, 0, 300); place(ep1, 200, 300);
  ep0.focus();
  remoto.moveTvFocus('up');
  assert.equal(enfocado(), ep0, 'arriba no lleva al botón volver, que está fuera del panel');
  remoto.moveTvFocus('right');
  assert.equal(enfocado(), ep1);
  app.close();
});

test('OK activa lo enfocado; sin nada enfocado no hace nada', () => {
  const { app, remoto } = loadRemote();
  const { boton } = buildScreen(app);
  let clics = 0;
  boton('a2').addEventListener('click', () => clics++);
  remoto.handleTvKey(TECLA.ENTER);
  assert.equal(clics, 0);
  boton('a2').focus();
  remoto.handleTvKey(TECLA.ENTER);
  remoto.handleTvKey(TECLA.CENTRO);
  assert.equal(clics, 2, 'OK y el botón central hacen lo mismo');
  app.close();
});

test('una tecla que no es de navegación no mueve el foco', () => {
  const { app, remoto, enfocado } = loadRemote();
  const { boton } = buildScreen(app);
  boton('a1').focus();
  remoto.handleTvKey(65);
  assert.equal(enfocado(), boton('a1'));
  app.close();
});

// ============================================================
// EL REPRODUCTOR
// ============================================================

async function openPlayer() {
  const app = loadApp({ modo: 'android-tv', almacen: CON_PERFIL });
  installLayout(app);
  await app.settle(2);
  app.click('.card[data-k*="tt001"]');
  await app.settle(2);
  app.click('[data-act="play:0"]');
  await app.settle(3);
  const reproductor = app.Telon.app.state.estado.reproductor;
  const video = reproductor.video;
  Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 100 });
  Object.defineProperty(video, 'duration', { configurable: true, writable: true, value: 600 });
  // La barra lateral en columna y el botón volver arriba a la izquierda.
  const contenedor = app.document.querySelector('#player');
  place(contenedor.querySelector('[data-p="back"]'), 0, 0, 48, 48);
  place(contenedor.querySelector('.srcchip'), 800, 0, 200, 48);
  contenedor.querySelectorAll('#prail button').forEach((b, i) => place(b, 900, 200 + i * 70, 60, 60));
  return { app, reproductor, video, remoto: app.Telon.ui.tvRemote, contenedor, enfocado: () => app.document.activeElement };
}

test('mirando: → y ← adelantan y retroceden 10 s; OK pausa y reanuda', async () => {
  const { app, video, remoto, contenedor } = await openPlayer();
  contenedor.classList.add('hide-ui');
  remoto.handleTvKey(TECLA.DERECHA);
  assert.equal(video.currentTime, 110);
  assert.equal(contenedor.classList.contains('hide-ui'), false, 'cualquier tecla muestra los controles');
  remoto.handleTvKey(TECLA.IZQUIERDA);
  assert.equal(video.currentTime, 100);
  let reproducciones = 0, pausas = 0, enPausa = true;
  video.play = () => { reproducciones++; enPausa = false; return Promise.resolve(); };
  video.pause = () => { pausas++; enPausa = true; };
  Object.defineProperty(video, 'paused', { configurable: true, get: () => enPausa });
  remoto.handleTvKey(TECLA.ENTER);
  assert.equal(reproducciones, 1);
  remoto.handleTvKey(TECLA.CENTRO);
  assert.equal(pausas, 1);
  app.close();
});

test('mirando: ↑ o ↓ llevan el foco al primer botón de la barra lateral', async () => {
  const { app, remoto, contenedor, enfocado } = await openPlayer();
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), contenedor.querySelector('#prail button'));
  app.document.activeElement.blur();
  remoto.handleTvKey(TECLA.ARRIBA);
  assert.equal(enfocado(), contenedor.querySelector('#prail button'));
  app.document.querySelector('#prail').innerHTML = '';
  app.document.activeElement.blur();
  remoto.handleTvKey(TECLA.ABAJO);
  assert.equal(enfocado(), contenedor.querySelector('[data-p="back"]'), 'sin barra lateral, el botón volver');
  app.close();
});

test('en los controles: las flechas recorren los botones y OK activa el enfocado', async () => {
  const { app, video, remoto, enfocado } = await openPlayer();
  remoto.handleTvKey(TECLA.ABAJO);
  const primero = enfocado().dataset.p;
  remoto.handleTvKey(TECLA.ABAJO);
  assert.notEqual(enfocado().dataset.p, primero, 'baja por la barra lateral (a otro botón, no el mismo repintado)');
  assert.equal(video.currentTime, 100, 'en los controles, las flechas no adelantan');
  const accion = enfocado().dataset.p;
  assert.equal(accion, 'eps');
  remoto.handleTvKey(TECLA.CENTRO);
  assert.equal(app.Telon.app.state.estado.reproductor.panel, 'eps', 'el botón central activa el enfocado (Episodios abre su panel)');
  app.close();
});

test('en los controles, OK también activa; una tecla desconocida no mueve el foco', async () => {
  const { app, remoto, enfocado } = await openPlayer();
  remoto.handleTvKey(TECLA.ABAJO);
  remoto.handleTvKey(TECLA.ABAJO);
  remoto.handleTvKey(65);
  assert.equal(enfocado().dataset.p, 'eps', 'una tecla que no es de navegación no mueve el foco');
  remoto.handleTvKey(TECLA.ENTER);
  assert.equal(app.Telon.app.state.estado.reproductor.panel, 'eps');
  app.close();
});

test('cada tecla muestra los controles y programa que se oculten solos', async () => {
  const { app, reproductor, remoto } = await openPlayer();
  const antes = reproductor._temporizadorUi;
  remoto.handleTvKey(TECLA.IZQUIERDA);
  assert.notEqual(reproductor._temporizadorUi, antes, 'se programó ocultar los controles');
  assert.ok(reproductor.temporizadores.has(reproductor._temporizadorUi));
  app.close();
});

test('sin botones en el reproductor, ↑ o ↓ no fallan', async () => {
  const { app, remoto, contenedor } = await openPlayer();
  app.document.querySelector('#prail').innerHTML = '';
  contenedor.querySelector('[data-p="back"]').remove();
  assert.doesNotThrow(() => remoto.handleTvKey(TECLA.ABAJO));
  app.close();
});

test('un elemento del reproductor que no es botón (el video) no cuenta como estar en los controles', async () => {
  const { app, video, remoto } = await openPlayer();
  video.tabIndex = 0;
  video.focus();
  remoto.handleTvKey(TECLA.DERECHA);
  assert.equal(video.currentTime, 110, 'con el foco en el video, → adelanta');
  app.close();
});

test('teclas multimedia: play, pausa y play/pausa funcionan aunque haya foco en los controles', async () => {
  const { app, video, remoto } = await openPlayer();
  let reproducciones = 0, pausas = 0, enPausa = true;
  video.play = () => { reproducciones++; enPausa = false; return Promise.resolve(); };
  video.pause = () => { pausas++; enPausa = true; };
  Object.defineProperty(video, 'paused', { configurable: true, get: () => enPausa });
  remoto.handleTvKey(TECLA.ABAJO);
  remoto.handleTvKey(TECLA.PAUSA);
  assert.equal(pausas, 1);
  remoto.handleTvKey(TECLA.PLAY);
  assert.equal(reproducciones, 1);
  remoto.handleTvKey(TECLA.PLAY_PAUSA);
  assert.equal(pausas, 2, 'play/pausa pausa lo que se está reproduciendo');
  remoto.handleTvKey(TECLA.PLAY_PAUSA);
  assert.equal(reproducciones, 2, 'y reanuda lo pausado');
  app.close();
});

test('adelantar y retroceder (teclas o multimedia) se topan con el principio y con la duración', async () => {
  const { app, video, remoto } = await openPlayer();
  video.currentTime = 595;
  remoto.handleTvKey(TECLA.ADELANTAR);
  assert.equal(video.currentTime, 600, 'no pasa del final');
  video.currentTime = 4;
  remoto.handleTvKey(TECLA.RETROCEDER);
  assert.equal(video.currentTime, 0, 'no pasa del principio');
  video.duration = 0;
  video.currentTime = 50;
  remoto.handleTvKey(TECLA.ADELANTAR);
  assert.equal(video.currentTime, 60, 'sin duración conocida, solo avanza');
  app.close();
});

test('siguiente y anterior cambian de episodio sin pasarse de la lista', async () => {
  const { app, reproductor, remoto } = await openPlayer();
  remoto.handleTvKey(TECLA.ANTERIOR);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 0, 'en el primero, anterior no hace nada');
  remoto.handleTvKey(TECLA.SIGUIENTE);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 1);
  remoto.handleTvKey(TECLA.SIGUIENTE);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 2);
  remoto.handleTvKey(TECLA.SIGUIENTE);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 2, 'en el último, siguiente no hace nada');
  remoto.handleTvKey(TECLA.ANTERIOR);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 1);
  remoto.handleTvKey(TECLA.ANTERIOR);
  await app.settle();
  assert.equal(reproductor.sesion.indice, 0, 'anterior llega hasta el primero');
  app.close();
});

test('stop cierra el reproductor', async () => {
  const { app, remoto } = await openPlayer();
  remoto.handleTvKey(TECLA.STOP);
  assert.equal(app.Telon.app.state.estado.reproductor, null);
  app.close();
});

test('una tecla desconocida en el reproductor no hace nada (y no rompe)', async () => {
  const { app, video, remoto } = await openPlayer();
  remoto.handleTvKey(65);
  remoto.handleTvKey(TECLA.ABAJO);
  remoto.handleTvKey(65);
  assert.equal(video.currentTime, 100);
  assert.ok(app.Telon.app.state.estado.reproductor, 'el reproductor sigue abierto');
  app.close();
});
