/*
Telón - Reglas de dependencia entre capas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

La arquitectura en capas solo sirve si se respeta. Esta prueba lee el código y falla si
una capa usa algo que no le corresponde, o si un módulo depende de otro que se carga
después en index.html.

  dominio        → solo otras reglas del dominio (sin DOM, red, almacenamiento ni reloj)
  infraestructura→ solo otra infraestructura
  aplicación     → dominio e infraestructura (sin DOM ni pantallas)
  presentación   → aplicación y dominio; de la infraestructura solo plataforma y registro
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { WWW, readIndex, listScripts } = require('../support/app-driver');

// ============================================================
// LECTURA DEL CÓDIGO
// ============================================================

// Sin comentarios: el texto explicativo menciona "document" o "fetch" sin usarlos.
const stripComments = codigo => codigo
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s\/\/\s.*$/gm, '');

const scripts = listScripts(readIndex());
const modulos = scripts.map(src => ({ src, codigo: stripComments(fs.readFileSync(path.join(WWW, src), 'utf8')) }));
const capaDe = src => (src.match(/^js\/(infra|domain|app|ui)\//) || [null, 'arranque'])[1];

// ============================================================
// REGLAS POR CAPA
// ============================================================

const PROHIBIDO = {
  domain: [/\bdocument\b/, /\bwindow\.(?!Telon)/, /\bfetch\(/, /\blocalStorage\b/, /\bconsole\./, /\bDate\.now\(/, /\bsetTimeout\(/, /Telon\.(infra|app|ui)\b/],
  infra: [/Telon\.(app|ui|domain)\b/],
  app: [/\bdocument\b/, /\bfetch\(/, /\blocalStorage\b/, /Telon\.ui\b/],
  ui: [/\bfetch\(/, /\blocalStorage\b/, /Telon\.infra\.(?!platform\b|log\b)\w+/],
  arranque: [/\bfetch\(/, /\blocalStorage\b/, /Telon\.infra\.(?!platform\b|log\b)\w+/]
};

test('cada capa usa solo lo que le corresponde', () => {
  const violaciones = [];
  for (const { src, codigo } of modulos) {
    for (const regla of PROHIBIDO[capaDe(src)]) {
      const encontrado = codigo.match(regla);
      if (encontrado) violaciones.push(`${src} (${capaDe(src)}) usa "${encontrado[0]}"`);
    }
  }
  assert.deepEqual(violaciones, []);
});

test('ningún módulo depende de otro que se carga después', () => {
  const definidoEn = {};
  modulos.forEach(({ codigo }, i) => {
    for (const m of codigo.matchAll(/Telon\.(infra|domain|app|ui)\.(\w+)\s*=/g)) definidoEn[m[1] + '.' + m[2]] = i;
  });
  const problemas = [];
  modulos.forEach(({ src, codigo }, i) => {
    for (const m of codigo.matchAll(/Telon\.(infra|domain|app|ui)\.(\w+)/g)) {
      const nombre = m[1] + '.' + m[2];
      if (!(nombre in definidoEn)) problemas.push(`${src} usa ${nombre}, que nadie define`);
      else if (definidoEn[nombre] > i) problemas.push(`${src} usa ${nombre}, que se carga después (${modulos[definidoEn[nombre]].src})`);
    }
  });
  assert.deepEqual([...new Set(problemas)], []);
});

test('las capas se cargan en orden: infraestructura, dominio, aplicación, presentación y arranque', () => {
  const orden = ['infra', 'domain', 'app', 'ui', 'arranque'];
  const capas = modulos.map(m => capaDe(m.src));
  for (let i = 1; i < capas.length; i++) {
    assert.ok(orden.indexOf(capas[i - 1]) <= orden.indexOf(capas[i]), `${modulos[i].src} se carga antes que ${modulos[i - 1].src}`);
  }
});

test('la regla detecta una violación (control de la propia prueba)', () => {
  const codigo = stripComments("const x = Telon.infra.http.fetchRemoteJSON; // Telon.app no cuenta\n/* document */");
  assert.ok(PROHIBIDO.ui.some(r => r.test(codigo)));
  assert.ok(!PROHIBIDO.domain.some(r => r.test(stripComments('// document.querySelector\nconst a = 1;'))));
});
