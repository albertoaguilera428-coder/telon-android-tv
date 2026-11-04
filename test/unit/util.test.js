/*
Telón - Pruebas de utilidades
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/ui/dom.js' });
const { escapeHTML, colorFor, toInitials, COLORES, safeUrl, cssUrl, safeColor } = app.Telon.ui.dom;
const { store } = app.Telon.infra.storage;
test.after(() => app.close());

// ============================================================
// escapeHTML
// ============================================================

test('escapeHTML convierte los cinco caracteres peligrosos', () => {
  assert.equal(escapeHTML(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
});

test('escapeHTML trata null y undefined como texto vacío', () => {
  assert.equal(escapeHTML(null), '');
  assert.equal(escapeHTML(undefined), '');
  assert.equal(escapeHTML(0), '0');
});

test('propiedad: la salida de escapeHTML nunca contiene < > " \' sin escapar y se puede revertir', () => {
  const revertir = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  fc.assert(fc.property(fc.string(), texto => {
    const salida = escapeHTML(texto);
    assert.ok(!/[<>"']/.test(salida));
    assert.equal(revertir(salida), texto);
  }));
});

// ============================================================
// colorFor y toInitials
// ============================================================

test('propiedad: colorFor siempre devuelve el mismo color de la paleta para el mismo texto', () => {
  fc.assert(fc.property(fc.string(), texto => {
    assert.ok(COLORES.includes(colorFor(texto)));
    assert.equal(colorFor(texto), colorFor(texto));
  }));
});

test('toInitials toma la inicial de las dos primeras palabras', () => {
  assert.equal(toInitials('cinemeta en español'), 'CE');
  assert.equal(toInitials('  narto  '), 'N');
  assert.equal(toInitials(''), '?');
  assert.equal(toInitials(null), '?');
});

// ============================================================
// store
// ============================================================

test('store guarda con prefijo telon. y devuelve el valor por defecto si no existe', () => {
  store.set('prueba', { a: 1 });
  assert.equal(app.window.localStorage.getItem('telon.prueba'), '{"a":1}');
  assert.deepEqual(plain(store.get('prueba', null)), { a: 1 });
  assert.equal(store.get('no-existe', 'defecto'), 'defecto');
});

test('store no rompe la app si lo guardado está corrupto', () => {
  app.window.localStorage.setItem('telon.roto', '{no es json');
  assert.equal(store.get('roto', 'defecto'), 'defecto');
});

// ============================================================
// URLS Y COLORES QUE VIENEN DE AFUERA
// ============================================================

test('safeUrl solo deja pasar imágenes http(s), data:image y blob', () => {
  assert.equal(safeUrl(' https://img.x/a.jpg '), 'https://img.x/a.jpg');
  assert.equal(safeUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  assert.equal(safeUrl('blob:https://x/1'), 'blob:https://x/1');
  for (const mala of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'file:///etc/passwd', 'data:text/html,<script>', '//evil.x/a.jpg', 'a.jpg', null, 42]) {
    assert.equal(safeUrl(mala), '', String(mala));
  }
});

test('cssUrl codifica lo que permitiría cerrar url(...) y descarta esquemas peligrosos', () => {
  assert.equal(cssUrl("https://x/a b'c\"(d).jpg"), 'url("https://x/a%20b%27c%22%28d%29.jpg")');
  assert.equal(cssUrl('javascript:alert(1)'), '');
});

test('propiedad: lo que devuelve cssUrl no puede salir de url("…")', () => {
  fc.assert(fc.property(fc.string(), cola => {
    const resultado = cssUrl('https://x/' + cola);
    const adentro = resultado.slice('url("'.length, -'")'.length);
    assert.ok(resultado.startsWith('url("') && resultado.endsWith('")'));
    assert.ok(!/["'()\\\s<>]/.test(adentro), resultado);
  }));
});

test('safeColor acepta hex y reemplaza cualquier otra cosa', () => {
  assert.equal(safeColor('#B23A48'), '#B23A48');
  assert.equal(safeColor('red;background:url(x)'), '#555555');
  assert.equal(safeColor(undefined), '#555555');
});

test('una imagen rota cae en su respaldo sin manejadores inline', () => {
  const doc = app.document;
  doc.body.insertAdjacentHTML('beforeend', '<div id="p1" class="poster"><img data-fallback="noimg"></div><span id="p2"><img data-fallback="initial" data-inicial="A"></span>');
  doc.querySelectorAll('#p1 img, #p2 img').forEach(imagen => imagen.dispatchEvent(new app.window.Event('error')));
  assert.ok(doc.getElementById('p1').classList.contains('noimg'));
  assert.equal(doc.querySelector('#p1 img'), null);
  assert.equal(doc.getElementById('p2').textContent, 'A');
});

// ============================================================
// FOTO DE PERFIL
// ============================================================

test('el recorte de la foto de perfil es el cuadrado centrado más grande', () => {
  const fotos = loadApp({ hasta: 'js/ui/avatar-image.js' });
  const { coverCrop } = fotos.Telon.ui.avatarImage;
  assert.deepEqual({ ...coverCrop(4000, 3000) }, { x: 500, y: 0, lado: 3000 });
  assert.deepEqual({ ...coverCrop(1080, 1920) }, { x: 0, y: 420, lado: 1080 });
  assert.deepEqual({ ...coverCrop(256, 256) }, { x: 0, y: 0, lado: 256 });
  fotos.close();
});

test('si el almacenamiento está lleno, guardar un perfil avisa que falló', () => {
  const lleno = loadApp({ hasta: 'js/app/state.js', almacen: { profiles: [{ id: 'p', name: 'Ana', color: '#000' }] } });
  lleno.window.Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(lleno.Telon.app.state.perfiles.update('p', { image: 'data:image/jpeg;base64,AAA' }), false);
  lleno.close();
});
