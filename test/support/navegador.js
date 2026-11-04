/*
Telón - Herramientas para las pruebas en Chromium
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lo que comparten las pruebas que abren la app empaquetada en un Chromium real: el paquete
(el mismo telon.js que va al APK), un servidor local, la plataforma simulada (puente de
Android o API de Tizen) y las respuestas de red de prueba.
*/
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildSync } = require('esbuild');
const { route } = require('./fixtures');

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.join(__dirname, '..', '..');
const PAQUETE = path.join(RAIZ, 'build', 'web-pruebas');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };

// ============================================================
// PAQUETE Y SERVIDOR
// ============================================================

// Se empaqueta como para el APK. avatar-prueba.js expone el redimensionado de fotos para probarlo
// con el canvas real de Chromium (el paquete no expone nada hacia afuera).
let empaquetado = false;
function packageApp() {
  if (empaquetado) return;
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'empaquetar-web.mjs'), PAQUETE], { stdio: 'ignore' });
  buildSync({ entryPoints: [path.join(RAIZ, 'web', 'js', 'ui', 'avatar-image.js')], bundle: true, format: 'iife', globalName: 'avatarImage', outfile: path.join(PAQUETE, 'avatar-prueba.js'), logLevel: 'error' });
  empaquetado = true;
}

function startStaticServer() {
  const servidor = http.createServer((peticion, respuesta) => {
    const ruta = path.join(PAQUETE, decodeURIComponent(new URL(peticion.url, 'http://x').pathname));
    if (!ruta.startsWith(PAQUETE) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { respuesta.writeHead(404); respuesta.end(); return; }
    respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
    fs.createReadStream(ruta).pipe(respuesta);
  });
  return new Promise(resolver => servidor.listen(0, '127.0.0.1', () => resolver(servidor)));
}

// ============================================================
// PLATAFORMA SIMULADA
// ============================================================

// Se inyecta antes que la página (y en cada recarga): simula el puente de Android o la API de
// Tizen. conPerfil deja un perfil creado; sin él, la app arranca como la primera vez.
function platformInitScript(modo, { conPerfil = true } = {}) {
  return `
    window.__violacionesCSP = [];
    document.addEventListener('securitypolicyviolation', e => window.__violacionesCSP.push(e.violatedDirective + ' ' + e.blockedURI));
    ${conPerfil ? `localStorage.setItem('telon.profiles', JSON.stringify([{ id: 'p1', name: 'Ana', color: '#B23A48', pin: '' }]));
    localStorage.setItem('telon.activeProfile', JSON.stringify('p1'));` : ''}
    ${modo.startsWith('android') ? `window.TelonBridge = { isTv: () => ${modo === 'android-tv'}, setOrientation() {}, openEmbed() {}, closeEmbed() {}, downloadAndInstall() {}, openExternal() {} };` : ''}
    ${modo === 'tizen' ? `window.tizen = { tvinputdevice: { registerKey() {} }, application: { getCurrentApplication: () => ({ exit() {} }) } };` : ''}
  `;
}

// Opciones de pantalla por modo: celular táctil, Android TV (960 px que el WebView lleva a 1920)
// y Samsung (1920 px reales).
function contextOptions(modo) {
  if (modo === 'android-phone') return { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
  if (modo === 'android-tv') return { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true };
  return { viewport: { width: 1920, height: 1080 } };
}

// ============================================================
// RED DE PRUEBA
// ============================================================

// Pósters de prueba: ilustraciones SVG generadas (colores y formas según la URL) para ver el diseño
// con imágenes reales y no solo con el respaldo de color.
function posterArt(url) {
  let semilla = 0;
  for (const c of url) semilla = (semilla * 31 + c.charCodeAt(0)) >>> 0;
  const tono = semilla % 360;
  const color = (desplazamiento, luz) => `hsl(${(tono + desplazamiento) % 360},85%,${luz}%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color(0, 55)}"/><stop offset="1" stop-color="${color(70, 22)}"/></linearGradient></defs>
    <rect width="400" height="600" fill="url(#g)"/>
    <circle cx="300" cy="170" r="130" fill="${color(150, 65)}" opacity=".55"/>
    <circle cx="90" cy="420" r="160" fill="${color(220, 45)}" opacity=".45"/>
    <path d="M0 470 Q200 380 400 480 L400 600 L0 600 Z" fill="${color(30, 12)}" opacity=".8"/></svg>`;
}

function fulfillWith(solicitud, respuesta) {
  if (respuesta.status) return solicitud.fulfill({ status: respuesta.status, body: '' });
  const cuerpo = respuesta.text ?? JSON.stringify(respuesta.json);
  return solicitud.fulfill({ status: 200, body: cuerpo, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': respuesta.text ? 'text/html' : 'application/json' } });
}

async function answerFromFixtures(solicitud) {
  if (/^https:\/\/img\//.test(solicitud.request().url())) {
    return solicitud.fulfill({ status: 200, body: posterArt(solicitud.request().url()), headers: { 'Content-Type': 'image/svg+xml' } });
  }
  return fulfillWith(solicitud, route(solicitud.request().url()));
}

// ============================================================
// CHROMIUM
// ============================================================

let chromium = null;
try {
  chromium = require('playwright-core').chromium;
} catch (error) {
  console.warn('playwright-core no está instalado', error.message);
}

// Abre Chromium o salta la prueba con un aviso (es una puerta del pipeline, no de cada máquina).
async function launchOrSkip(t) {
  try {
    return await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return null;
  }
}

module.exports = { RAIZ, PAQUETE, packageApp, startStaticServer, platformInitScript, contextOptions, answerFromFixtures, fulfillWith, launchOrSkip };
