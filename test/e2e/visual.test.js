/*
Telón - Pruebas de interfaz en Chromium (celular, tablet y TV)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Abre la app en un Chromium real con los tamaños de pantalla que soportamos y revisa que
nada se salga de la pantalla y que la navegación y el contenido estén a la vista. Prueba
la app empaquetada (telon.js), que es la que se instala en Android y Samsung. Deja
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
const { execFileSync } = require('child_process');
const { buildSync } = require('esbuild');
const { route } = require('../support/fixtures');

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.join(__dirname, '..', '..');
const CAPTURAS = path.join(RAIZ, 'build', 'capturas');
const PAQUETE = path.join(RAIZ, 'build', 'web-pruebas');
const DISPOSITIVOS = [
  { nombre: 'celular', modo: 'android-phone', viewport: { width: 390, height: 844 }, escala: 3, tactil: true },
  { nombre: 'tablet', modo: 'android-phone', viewport: { width: 820, height: 1180 }, escala: 2, tactil: true },
  // El WebView de Android TV respeta <meta viewport width=1920> (setUseWideViewPort); Chromium de escritorio
  // solo lo respeta emulando un dispositivo móvil, por eso respetaMeta.
  { nombre: 'android-tv', modo: 'android-tv', viewport: { width: 960, height: 540 }, escala: 2, tactil: false, respetaMeta: true },
  { nombre: 'samsung', modo: 'tizen', viewport: { width: 1920, height: 1080 }, escala: 1, tactil: false }
];
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };

// ============================================================
// ENTORNO
// ============================================================

// Se empaqueta una vez, como para el APK. avatar-prueba.js expone el redimensionado de fotos
// para probarlo con el canvas real de Chromium (el paquete no expone nada hacia afuera).
function packageApp() {
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'empaquetar-web.mjs'), PAQUETE], { stdio: 'ignore' });
  buildSync({ entryPoints: [path.join(RAIZ, 'web', 'js', 'ui', 'avatar-image.js')], bundle: true, format: 'iife', globalName: 'avatarImage', outfile: path.join(PAQUETE, 'avatar-prueba.js'), logLevel: 'error' });
}
packageApp();

function startStaticServer() {
  const servidor = http.createServer((peticion, respuesta) => {
    const ruta = path.join(PAQUETE, decodeURIComponent(new URL(peticion.url, 'http://x').pathname));
    if (!ruta.startsWith(PAQUETE) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { respuesta.writeHead(404); respuesta.end(); return; }
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

async function answerFromFixtures(solicitud) {
  if (/^https:\/\/img\//.test(solicitud.request().url())) {
    return solicitud.fulfill({ status: 200, body: posterArt(solicitud.request().url()), headers: { 'Content-Type': 'image/svg+xml' } });
  }
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
        const contexto = await navegador.newContext({ viewport: dispositivo.viewport, deviceScaleFactor: dispositivo.escala, hasTouch: dispositivo.tactil, isMobile: dispositivo.tactil || Boolean(dispositivo.respetaMeta) });
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
        await pagina.evaluate(() => window.telonBack());
        // El inicio queda bajado: Ajustes igual tiene que abrir arriba.
        await pagina.evaluate(() => { document.querySelector('#screen .scroll').scrollTop = 400; });
        await pagina.click('[data-act="tab:settings"]');
        await pagina.waitForSelector('.set-card');
        const ajustes = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const scrollAlEntrar = await pagina.evaluate(() => document.querySelector('#screen .scroll').scrollTop);
        // Repintar la misma pestaña (cambiar un interruptor) sí conserva dónde estaba el usuario.
        const scrollTrasCambio = await pagina.evaluate(() => {
          document.querySelector('#screen .scroll').scrollTop = 150;
          document.querySelector('[data-act="togglesubs"]').click();
          return document.querySelector('#screen .scroll').scrollTop;
        });
        await pagina.evaluate(() => { document.querySelector('[data-act="togglesubs"]').click(); document.querySelector('#screen .scroll').scrollTop = 0; });
        await pagina.screenshot({ path: path.join(CAPTURAS, dispositivo.nombre + '-ajustes.png') });
        await pagina.click('.set-card[data-act="showprofiles"]');
        await pagina.waitForSelector('.pf-grid');
        await pagina.screenshot({ path: path.join(CAPTURAS, dispositivo.nombre + '-perfiles.png') });
        await contexto.close();

        assert.deepEqual(errores, []);
        assert.deepEqual(inicio.violacionesCSP, [], 'la política de seguridad bloqueó algo legítimo');
        assert.equal(inicio.esTv, !dispositivo.tactil, 'interfaz equivocada para ' + dispositivo.nombre);
        assert.ok(inicio.desborde <= 0, `el inicio se desborda ${inicio.desborde}px`);
        assert.ok(ficha <= 0, `la ficha se desborda ${ficha}px`);
        assert.ok(ajustes <= 0, `los ajustes se desbordan ${ajustes}px`);
        assert.equal(scrollAlEntrar, 0, 'al cambiar de pestaña se arrastró el scroll de la anterior');
        assert.equal(scrollTrasCambio, 150, 'repintar la misma pestaña perdió el scroll');
        assert.ok(inicio.navVisible, 'la navegación no está a la vista');
        assert.ok(inicio.tarjetas > 0, 'no se ven tarjetas');
      });
    }
  } finally {
    await navegador.close();
    servidor.close();
  }
});

// Las pantallas que no están en el recorrido principal: biblioteca, addons, reproductor, hoja de
// subtítulos y aviso de actualización. Quedan capturadas para revisarlas y ninguna se desborda.
const desbordeHorizontal = () => document.documentElement.scrollWidth - window.innerWidth;
const pulsarAccion = accion => {
  const boton = document.createElement('button');
  boton.dataset.act = accion;
  document.body.appendChild(boton);
  boton.click();
  boton.remove();
};

test('biblioteca, addons, reproductor y avisos se ven bien en los cuatro dispositivos', async (t) => {
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
        const contexto = await navegador.newContext({ viewport: dispositivo.viewport, deviceScaleFactor: dispositivo.escala, hasTouch: dispositivo.tactil, isMobile: dispositivo.tactil || Boolean(dispositivo.respetaMeta) });
        await contexto.addInitScript(platformInitScript(dispositivo.modo));
        await contexto.route(url => !url.href.startsWith(base.replace('index.html', '')), answerFromFixtures);
        const pagina = await contexto.newPage();
        const errores = [];
        pagina.on('pageerror', error => errores.push(error.message));
        const capturar = nombre => pagina.screenshot({ path: path.join(CAPTURAS, `${dispositivo.nombre}-${nombre}.png`) });
        const desbordes = {};
        const medir = async nombre => { desbordes[nombre] = await pagina.evaluate(desbordeHorizontal); };

        await pagina.goto(base);
        await pagina.waitForSelector('.card');
        // Guarda dos títulos para que la biblioteca tenga contenido.
        for (const clave of ['tt001', 'tt002']) {
          await pagina.click(`.card[data-k*="${clave}"]`);
          await pagina.waitForSelector('[data-act="savelib"]');
          await pagina.click('[data-act="savelib"]');
          await pagina.evaluate(() => window.telonBack());
        }
        await pagina.evaluate(pulsarAccion, 'tab:lib');
        await pagina.waitForSelector('.grid3 .card');
        await medir('biblioteca'); await capturar('biblioteca');

        await pagina.evaluate(pulsarAccion, 'tab:addons');
        await pagina.waitForSelector('.addwrap');
        await medir('addons'); await capturar('addons');

        await pagina.evaluate(pulsarAccion, 'tab:home');
        await pagina.waitForSelector('.card[data-k*="tt001"]');
        await pagina.click('.card[data-k*="tt001"]');
        await pagina.waitForSelector('[data-act="play:0"]');
        await pagina.click('[data-act="play:0"]');
        await pagina.waitForSelector('#player .rail');
        await pagina.waitForTimeout(400);
        await medir('reproductor'); await capturar('reproductor');
        await pagina.click('[data-p="subs"]');
        await pagina.waitForSelector('.sheet');
        await medir('subtitulos'); await capturar('subtitulos');
        await pagina.evaluate(() => { window.telonBack(); window.telonBack(); window.telonBack(); });

        // El aviso aparece por el camino real: al arrancar, el servidor ofrece una versión más nueva.
        await contexto.route(url => url.href.includes('/telon/version.json'), solicitud => solicitud.fulfill({
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ version: 3, notes: 'Episodios más rápidos y un diseño nuevo.', url: 'https://ejemplo.com/telon.apk' })
        }));
        await pagina.reload();
        if (dispositivo.modo === 'tizen') {
          // En Samsung el .wgt se reinstala a mano: la app no ofrece actualizar.
          await pagina.waitForSelector('.card');
          await pagina.waitForTimeout(500);
          assert.equal(await pagina.$('.modal'), null, 'en Samsung no debe ofrecer actualizar');
        } else {
          await pagina.waitForSelector('.modal');
          await medir('actualizacion'); await capturar('actualizacion');
        }
        await contexto.close();

        assert.deepEqual(errores, []);
        for (const [pantalla, desborde] of Object.entries(desbordes)) assert.ok(desborde <= 0, `${pantalla} se desborda ${desborde}px`);
      });
    }
  } finally {
    await navegador.close();
    servidor.close();
  }
});

// Reproduce lo que reportaron desde un Android TV: con la flecha abajo el foco no bajaba de la
// barra, porque el navegador usaba la tecla para hacer scroll. Se prueba con teclas físicas, que
// es como llegan en el WebView, no llamando a _tvKey directamente.
test('con el control de Android TV el foco recorre la pantalla, entra a la ficha y vuelve', async (t) => {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return;
  }
  const servidor = await startStaticServer();
  const base = `http://127.0.0.1:${servidor.address().port}/index.html`;
  try {
    const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true });
    await contexto.addInitScript(platformInitScript('android-tv'));
    await contexto.route(url => !url.href.startsWith(base.replace('index.html', '')), answerFromFixtures);
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', error => errores.push(error.message));
    await pagina.goto(base);
    await pagina.waitForSelector('.card');
    await pagina.waitForTimeout(300);
    const foco = () => pagina.evaluate(() => {
      const elemento = document.activeElement;
      const caja = elemento.getBoundingClientRect();
      const barra = document.querySelector('#nav').getBoundingClientRect();
      return { accion: elemento.dataset.act || '', clave: elemento.dataset.k || '', enBarra: Boolean(elemento.closest('#nav')),
        enFicha: Boolean(elemento.closest('#detail')), tapadoPorLaBarra: !elemento.closest('#nav') && caja.top < barra.bottom - 1 };
    });
    const pulsar = async tecla => { await pagina.keyboard.press(tecla); await pagina.waitForTimeout(150); return foco(); };

    assert.ok((await foco()).enBarra, 'arranca en la barra de navegación');
    const filtros = await pulsar('ArrowDown');
    assert.ok(!filtros.enBarra, 'la flecha abajo sale de la barra');
    await pulsar('ArrowDown');
    const tarjeta = await pulsar('ArrowDown');
    assert.equal(tarjeta.accion, 'open');
    assert.equal(tarjeta.tapadoPorLaBarra, false, 'lo enfocado no queda escondido detrás de la barra');
    assert.deepEqual(await pulsar('ArrowRight').then(f => f.enBarra), false, 'al final de la fila no salta a la barra');

    await pulsar('Enter');
    // La ficha se pinta dos veces (cargando y completa); el foco tiene que terminar en Reproducir.
    await pagina.waitForSelector('#detail .actions');
    await pagina.waitForTimeout(150);
    const enFicha = await foco();
    assert.ok(enFicha.enFicha && enFicha.accion.startsWith('play:'), 'al abrir la ficha, el foco va a Reproducir');
    for (const tecla of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft']) {
      assert.ok((await pulsar(tecla)).enFicha, `con la ficha abierta, ${tecla} no lleva el foco a lo que está detrás`);
    }
    await pagina.evaluate(() => window.telonBack());
    await pagina.waitForTimeout(150);
    assert.equal((await foco()).clave, tarjeta.clave, 'al cerrar la ficha, el foco vuelve a la tarjeta que la abrió');
    await contexto.close();
    assert.deepEqual(errores, []);
  } finally {
    await navegador.close();
    servidor.close();
  }
});

// Todas las opciones del reproductor tienen que poder usarse con el control. Antes, con el video
// abierto, las flechas solo adelantaban y no había forma de llegar a Episodios, Fuentes, Subs…
async function openTvPlayer(navegador, base, { videoQueFalla = false, modo = 'android-tv' } = {}) {
  const contexto = await navegador.newContext(modo === 'tizen' ? { viewport: { width: 1920, height: 1080 } } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true });
  await contexto.addInitScript(platformInitScript(modo));
  await contexto.route(url => !url.href.startsWith(base.replace('index.html', '')), solicitud => {
    // El video de prueba no existe: o queda cargando (para recorrer los controles) o falla.
    if (solicitud.request().url().startsWith('https://cdn/')) return videoQueFalla ? solicitud.fulfill({ status: 404, body: '' }) : undefined;
    return answerFromFixtures(solicitud);
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', error => errores.push(error.message));
  await pagina.goto(base);
  await pagina.waitForSelector('.card[data-k*="tt001"]');
  await pagina.click('.card[data-k*="tt001"]');
  await pagina.waitForSelector('#detail .actions');
  await pagina.keyboard.press('Enter');
  await pagina.waitForSelector('#player .rail button');
  await pagina.waitForTimeout(300);
  const foco = () => pagina.evaluate(() => {
    const elemento = document.activeElement;
    return { p: elemento.dataset.p || '', enReproductor: Boolean(elemento.closest('#player')), enPanel: Boolean(elemento.closest('.sheet')),
      etiqueta: elemento.getAttribute('aria-label') || '', texto: elemento.textContent.trim(), marcado: elemento.getAttribute('aria-checked') };
  });
  const pulsar = async tecla => { await pagina.keyboard.press(tecla); await pagina.waitForTimeout(120); return foco(); };
  const atras = async () => { await pagina.evaluate(() => window.telonBack()); await pagina.waitForTimeout(120); return foco(); };
  const sesion = () => pagina.evaluate(() => window.__telon.reproductor && { indice: window.__telon.reproductor.sesion.indice, fuente: window.__telon.reproductor.sesion.indiceFuente, panel: window.__telon.reproductor.panel });
  return { contexto, pagina, errores, foco, pulsar, atras, sesion };
}

// Baja por la barra lateral hasta el botón con ese data-p (está en columna, de arriba abajo).
async function goToRailButton(pulsar, foco, accion) {
  for (let i = 0; i < 8 && (await foco()).p !== accion; i++) await pulsar('ArrowDown');
  return foco();
}

test('con el control de TV se usan todas las opciones del reproductor', async (t) => {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return;
  }
  const servidor = await startStaticServer();
  const base = `http://127.0.0.1:${servidor.address().port}/index.html`;
  try {
    const { contexto, pagina, errores, foco, pulsar, atras, sesion } = await openTvPlayer(navegador, base);

    // Mirando: izquierda y derecha no mueven el foco a ningún botón; abajo lleva a los controles.
    assert.equal((await pulsar('ArrowRight')).enReproductor, false, 'mirando, derecha adelanta (no recorre botones)');
    assert.ok((await pulsar('ArrowDown')).enReproductor, 'abajo lleva el foco a los controles del reproductor');
    assert.equal(await pagina.evaluate(() => document.querySelector('#player').classList.contains('hide-ui')), false, 'los controles están a la vista');

    // Sonido y velocidad: actúan y el foco se queda en el mismo botón aunque la barra se repinte.
    assert.equal((await goToRailButton(pulsar, foco, 'mute')).p, 'mute');
    const silenciado = await pulsar('Enter');
    assert.equal(silenciado.p, 'mute', 'el foco sigue en Sonido');
    assert.equal(silenciado.etiqueta, 'Activar sonido');
    assert.equal(await pagina.evaluate(() => window.__telon.reproductor.video.muted), true);
    await pulsar('ArrowDown');
    const velocidad = await pulsar('Enter');
    assert.equal(velocidad.p, 'speed');
    assert.notEqual(velocidad.texto, '1x');

    // Subtítulos: el panel se abre con el foco adentro, el interruptor responde y Atrás vuelve a Subs.
    await pulsar('ArrowUp'); await pulsar('ArrowUp');
    assert.equal((await foco()).p, 'subs');
    const enPanel = await pulsar('Enter');
    assert.ok(enPanel.enPanel && enPanel.p === 'subtoggle', 'el foco entra al panel, en el interruptor');
    const antes = enPanel.marcado;
    assert.notEqual((await pulsar('Enter')).marcado, antes, 'OK cambia el interruptor y el foco sigue ahí');
    for (const tecla of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowUp']) {
      assert.ok((await pulsar(tecla)).enPanel, `con el panel abierto, ${tecla} no sale del panel`);
    }
    const vuelta = await atras();
    assert.equal(vuelta.p, 'subs', 'Atrás cierra el panel y el foco vuelve a Subs');
    assert.equal((await sesion()).panel, null);

    // Episodios: el foco entra al episodio actual, se elige el siguiente y carga.
    await pulsar('ArrowUp'); await pulsar('ArrowUp');
    assert.equal((await foco()).p, 'eps');
    const episodioActual = await pulsar('Enter');
    assert.ok(episodioActual.enPanel && episodioActual.p === 'ep:0', 'el foco entra al episodio que se está viendo');
    await pulsar('ArrowRight');
    await pulsar('Enter');
    await pagina.waitForTimeout(300);
    assert.equal((await sesion()).indice, 1, 'se cambió al episodio elegido');
    assert.equal((await foco()).p, 'eps', 'al cerrar el panel el foco vuelve a Episodios');

    // Fuentes: el foco entra a la fuente actual y se puede elegir otra.
    await pulsar('ArrowDown');
    assert.equal((await foco()).p, 'sources');
    const fuenteAntes = (await sesion()).fuente;
    const fuenteActual = await pulsar('Enter');
    assert.ok(fuenteActual.enPanel && fuenteActual.p === 'src:' + fuenteAntes);
    await pulsar(fuenteAntes === 0 ? 'ArrowDown' : 'ArrowUp');
    await pulsar('Enter');
    assert.notEqual((await sesion()).fuente, fuenteAntes, 'se cambió de fuente');

    // Guardar en mi lista desde el reproductor.
    for (let i = 0; i < 4 && (await foco()).p !== 'save'; i++) await pulsar('ArrowUp');
    assert.equal((await pulsar('Enter')).etiqueta, 'Guardar en mi lista');
    assert.equal(await pagina.evaluate(() => document.querySelector('#prail [data-p="save"]').classList.contains('on')), true);

    // Arriba llega a la fuente y al botón de volver; OK en volver cierra el reproductor.
    await pulsar('ArrowUp');
    assert.equal((await pulsar('ArrowLeft')).p, 'back');
    await pulsar('Enter');
    await pagina.waitForTimeout(200);
    assert.equal(await sesion(), null, 'el botón volver cierra el reproductor');
    await contexto.close();
    assert.deepEqual(errores, []);

    // Si el video falla, el foco va solo a «Reintentar». En Samsung todas las fuentes van por el
    // <video> (en Android la primera de prueba es un embed, que abre la vista web nativa).
    const conError = await openTvPlayer(navegador, base, { videoQueFalla: true, modo: 'tizen' });
    await conError.pagina.waitForSelector('#pcenter [data-p="retry"]', { timeout: 10000 });
    await conError.pagina.waitForTimeout(150);
    assert.equal((await conError.foco()).p, 'retry', 'el foco cae en Reintentar');
    await conError.contexto.close();
    assert.deepEqual(conError.errores, []);
  } finally {
    await navegador.close();
    servidor.close();
  }
});

// Ajustes, perfiles, búsqueda y biblioteca con el control. Antes, en Ajustes varias opciones eran
// cajas a las que el control no llegaba, en TV no había cómo buscar y en perfiles el foco se perdía.
test('con el control de TV se llega a todo en ajustes, perfiles, búsqueda y biblioteca', async (t) => {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (error) {
    t.skip('Chromium no disponible: ' + error.message.split('\n')[0]);
    return;
  }
  const servidor = await startStaticServer();
  const base = `http://127.0.0.1:${servidor.address().port}/index.html`;
  try {
    const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true });
    await contexto.addInitScript(platformInitScript('android-tv'));
    await contexto.route(url => !url.href.startsWith(base.replace('index.html', '')), answerFromFixtures);
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', error => errores.push(error.message));
    pagina.on('dialog', dialogo => dialogo.accept(dialogo.type() === 'prompt' ? 'Beto' : undefined));
    await pagina.goto(base);
    await pagina.waitForSelector('.card');
    await pagina.waitForTimeout(300);
    const foco = () => pagina.evaluate(() => {
      const elemento = document.activeElement;
      const caja = elemento.getBoundingClientRect(), barra = document.querySelector('#nav').getBoundingClientRect();
      return { accion: elemento.dataset.act || elemento.id || '', enBarra: Boolean(elemento.closest('#nav')), tapado: !elemento.closest('#nav') && caja.top < barra.bottom - 1 };
    });
    const pulsar = async tecla => { await pagina.keyboard.press(tecla); await pagina.waitForTimeout(120); return foco(); };
    // Recorre hacia abajo y junta las acciones por las que pasa el foco.
    const recorrer = async veces => { const vistas = []; for (let i = 0; i < veces; i++) vistas.push((await pulsar('ArrowDown')).accion); return vistas; };

    // Ajustes: todas las opciones, de arriba abajo.
    await pulsar('ArrowRight'); await pulsar('ArrowRight'); await pulsar('Enter');
    await pagina.waitForSelector('.set-card');
    const vistas = await recorrer(16);
    for (const accion of ['showprofiles', 'authname', 'register', 'setquality', 'togglesubs', 'reloadaddons', 'clearhist', 'clearlib', 'clearall']) {
      assert.ok(vistas.includes(accion), `en Ajustes el control llega a ${accion}`);
    }

    // Biblioteca: al subir del contenido se llega a la pestaña activa, no a la más cercana.
    for (let i = 0; i < 20 && !(await foco()).enBarra; i++) await pulsar('ArrowUp');
    await pulsar('ArrowLeft'); await pulsar('Enter');
    await pagina.waitForSelector('.tabs');
    await pulsar('ArrowDown');
    assert.equal((await pulsar('ArrowUp')).accion, 'tab:lib', 'al subir a la barra, el foco cae en la pestaña activa');

    // Búsqueda: «Buscar» está en la navegación del TV y el campo no queda tapado por la barra.
    for (let i = 0; i < 4 && (await foco()).accion !== 'search'; i++) await pulsar('ArrowRight');
    const campo = await pulsar('Enter');
    assert.equal(campo.accion, 'q', 'Buscar lleva al campo de búsqueda');
    assert.equal(campo.tapado, false, 'el campo de búsqueda no queda escondido detrás de la barra');

    // Perfiles: tras crear uno, el foco sigue en la pantalla.
    await pagina.evaluate(() => window.telonBack());
    await pulsar('ArrowLeft'); await pulsar('ArrowLeft');
    for (let i = 0; i < 4 && (await foco()).accion !== 'tab:settings'; i++) await pulsar('ArrowRight');
    await pulsar('Enter'); await pagina.waitForSelector('.set-card');
    assert.equal((await pulsar('ArrowDown')).accion, 'showprofiles');
    await pulsar('Enter');
    await pagina.waitForSelector('.pf-grid');
    await pagina.waitForTimeout(150);
    for (let i = 0; i < 4 && (await foco()).accion !== 'addprofile'; i++) await pulsar('ArrowRight');
    await pulsar('Enter');
    await pagina.waitForTimeout(200);
    assert.notEqual((await foco()).accion, '', 'después de crear un perfil el foco no se pierde');
    await contexto.close();
    assert.deepEqual(errores, []);
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
    await pagina.goto('file://' + path.join(PAQUETE, 'index.html'));
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
    // bypassCSP: la prueba inyecta avatar-prueba.js; lo que se revisa aquí es la foto, no la CSP.
    const contexto = await navegador.newContext({ bypassCSP: true });
    await contexto.addInitScript(platformInitScript('android-phone'));
    await contexto.route(url => /^https?:/.test(url.href), answerFromFixtures);
    const pagina = await contexto.newPage();
    await pagina.goto('file://' + path.join(PAQUETE, 'index.html'));
    await pagina.addScriptTag({ path: path.join(PAQUETE, 'avatar-prueba.js') });
    const resultado = await pagina.evaluate(async () => {
      // Foto de 4000×3000 con ruido para que no se comprima trivialmente, como una de celular.
      const lienzo = document.createElement('canvas');
      lienzo.width = 4000; lienzo.height = 3000;
      const ctx = lienzo.getContext('2d');
      const ruido = ctx.createImageData(4000, 3000);
      for (let i = 0; i < ruido.data.length; i++) ruido.data[i] = (i * 2654435761) % 256;
      ctx.putImageData(ruido, 0, 0);
      const archivo = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', 0.95));
      const dataUrl = await window.avatarImage.resizeToAvatar(archivo);
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
