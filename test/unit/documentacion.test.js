/*
Telón - Comprobaciones automáticas de documentación y estilo
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lo que se puede verificar no depende de que alguien se acuerde de revisarlo a mano:
enlaces internos, comandos del README, cabecera de autoría y módulos registrados.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { WWW, readIndex, listScripts } = require('../support/app-driver');

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.join(__dirname, '..', '..');
const DOCUMENTOS = ['README.md', ...fs.readdirSync(path.join(RAIZ, 'docs', 'decisiones')).map(f => path.join('docs', 'decisiones', f))];
const FIRMA_AUTOR = 'De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático';
const CARPETAS_CON_CABECERA = ['web/js', 'app/src/main/java', 'app/src/test', 'test', 'features', 'scripts'];

function listFiles(carpeta, extensiones) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap(entrada => {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) return entrada.name === 'golden' ? [] : listFiles(ruta, extensiones);
    return extensiones.includes(path.extname(entrada.name)) ? [ruta] : [];
  });
}

// ============================================================
// DOCUMENTOS
// ============================================================

test('los enlaces internos de la documentación apuntan a archivos que existen', () => {
  for (const documento of DOCUMENTOS) {
    const texto = fs.readFileSync(path.join(RAIZ, documento), 'utf8');
    const enlaces = [...texto.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map(m => m[1]).filter(e => !/^[a-z]+:/i.test(e));
    for (const enlace of enlaces) {
      assert.ok(fs.existsSync(path.join(RAIZ, path.dirname(documento), enlace)), `${documento} enlaza a ${enlace}, que no existe`);
    }
  }
});

test('cada "npm run …" del README existe en package.json', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts;
  const readme = fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
  const usados = [...readme.matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]);
  assert.ok(usados.length > 0);
  for (const nombre of usados) assert.ok(scripts[nombre], `el README menciona npm run ${nombre}, que no existe`);
});

// ============================================================
// ESTILO VERIFICABLE (GUÍA, PUNTO 1)
// ============================================================

test('todo archivo de código lleva la cabecera de autoría', () => {
  const archivos = CARPETAS_CON_CABECERA.flatMap(c => listFiles(path.join(RAIZ, c), ['.js', '.mjs', '.java', '.feature']));
  assert.ok(archivos.length > 30);
  const sinCabecera = archivos.filter(a => !fs.readFileSync(a, 'utf8').slice(0, 600).includes(FIRMA_AUTOR));
  assert.deepEqual(sinCabecera.map(a => path.relative(RAIZ, a)), []);
});

// Que ningún módulo quede fuera lo revisa test/unit/arquitectura.test.js (todos se alcanzan desde main.js).
test('index.html carga la app con una sola entrada: js/main.js como módulo', () => {
  const indice = readIndex();
  assert.deepEqual(listScripts(indice), [], 'no quedan scripts clásicos sueltos');
  assert.deepEqual([...indice.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(m => m[1]), ['js/main.js']);
  assert.ok(fs.existsSync(path.join(WWW, 'js', 'main.js')));
});
