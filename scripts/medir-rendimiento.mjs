/*
Telón - Medición de rendimiento con catálogos grandes
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Mide en Chromium (sin red real) lo que crece con la cantidad de contenido: pintar el
inicio, aplicar un filtro y mover el foco con el control remoto. Sirve para comparar antes
y después de un cambio con la misma carga; no reemplaza medir en el televisor.

  node scripts/medir-rendimiento.mjs [catálogos] [títulos por catálogo]
*/
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(RAIZ, 'web');
const CATALOGOS = Number(process.argv[2] || 20);
const TITULOS = Number(process.argv[3] || 100);
const REPETICIONES = 20;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
const PAISES = ['Korea', 'USA', 'China', 'Japan', 'Mexico'];
const GENEROS = ['Drama', 'Comedia', 'Acción', 'Romance', 'Terror'];

// ============================================================
// RED SIMULADA
// ============================================================

const manifest = {
  id: 'grande', name: 'Catálogo grande', version: '1', resources: ['catalog'], types: ['series'],
  catalogs: Array.from({ length: CATALOGOS }, (_, i) => ({ type: 'series', id: 'c' + i, name: 'Catálogo ' + i }))
};
const metas = catalogo => Array.from({ length: TITULOS }, (_, j) => ({
  id: `tt${catalogo}_${j}`, type: 'series', name: `Título ${catalogo}-${j}`, country: PAISES[j % PAISES.length], genres: [GENEROS[j % GENEROS.length]]
}));

function respond(url) {
  if (url === 'https://insanos.net/cinemeta-es/manifest.json') return manifest;
  const catalogo = url.match(/cinemeta-es\/catalog\/series\/c(\d+)\.json/);
  if (catalogo) return { metas: metas(catalogo[1]) };
  return null;
}

function startServer() {
  const servidor = http.createServer((peticion, respuesta) => {
    const ruta = path.join(WWW, new URL(peticion.url, 'http://x').pathname);
    if (!ruta.startsWith(WWW) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { respuesta.writeHead(404); respuesta.end(); return; }
    respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
    fs.createReadStream(ruta).pipe(respuesta);
  });
  return new Promise(resolver => servidor.listen(0, '127.0.0.1', () => resolver(servidor)));
}

// ============================================================
// MEDICIÓN
// ============================================================

const percentile = (valores, p) => valores.slice().sort((a, b) => a - b)[Math.min(valores.length - 1, Math.floor(valores.length * p))];
const resumen = valores => `mediana ${percentile(valores, 0.5).toFixed(1)} ms · p95 ${percentile(valores, 0.95).toFixed(1)} ms`;

async function main() {
  const servidor = await startServer();
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  await contexto.addInitScript(`
    localStorage.setItem('telon.profiles', JSON.stringify([{ id: 'p', name: 'Ana', color: '#B23A48' }]));
    localStorage.setItem('telon.activeProfile', JSON.stringify('p'));
    window.TelonBridge = { isTv: () => true, setOrientation() {}, openEmbed() {}, closeEmbed() {}, downloadAndInstall() {} };`);
  await contexto.route(url => !url.href.startsWith('http://127.0.0.1'), async solicitud => {
    const cuerpo = respond(solicitud.request().url());
    return cuerpo ? solicitud.fulfill({ status: 200, body: JSON.stringify(cuerpo), headers: { 'Access-Control-Allow-Origin': '*' } }) : solicitud.fulfill({ status: 404, body: '' });
  });
  const pagina = await contexto.newPage();
  await pagina.goto(`http://127.0.0.1:${servidor.address().port}/index.html`);
  await pagina.waitForFunction(n => document.querySelectorAll('.card').length >= n, CATALOGOS * TITULOS, { timeout: 30000 });

  const medidas = await pagina.evaluate(async repeticiones => {
    const { home, tvRemote } = window.Telon.ui;
    const { estado } = window.Telon.app.state;
    const medir = funcion => { const t0 = performance.now(); funcion(); return performance.now() - t0; };
    const pintar = [], filtrar = [], foco = [];
    for (let i = 0; i < repeticiones; i++) pintar.push(medir(() => home.homeBody()));
    for (let i = 0; i < repeticiones; i++) {
      estado.filtros.genero = i % 2 ? 'Drama' : 'all';
      filtrar.push(medir(() => home.homeBody()));
    }
    estado.filtros.genero = 'all';
    home.homeBody();
    document.querySelector('.card').focus();
    const direcciones = ['right', 'right', 'down', 'left', 'down', 'right', 'up'];
    for (let i = 0; i < repeticiones * 3; i++) foco.push(medir(() => tvRemote.moveTvFocus(direcciones[i % direcciones.length])));
    return { pintar, filtrar, foco, tarjetas: document.querySelectorAll('.card').length, enfocables: document.querySelectorAll('button,a,input,[tabindex]').length };
  }, REPETICIONES);

  console.log(`Equipo: ${os.cpus()[0].model} · ${os.cpus().length} núcleos · Chromium headless`);
  console.log(`Carga: ${CATALOGOS} catálogos × ${TITULOS} títulos = ${medidas.tarjetas} tarjetas, ${medidas.enfocables} elementos enfocables`);
  console.log(`Pintar inicio:      ${resumen(medidas.pintar)}`);
  console.log(`Filtrar por género: ${resumen(medidas.filtrar)}`);
  console.log(`Mover foco (tecla): ${resumen(medidas.foco)}`);
  await navegador.close();
  servidor.close();
}

main();
