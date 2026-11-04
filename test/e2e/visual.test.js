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
    window.__violacionesCSP = [];
    document.addEventListener('securitypolicyviolation', e => window.__violacionesCSP.push(e.violatedDirective + ' ' + e.blockedURI));
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
    esTv: document.body.classList.contains('tv'),
    violacionesCSP: window.__violacionesCSP.slice()
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
        assert.deepEqual(inicio.violacionesCSP, [], 'la política de seguridad bloqueó algo legítimo');
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

// El WebView de Android carga la app desde file://: ahí la CSP y las rutas relativas se comportan
// distinto que por HTTP, así que se prueba también así.
test('cargada desde file:// (como el WebView de Android) funciona sin violar la CSP', async (t) => {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return;
  }
  try {
    const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await contexto.addInitScript(platformInitScript('android-phone'));
    await contexto.route(url => /^https?:/.test(url.href), answerFromFixtures);
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', error => errores.push(error.message));
    await pagina.goto('file://' + path.join(WWW, 'index.html'));
    await pagina.waitForSelector('.card', { timeout: 10000 });
    const medidas = await pagina.evaluate(measureLayout);
    await contexto.close();
    assert.deepEqual(errores, []);
    assert.deepEqual(medidas.violacionesCSP, []);
    assert.ok(medidas.tarjetas > 0);
  } finally {
    await navegador.close();
  }
});

test('una foto grande de la galería se guarda reducida a 256 px y pesa pocos KB', async (t) => {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return;
  }
  try {
    const contexto = await navegador.newContext();
    await contexto.addInitScript(platformInitScript('android-phone'));
    await contexto.route(url => /^https?:/.test(url.href), answerFromFixtures);
    const pagina = await contexto.newPage();
    await pagina.goto('file://' + path.join(WWW, 'index.html'));
    const resultado = await pagina.evaluate(async () => {
      // Foto de 4000×3000 con ruido para que no se comprima trivialmente, como una de celular.
      const lienzo = document.createElement('canvas');
      lienzo.width = 4000; lienzo.height = 3000;
      const ctx = lienzo.getContext('2d');
      const ruido = ctx.createImageData(4000, 3000);
      for (let i = 0; i < ruido.data.length; i++) ruido.data[i] = (i * 2654435761) % 256;
      ctx.putImageData(ruido, 0, 0);
      const archivo = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', 0.95));
      const dataUrl = await window.Telon.ui.avatarImage.resizeToAvatar(archivo);
      const imagen = new Image();
      await new Promise(r => { imagen.onload = r; imagen.src = dataUrl; });
      return { original: archivo.size, guardado: dataUrl.length, ancho: imagen.naturalWidth, alto: imagen.naturalHeight };
    });
    await contexto.close();
    assert.equal(resultado.ancho, 256);
    assert.equal(resultado.alto, 256);
    assert.ok(resultado.guardado < 200 * 1024, `quedó en ${resultado.guardado} bytes`);
    assert.ok(resultado.original > 1024 * 1024, 'la foto de prueba debería pesar más de 1 MB');
    console.log(`  foto: ${(resultado.original / 1048576).toFixed(1)} MB → ${(resultado.guardado / 1024).toFixed(0)} KB guardados`);
  } finally {
    await navegador.close();
  }
});
