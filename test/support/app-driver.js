/*
Telón - Conductor de la app para pruebas (jsdom)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Carga index.html y los módulos de js/ en un DOM simulado, con red, reloj y puente
de plataforma falsos. Lo usan las pruebas unitarias, las de aceptación y las de flujo.
*/
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { JSDOM } = require('jsdom');
const { route } = require('./fixtures');

// ============================================================
// CONSTANTES
// ============================================================

const WWW = path.join(__dirname, '..', '..', 'app', 'src', 'main', 'assets', 'www');
const INICIO_RELOJ = 1700000000000;
const PASO_ESPERA_MS = 60;

const readIndex = (carpeta = WWW) => fs.readFileSync(path.join(carpeta, 'index.html'), 'utf8');
const listScripts = html => [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

// ============================================================
// ENTORNO
// ============================================================

// modo: 'android-tv' | 'android-phone' | 'tizen' | 'browser'
function installPlatform(w, modo, log) {
  if (modo.startsWith('android')) {
    w.TelonBridge = new Proxy({}, {
      get: (_, metodo) => metodo === 'isTv'
        ? () => modo === 'android-tv'
        : (...args) => log.push('bridge ' + String(metodo) + ' ' + JSON.stringify(args))
    });
  } else if (modo === 'tizen') {
    w.tizen = {
      tvinputdevice: { registerKey: tecla => log.push('tizen registerKey ' + tecla) },
      application: { getCurrentApplication: () => ({ exit: () => log.push('tizen exit') }) }
    };
  }
}

function installFakes(w, opciones, log, prompts) {
  let ahora = INICIO_RELOJ;
  w.Date.now = () => (ahora += 1000);
  const responder = opciones.route || route;
  w.fetch = async (url, init = {}) => {
    const respuesta = responder(String(url), init);
    log.push('fetch ' + (init.method || 'GET') + ' ' + url + (init.body ? ' ' + init.body : ''));
    // Cada respuesta llega en su propio turno del reloj, en el orden en que se pidió, como en una red real.
    await new Promise(r => setTimeout(r, 1));
    const status = respuesta.status || 200;
    return { ok: status < 400, status, url: String(url), json: async () => respuesta.json, text: async () => respuesta.text ?? JSON.stringify(respuesta.json) };
  };
  w.URL.createObjectURL = () => 'blob:sub';
  w.prompt = () => prompts.shift() ?? null;
  w.confirm = () => true;
  w.console.warn = () => {}; // logIgnored escribe aquí; en pruebas solo ensucia la salida.
  // jsdom no implementa pistas de texto ni reproducción.
  const pistasFalsas = () => { const lista = []; lista.addEventListener = () => {}; return lista; };
  Object.defineProperty(w.HTMLMediaElement.prototype, 'textTracks', { get() { return this._tt || (this._tt = pistasFalsas()); } });
  Object.defineProperty(w.HTMLTrackElement.prototype, 'track', { get() { return this._trk || (this._trk = { mode: 'disabled' }); } });
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.Element.prototype.scrollIntoView = function () {};
}

// ============================================================
// CARGA
// ============================================================

// soloModulos: carga hasta ese script (sin main.js) para probar módulos sueltos sin arrancar la app.
function loadApp(opciones = {}) {
  const modo = opciones.modo || 'android-tv';
  // www: otra carpeta con la app (por ejemplo build/tizen, ya transpilada para Samsung).
  const carpeta = opciones.www || WWW;
  const indice = readIndex(carpeta);
  const scripts = listScripts(indice);
  const hasta = opciones.hasta ? scripts.indexOf(opciones.hasta) + 1 : scripts.length;
  const html = indice.replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://telon.local/index.html', pretendToBeVisual: true });
  const w = dom.window;
  const log = [], prompts = [], errores = [];
  if (opciones.almacen) Object.entries(opciones.almacen).forEach(([k, v]) => w.localStorage.setItem('telon.' + k, JSON.stringify(v)));
  // Stryker activa cada mutante con una variable de entorno; el código corre dentro de jsdom y no ve process.
  if (process.env.__STRYKER_ACTIVE_MUTANT__) w.process = { env: { __STRYKER_ACTIVE_MUTANT__: process.env.__STRYKER_ACTIVE_MUTANT__ } };
  installPlatform(w, modo, log);
  installFakes(w, opciones, log, prompts);
  w.addEventListener('error', e => errores.push(String((e.error && e.error.stack) || e.message)));
  w.addEventListener('unhandledrejection', e => errores.push('rejection ' + String((e.reason && e.reason.stack) || e.reason)));
  // vm.Script con la ruta real: los errores muestran el archivo y la cobertura se atribuye a cada módulo.
  const contexto = dom.getInternalVMContext();
  scripts.slice(0, hasta).forEach(src => {
    const archivo = path.join(carpeta, src);
    new vm.Script(fs.readFileSync(archivo, 'utf8'), { filename: archivo }).runInContext(contexto);
  });
  return createDriver(dom, log, prompts, errores);
}

function createDriver(dom, log, prompts, errores) {
  const w = dom.window;
  const settle = async (veces = 1) => { for (let i = 0; i < veces; i++) await new Promise(r => setTimeout(r, PASO_ESPERA_MS)); };
  const click = selector => {
    const elemento = w.document.querySelector(selector);
    if (!elemento) throw new Error('No existe ' + selector);
    elemento.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  };
  // Para acciones que no tienen botón visible en el modo actual (p. ej. pestañas de navegación).
  const act = accion => {
    const boton = w.document.createElement('button');
    boton.dataset.act = accion;
    w.document.body.appendChild(boton);
    boton.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    boton.remove();
  };
  const type = (selector, valor) => {
    const campo = w.document.querySelector(selector);
    campo.value = valor;
    campo.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  const storage = () => Object.fromEntries(Object.keys(w.localStorage).sort().map(k => [k, w.localStorage.getItem(k)]));
  // El aviso de subtítulos es pasajero (se borra a los 900 ms): si sigue o no en pantalla depende de
  // la carga de la máquina, así que no forma parte de la captura.
  const snapshot = nombre => ({ nombre, body: w.document.body.innerHTML.replace(/<div id="_subFlash"[^>]*>.*?<\/div>/, ''), storage: storage(), log: log.splice(0) });
  return { window: w, document: w.document, Telon: w.Telon, log, prompts, errores, settle, click, act, type, storage, snapshot, close: () => w.close() };
}

// Los objetos creados dentro de jsdom tienen otro Object.prototype; para compararlos los pasamos a JSON.
const plain = valor => JSON.parse(JSON.stringify(valor));

module.exports = { WWW, loadApp, listScripts, readIndex, plain };
