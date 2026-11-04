/*
Telón - Pruebas de interfaz en Chromium (celular, tablet y TV)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Abre la app en un Chromium real con los tamaños de pantalla que soportamos y revisa que
nada se salga de la pantalla y que la navegación y el contenido estén a la vista. Deja
capturas en build/capturas/ para revisarlas a ojo en el pull request.

Si Chromium no está instalado (npx playwright-core install chromium), la prueba se salta
con un aviso: es una puerta del pipeline, no de cada máquina.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WWW } = require('../support/app-driver');
const { route } = require('../support/fixtures');

// ============================================================
// CONSTANTES
// ============================================================

const CAPTURAS = path.join(__dirname, '..', '..', 'build', 'capturas');
const DISPOSITIVOS = [
  { nombre: 'celular', modo: 'android-phone', viewport: { width: 390, height: 844 }, escala: 3, tactil: true },
  { nombre: 'tablet', modo: 'android-phone', viewport: { width: 820, height: 1180 }, escala: 2, tactil: true },
  { nombre: 'android-tv', modo: 'android-tv', viewport: { width: 960, height: 540 }, escala: 2, tactil: false },
  { nombre: 'samsung', modo: 'tizen', viewport: { width: 1920, height: 1080 }, escala: 1, tactil: false }
];
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };

// ============================================================
// ENTORNO
// ============================================================

function startStaticServer() {
  const servidor = http.createServer((peticion, respuesta) => {
    const ruta = path.join(WWW, decodeURIComponent(new URL(peticion.url, 'http://x').pathname));
    if (!ruta.startsWith(WWW) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { respuesta.writeHead(404); respuesta.end(); return; }
    respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
    fs.createReadStream(ruta).pipe(respuesta);
  });
  return new Promise(resolver => servidor.listen(0, '127.0.0.1', () => resolver(servidor)));
}

// Se inyecta antes que la página: simula el puente de Android o la API de Tizen y deja un perfil creado.
function platformInitScript(modo) {
  return `
    localStorage.setItem('telon.profiles', JSON.stringify([{ id: 'p1', name: 'Ana', color: '#B23A48', pin: '' }]));
    localStorage.setItem('telon.activeProfile', JSON.stringify('p1'));
    ${modo.startsWith('android') ? `window.TelonBridge = { isTv: () => ${modo === 'android-tv'}, setOrientation() {}, openEmbed() {}, closeEmbed() {}, downloadAndInstall() {}, openExternal() {} };` : ''}
    ${modo === 'tizen' ? `window.tizen = { tvinputdevice: { registerKey() {} }, application: { getCurrentApplication: () => ({ exit() {} }) } };` : ''}
  `;
}

async function answerFromFixtures(solicitud) {
  const respuesta = route(solicitud.request().url());
  if (respuesta.status) return solicitud.fulfill({ status: respuesta.status, body: '' });
  const cuerpo = respuesta.text ?? JSON.stringify(respuesta.json);
  return solicitud.fulfill({ status: 200, body: cuerpo, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': respuesta.text ? 'text/html' : 'application/json' } });
}

// Lo que se sale a la derecha obliga a hacer scroll horizontal: en TV ni siquiera se puede.
const measureLayout = () => {
  const nav = document.querySelector('#nav');
  const caja = nav.getBoundingClientRect();
  return {
    desborde: document.documentElement.scrollWidth - window.innerWidth,
    navVisible: caja.width > 0 && caja.height > 0 && caja.top >= 0 && caja.bottom <= window.innerHeight + 1,
    tarjetas: [...document.querySelectorAll('.card')].filter(c => c.getBoundingClientRect().width > 0).length,
    esTv: document.body.classList.contains('tv')
  };
};

// ============================================================
// PRUEBAS
// ============================================================

let chromium = null;
try {
  chromium = require('playwright-core').chromium;
} catch (error) {
  console.warn('playwright-core no está instalado', error.message);
}

test('la interfaz cabe y se ve bien en celular, tablet, Android TV y Samsung', async (t) => {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return;
  }
  const servidor = await startStaticServer();
  const base = `http://127.0.0.1:${servidor.address().port}/index.html`;
  fs.mkdirSync(CAPTURAS, { recursive: true });
  try {
    for (const dispositivo of DISPOSITIVOS) {
      await t.test(dispositivo.nombre, async () => {
        const contexto = await navegador.newContext({ viewport: dispositivo.viewport, deviceScaleFactor: dispositivo.escala, hasTouch: dispositivo.tactil, isMobile: dispositivo.tactil });
        await contexto.addInitScript(platformInitScript(dispositivo.modo));
        await contexto.route(url => !url.href.startsWith(base.replace('index.html', '')), answerFromFixtures);
        const pagina = await contexto.newPage();
        const errores = [];
        pagina.on('pageerror', error => errores.push(error.message));
        await pagina.goto(base);
        await pagina.waitForSelector('.card');
        const inicio = await pagina.evaluate(measureLayout);
        await pagina.screenshot({ path: path.join(CAPTURAS, dispositivo.nombre + '-inicio.png') });
        await pagina.click('.card[data-k*="tt001"]');
        await pagina.waitForSelector('.dbody .ep');
        const ficha = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await pagina.screenshot({ path: path.join(CAPTURAS, dispositivo.nombre + '-ficha.png') });
        await contexto.close();

        assert.deepEqual(errores, []);
        assert.equal(inicio.esTv, !dispositivo.tactil, 'interfaz equivocada para ' + dispositivo.nombre);
        assert.ok(inicio.desborde <= 0, `el inicio se desborda ${inicio.desborde}px`);
        assert.ok(ficha <= 0, `la ficha se desborda ${ficha}px`);
        assert.ok(inicio.navVisible, 'la navegación no está a la vista');
        assert.ok(inicio.tarjetas > 0, 'no se ven tarjetas');
      });
    }
  } finally {
    await navegador.close();
    servidor.close();
  }
});
