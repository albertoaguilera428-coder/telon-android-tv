/*
Telón - Pruebas de las reglas del catálogo: qué se muestra, qué se busca y cómo se filtra
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Antes estas reglas solo se ejercitaban en el recorrido completo, que no entra en las pruebas
de mutación: Stryker dejaba vivos casi dos de cada tres cambios en domain/catalog.js. Aquí se
prueba cada regla directamente, con casos que distinguen lo correcto de lo incorrecto.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/domain/catalog.js' });
const catalogo = app.Telon.domain.catalog;
test.after(() => app.close());

const TODOS = 'all';
const fila = (tipo, metas) => ({ cat: { type: tipo, id: tipo }, metas });
const ficha = (id, pais, generos) => ({ id, name: 'Título ' + id, country: pais, genres: generos });

// ============================================================
// CATÁLOGOS
// ============================================================

test('los filtros vacíos dicen «Todo» en país, tipo y género', () => {
  assert.deepEqual(plain(catalogo.FILTROS_VACIOS), { pais: TODOS, tipo: TODOS, genero: TODOS });
});

test('un catálogo necesita un parámetro si alguno de sus extras es obligatorio o declara extraRequired', () => {
  assert.equal(catalogo.needsExtra({ extra: [{ name: 'genre', isRequired: true }] }), true);
  assert.equal(catalogo.needsExtra({ extra: [{ name: 'search' }, { name: 'genre', isRequired: true }] }), true, 'basta con uno');
  assert.equal(catalogo.needsExtra({ extraRequired: ['search'] }), true, 'forma vieja del protocolo');
  assert.equal(catalogo.needsExtra({ extra: [{ name: 'search' }] }), false, 'opcional no cuenta');
  assert.equal(catalogo.needsExtra({ extraRequired: [] }), false);
  assert.equal(catalogo.needsExtra({}), false);
});

test('un catálogo admite búsqueda si declara el extra «search», en cualquiera de las dos formas', () => {
  assert.equal(catalogo.supportsSearch({ extra: [{ name: 'genre' }, { name: 'search' }] }), true, 'aunque no sea el único extra');
  assert.equal(catalogo.supportsSearch({ extraSupported: ['genre', 'search'] }), true, 'forma vieja del protocolo');
  assert.equal(catalogo.supportsSearch({ extra: [{ name: 'genre' }], extraSupported: ['genre'] }), false);
  assert.equal(catalogo.supportsSearch({}), false);
});

test('solo se muestran fichas con id y nombre', () => {
  const validas = catalogo.keepValidMetas([{ id: 'a', name: 'A' }, null, { id: 'b' }, { name: 'C' }, { id: '', name: 'D' }, { id: 'e', name: 'E' }]);
  assert.deepEqual(plain(validas).map(m => m.id), ['a', 'e']);
  assert.deepEqual(plain(catalogo.keepValidMetas(undefined)), [], 'sin fichas, lista vacía (no falla)');
});

test('los recursos del manifest se listan sin repetir, sean textos u objetos', () => {
  const nombres = catalogo.listResourceNames({ resources: ['catalog', { name: 'stream', types: ['movie'] }, 'catalog', { name: 'meta' }] });
  assert.deepEqual(plain(nombres), ['catalog', 'stream', 'meta']);
  assert.deepEqual(plain(catalogo.listResourceNames({})), []);
});

// ============================================================
// OPCIONES DE FILTRO
// ============================================================

test('las opciones de filtro salen de lo cargado: países y tipos sin repetir, géneros en orden', () => {
  const filas = [
    fila('series', [ficha('1', 'Korea', ['Drama', 'Romance']), ficha('2', 'USA', ['Comedia']), ficha('3', 'Korea', ['Drama'])]),
    fila('movie', [ficha('4', '', ['Acción']), ficha('5', 'China')]),
    fila('series', [])
  ];
  const opciones = plain(catalogo.collectFilterOptions(filas));
  assert.deepEqual(opciones.codigosPais, ['KR', 'US', 'CN'], 'sin repetir y sin vacíos');
  assert.deepEqual(opciones.generos, ['Acción', 'Comedia', 'Drama', 'Romance'], 'ordenados y sin repetir');
  assert.deepEqual(opciones.tipos, ['series', 'movie']);
});

test('un filtro que ya no existe vuelve a «Todo»; uno que existe se conserva', () => {
  const opciones = { codigosPais: ['KR'], generos: ['Drama'], tipos: ['series'] };
  assert.deepEqual(plain(catalogo.resetStaleFilters({ pais: 'KR', genero: 'Drama', tipo: 'series' }, opciones)), { pais: 'KR', genero: 'Drama', tipo: 'series' });
  assert.deepEqual(plain(catalogo.resetStaleFilters({ pais: 'US', genero: 'Terror', tipo: 'movie' }, opciones)), { pais: TODOS, genero: TODOS, tipo: TODOS });
  assert.deepEqual(plain(catalogo.resetStaleFilters({ pais: 'US', genero: 'Drama', tipo: 'series' }, opciones)), { pais: TODOS, genero: 'Drama', tipo: 'series' }, 'cada filtro se revisa por separado');
  assert.deepEqual(plain(catalogo.resetStaleFilters(catalogo.FILTROS_VACIOS, { codigosPais: [], generos: [], tipos: [] })), { pais: TODOS, genero: TODOS, tipo: TODOS }, '«Todo» no depende de las opciones');
});

// ============================================================
// APLICAR FILTROS
// ============================================================

const FILAS = [
  fila('series', [ficha('1', 'Korea', ['Drama']), ficha('2', 'USA', ['Comedia']), ficha('3', 'Korea'), ficha('4', 'Korea', ['Comedia'])]),
  fila('movie', [ficha('5', 'China', ['Acción']), ficha('6', 'Korea', ['Drama'])])
];
const ids = filas => plain(filas).map(f => f.metas.map(m => m.id));

test('sin filtros se ve todo, en el mismo orden', () => {
  assert.deepEqual(ids(catalogo.applyFilters(FILAS, catalogo.FILTROS_VACIOS)), [['1', '2', '3', '4'], ['5', '6']]);
});

test('filtrar por país deja solo los títulos de ese país', () => {
  assert.deepEqual(ids(catalogo.applyFilters(FILAS, { pais: 'KR', genero: TODOS, tipo: TODOS })), [['1', '3', '4'], ['6']]);
});

test('filtrar por género deja solo los que lo tienen (los que no declaran géneros no pasan)', () => {
  assert.deepEqual(ids(catalogo.applyFilters(FILAS, { pais: TODOS, genero: 'Drama', tipo: TODOS })), [['1'], ['6']]);
});

test('país y género se combinan', () => {
  assert.deepEqual(ids(catalogo.applyFilters(FILAS, { pais: 'KR', genero: 'Comedia', tipo: TODOS })), [['4']]);
});

test('filtrar por tipo quita las filas del otro tipo', () => {
  const soloPeliculas = catalogo.applyFilters(FILAS, { pais: TODOS, genero: TODOS, tipo: 'movie' });
  assert.deepEqual(plain(soloPeliculas).map(f => f.cat.type), ['movie']);
});

test('una fila que queda sin títulos no se muestra', () => {
  const resultado = catalogo.applyFilters(FILAS, { pais: 'CN', genero: TODOS, tipo: TODOS });
  assert.deepEqual(ids(resultado), [['5']], 'la fila de series, sin títulos de China, desaparece');
  assert.deepEqual(plain(catalogo.applyFilters([fila('series', [])], catalogo.FILTROS_VACIOS)), [], 'tampoco sin filtros');
});

test('filtrar no cambia las filas originales', () => {
  const antes = JSON.stringify(FILAS);
  catalogo.applyFilters(FILAS, { pais: 'KR', genero: 'Drama', tipo: 'movie' });
  assert.equal(JSON.stringify(FILAS), antes);
});

// ============================================================
// ESTADO DE LOS FILTROS
// ============================================================

test('hay filtros activos si cualquiera de los tres no está en «Todo»', () => {
  assert.equal(catalogo.hasActiveFilters(catalogo.FILTROS_VACIOS), false);
  assert.equal(catalogo.hasActiveFilters({ pais: 'KR', tipo: TODOS, genero: TODOS }), true);
  assert.equal(catalogo.hasActiveFilters({ pais: TODOS, tipo: 'movie', genero: TODOS }), true);
  assert.equal(catalogo.hasActiveFilters({ pais: TODOS, tipo: TODOS, genero: 'Drama' }), true);
});

test('tocar el filtro activo lo apaga; tocar otro lo cambia', () => {
  assert.equal(catalogo.toggleFilterValue('movie', 'movie'), TODOS);
  assert.equal(catalogo.toggleFilterValue('series', 'movie'), 'movie');
  assert.equal(catalogo.toggleFilterValue(TODOS, 'Drama'), 'Drama');
});
