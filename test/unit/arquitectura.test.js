/*
Telón - Reglas de dependencia entre capas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

La arquitectura en capas solo sirve si se respeta. Esta prueba lee los import de cada
módulo y falla si una capa usa algo que no le corresponde, si hay ciclos o si algún
módulo quedó fuera de la app.

  dominio        → solo otras reglas del dominio (sin DOM, red, almacenamiento ni reloj)
  infraestructura→ solo otra infraestructura
  aplicación     → dominio e infraestructura (sin DOM ni pantallas)
  presentación   → aplicación y dominio; de la infraestructura solo plataforma, registro y tipos de error
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { WWW } = require('../support/app-driver');

// ============================================================
// LECTURA DEL CÓDIGO
// ============================================================

// Sin comentarios: el texto explicativo menciona "document" o "fetch" sin usarlos.
const stripComments = codigo => codigo
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s\/\/\s.*$/gm, '');

function listModules(carpeta) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap(entrada => {
    const ruta = path.join(carpeta, entrada.name);
    return entrada.isDirectory() ? listModules(ruta) : entrada.name.endsWith('.js') ? [ruta] : [];
  });
}

const IMPORTACION = /^import (?:(\{[^}]*\}|\* as [\w$]+) from )?'([^']+)';$/;
const relativo = ruta => path.relative(WWW, ruta).split(path.sep).join('/');

const modulos = listModules(path.join(WWW, 'js')).map(archivo => {
  const original = fs.readFileSync(archivo, 'utf8');
  const lineasImport = original.split('\n').filter(l => /^import\b/.test(l));
  const importa = lineasImport.map(l => l.match(IMPORTACION)).filter(Boolean).map(m => relativo(path.resolve(path.dirname(archivo), m[2])));
  const espacios = lineasImport.map(l => (l.match(/^import \* as ([\w$]+)/) || [])[1]).filter(Boolean);
  return { src: relativo(archivo), original, codigo: stripComments(original), lineasImport, importa, espacios };
});
const porRuta = Object.fromEntries(modulos.map(m => [m.src, m]));
const capaDe = src => (src.match(/^js\/(infra|domain|app|ui)\//) || [null, 'arranque'])[1];

// ============================================================
// REGLAS POR CAPA
// ============================================================

const INFRA_PERMITIDA_EN_UI = /^js\/infra\/(platform|log|errors)\.js$/;
const PUEDE_IMPORTAR = {
  domain: destino => capaDe(destino) === 'domain',
  infra: destino => capaDe(destino) === 'infra',
  app: destino => ['domain', 'infra', 'app'].includes(capaDe(destino)),
  ui: destino => ['domain', 'app', 'ui'].includes(capaDe(destino)) || INFRA_PERMITIDA_EN_UI.test(destino),
  arranque: destino => ['domain', 'app', 'ui'].includes(capaDe(destino)) || INFRA_PERMITIDA_EN_UI.test(destino) || destino === 'js/infra/polyfills.js'
};

const PROHIBIDO = {
  domain: [/\bdocument\b/, /\bwindow\./, /\bfetch\(/, /\blocalStorage\b/, /\bconsole\./, /\bDate\.now\(/, /\bsetTimeout\(/],
  infra: [],
  app: [/\bdocument\b/, /\bfetch\(/, /\blocalStorage\b/],
  ui: [/\bfetch\(/, /\blocalStorage\b/],
  arranque: [/\bfetch\(/, /\blocalStorage\b/]
};

test('cada capa importa solo lo que le corresponde', () => {
  const violaciones = modulos.flatMap(({ src, importa }) => importa
    .filter(destino => !PUEDE_IMPORTAR[capaDe(src)](destino))
    .map(destino => `${src} (${capaDe(src)}) importa ${destino}`));
  assert.deepEqual(violaciones, []);
});

test('cada capa usa solo las APIs del navegador que le corresponden', () => {
  const violaciones = [];
  for (const { src, codigo } of modulos) {
    for (const regla of PROHIBIDO[capaDe(src)]) {
      const encontrado = codigo.match(regla);
      if (encontrado) violaciones.push(`${src} (${capaDe(src)}) usa "${encontrado[0]}"`);
    }
  }
  assert.deepEqual(violaciones, []);
});

// ============================================================
// GRAFO DE MÓDULOS
// ============================================================

test('cada import apunta a un módulo que existe', () => {
  const rotos = modulos.flatMap(({ src, importa }) => importa.filter(destino => !porRuta[destino]).map(destino => `${src} → ${destino}`));
  assert.deepEqual(rotos, []);
});

test('no hay ciclos entre módulos', () => {
  const estado = {}, ciclos = [];
  const visitar = (src, camino) => {
    if (estado[src] === 'hecho') return;
    if (estado[src] === 'visitando') { ciclos.push([...camino.slice(camino.indexOf(src)), src].join(' → ')); return; }
    estado[src] = 'visitando';
    (porRuta[src] ? porRuta[src].importa : []).forEach(destino => visitar(destino, [...camino, src]));
    estado[src] = 'hecho';
  };
  modulos.forEach(m => visitar(m.src, []));
  assert.deepEqual(ciclos, []);
});

test('todos los módulos llegan a la app desde main.js (ninguno queda fuera del paquete)', () => {
  const alcanzados = new Set();
  const recorrer = src => {
    if (alcanzados.has(src) || !porRuta[src]) return;
    alcanzados.add(src);
    porRuta[src].importa.forEach(recorrer);
  };
  recorrer('js/main.js');
  assert.deepEqual(modulos.map(m => m.src).filter(src => !alcanzados.has(src)), []);
});

test('el espacio de nombres global Telon ya no existe: cada módulo importa lo que usa', () => {
  assert.deepEqual(modulos.filter(m => /\bwindow\.Telon\b|\bTelon\.(infra|domain|app|ui)\b/.test(m.codigo)).map(m => m.src), []);
});

test('nadie cambia un módulo importado (import * as x … x.algo = …)', () => {
  const cambios = modulos.flatMap(({ src, codigo, espacios }) => espacios
    .filter(nombre => new RegExp(`\\b${nombre}\\.[\\w$]+\\s*=(?!=)`).test(codigo))
    .map(nombre => `${src} escribe en ${nombre}`));
  assert.deepEqual(cambios, []);
});

// ============================================================
// FORMA DE LOS MÓDULOS (LA USA EL CARGADOR DE LAS PRUEBAS)
// ============================================================

// test/support/app-driver.js carga cada módulo en jsdom reescribiendo sus import y export
// línea por línea; estas formas son las que entiende.
test('los import van en una línea, con comillas simples y ruta relativa; no hay export default', () => {
  const problemas = modulos.flatMap(({ src, lineasImport, original }) => [
    ...lineasImport.filter(l => !IMPORTACION.test(l) || !/'\.\.?\//.test(l)).map(l => `${src}: ${l}`),
    ...(/^export default\b/m.test(original) ? [`${src}: export default`] : [])
  ]);
  assert.deepEqual(problemas, []);
});

test('las reglas detectan una violación (control de la propia prueba)', () => {
  assert.ok(!PUEDE_IMPORTAR.ui('js/infra/http.js'));
  assert.ok(PUEDE_IMPORTAR.ui('js/infra/platform.js'));
  assert.ok(!PUEDE_IMPORTAR.domain('js/infra/log.js'));
  assert.ok(!PROHIBIDO.domain.some(r => r.test(stripComments('// document.querySelector\nconst a = 1;'))));
  assert.ok(!IMPORTACION.test('import { a,'), 'un import partido en dos líneas no pasa');
});
