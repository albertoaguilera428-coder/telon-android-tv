/*
Telón - Conductor de la app para pruebas (jsdom)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Carga index.html y los módulos de js/ en un DOM simulado, con red, reloj y puente
de plataforma falsos. Lo usan las pruebas unitarias, las de aceptación y las de flujo.

jsdom no ejecuta módulos ES, así que cada módulo se carga como función: sus import pasan
a ser const y sus export se juntan al final, sin cambiar el largo de ninguna línea. Así
los errores apuntan a la línea real y la cobertura se cuenta archivo por archivo.
También carga una app ya empaquetada (build/tizen), que trae scripts clásicos.
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

const WWW = path.join(__dirname, '..', '..', 'web');
const INICIO_RELOJ = 1700000000000;
const PASO_ESPERA_MS = 60;

const ENTRADA_MODULOS = /<script type="module" src="([^"]+)"><\/script>/;

const readIndex = (carpeta = WWW) => fs.readFileSync(path.join(carpeta, 'index.html'), 'utf8');
const listScripts = html => [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

// ============================================================
// MÓDULOS ES COMO FUNCIONES (MISMO LARGO DE LÍNEA)
// ============================================================

// La cobertura de V8 se cuenta por posición dentro del archivo: cada reemplazo se rellena con
// espacios hasta el largo original para que las posiciones no se corran.
const sameLength = (original, nuevo) => (nuevo.length <= original.length ? nuevo.padEnd(original.length, ' ') : nuevo);
const COMILLAS = `['"]`;
const IMPORTAR_NOMBRES = new RegExp(`^import \\{([^}]*)\\} from (${COMILLAS})([^'"]+)\\2;`, 'gm');
const IMPORTAR_TODO = new RegExp(`^import \\* as ([\\w$]+) from (${COMILLAS})([^'"]+)\\2;`, 'gm');
const IMPORTAR_EFECTO = new RegExp(`^import (${COMILLAS})([^'"]+)\\1;`, 'gm');
const EXPORTAR_DECLARACION = /^export (?=(?:async function|function|const|let|class) ([A-Za-z_$][\w$]*))/gm;
const EXPORTAR_LISTA = /^export \{([^}]*)\};/gm;

function moduleToFunctionBody(codigo) {
  const exportados = [];
  const cuerpo = codigo
    .replace(IMPORTAR_NOMBRES, (linea, nombres, _, ruta) => sameLength(linea, `const {${nombres.replace(/\s+as\s+/g, ':')}}=$i('${ruta}');`))
    .replace(IMPORTAR_TODO, (linea, nombre, _, ruta) => sameLength(linea, `const ${nombre}=$i('${ruta}');`))
    .replace(IMPORTAR_EFECTO, (linea, _, ruta) => sameLength(linea, `$i('${ruta}');`))
    .replace(EXPORTAR_DECLARACION, (texto, nombre) => { exportados.push(nombre); return sameLength(texto, ''); })
    .replace(EXPORTAR_LISTA, (linea, nombres) => { exportados.push(...nombres.split(',').map(n => n.trim()).filter(Boolean)); return sameLength(linea, ''); });
  // Al final, en una línea nueva: no corre ninguna posición del código original.
  return cuerpo + `\n;$e({ ${exportados.join(', ')} });`;
}

// js/infra/addons/narto.js → ['infra', 'narto']; js/ui/player-view.js → ['ui', 'playerView'].
function namespaceFor(rutaRelativa) {
  const partes = rutaRelativa.replace(/^js\//, '').replace(/\.js$/, '').split('/');
  const nombre = partes[partes.length - 1].replace(/-([a-z])/g, (_, letra) => letra.toUpperCase());
  return partes.length > 1 ? [partes[0], nombre] : [nombre];
}

// Carga un módulo y sus dependencias (cada una una sola vez). Devuelve el espacio de nombres
// Telon con lo que se cargó, para que las pruebas lleguen a cada módulo: Telon.app.state, etc.
function createModuleLoader(carpeta, contexto) {
  const cargados = new Map();
  const Telon = {};
  const load = archivo => {
    if (cargados.has(archivo)) return cargados.get(archivo);
    const exportados = {};
    cargados.set(archivo, exportados);
    const cuerpo = moduleToFunctionBody(fs.readFileSync(archivo, 'utf8'));
    const funcion = vm.compileFunction(cuerpo, ['$i', '$e'], { filename: archivo, parsingContext: contexto });
    funcion(ruta => load(path.resolve(path.dirname(archivo), ruta)), valores => Object.assign(exportados, valores));
    const [capa, nombre] = namespaceFor(path.relative(carpeta, archivo).split(path.sep).join('/'));
    if (nombre) (Telon[capa] = Telon[capa] || {})[nombre] = exportados;
    return exportados;
  };
  return { load, Telon };
}

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
    // Igual que un navegador: un error HTTP también trae cuerpo (vacío si no hay contenido).
    const status = respuesta.status || 200;
    return { ok: status < 400, status, url: String(url), json: async () => respuesta.json, text: async () => respuesta.text ?? (respuesta.json === undefined ? '' : JSON.stringify(respuesta.json)) };
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

// Lo que importa main.js, en su orden: cargarlo todo sin ejecutar el arranque.
function importsOf(archivo) {
  return [...fs.readFileSync(archivo, 'utf8').matchAll(/^import (?:.* from )?['"]([^'"]+)['"];/gm)]
    .map(m => path.resolve(path.dirname(archivo), m[1]));
}

// hasta: módulo (o lista de módulos) a cargar con sus dependencias, sin arrancar la app (main.js).
// sinArrancar: carga todos los módulos de la app pero no ejecuta main.js.
// www: otra carpeta con la app (por ejemplo build/tizen, ya empaquetada para Samsung).
function loadApp(opciones = {}) {
  const modo = opciones.modo || 'android-tv';
  const carpeta = opciones.www || WWW;
  const indice = readIndex(carpeta);
  const entradaModulos = indice.match(ENTRADA_MODULOS);
  const html = indice.replace(/<script( type="module")? src="[^"]+"><\/script>/g, '');
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
  const contexto = dom.getInternalVMContext();
  if (!entradaModulos) {
    // App empaquetada: scripts clásicos, en orden.
    listScripts(indice).forEach(src => {
      const archivo = path.join(carpeta, src);
      new vm.Script(fs.readFileSync(archivo, 'utf8'), { filename: archivo }).runInContext(contexto);
    });
    return createDriver(dom, log, prompts, errores, {});
  }
  const cargador = createModuleLoader(carpeta, contexto);
  const principal = path.join(carpeta, entradaModulos[1]);
  if (opciones.sinArrancar) importsOf(principal).forEach(cargador.load);
  else if (opciones.hasta) [].concat(opciones.hasta).forEach(entrada => cargador.load(path.join(carpeta, entrada)));
  else cargador.load(principal);
  return createDriver(dom, log, prompts, errores, cargador.Telon);
}

// Lo que no es comportamiento no entra en la captura: comentarios y saltos de línea de index.html
// (cambian con cada módulo agregado) y el aviso de subtítulos, que es pasajero (se borra a los 900 ms
// y si sigue en pantalla o no depende de la carga de la máquina).
const normalizeBody = html => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<div id="_subFlash"[^>]*>.*?<\/div>/, '')
  .replace(/\n{2,}/g, '\n');

function createDriver(dom, log, prompts, errores, Telon) {
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
  const snapshot = nombre => ({ nombre, body: normalizeBody(w.document.body.innerHTML), storage: storage(), log: log.splice(0) });
  return { window: w, document: w.document, Telon, log, prompts, errores, settle, click, act, type, storage, snapshot, close: () => w.close() };
}

// Los objetos creados dentro de jsdom tienen otro Object.prototype; para compararlos los pasamos a JSON.
const plain = valor => JSON.parse(JSON.stringify(valor));

module.exports = { WWW, loadApp, listScripts, readIndex, plain, normalizeBody, moduleToFunctionBody };
