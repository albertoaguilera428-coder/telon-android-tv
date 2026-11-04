/*
Telón - Pruebas de pureza e inmutabilidad
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Las reglas del dominio son funciones puras: mismos datos, mismo resultado, y nunca
modifican lo que reciben. Las pruebas les pasan datos congelados (Object.freeze en
profundidad): si una regla intentara cambiarlos, el modo estricto lanzaría un error.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/app/state.js' });
const { countries, episodes, catalog, progress, sources } = app.Telon.domain;
test.after(() => app.close());

const deepFreeze = valor => {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    Object.values(valor).forEach(deepFreeze);
  }
  return valor;
};

// ============================================================
// PUREZA DEL DOMINIO
// ============================================================

const meta = fc.record({ id: fc.string({ minLength: 1 }), name: fc.string({ minLength: 1 }), country: fc.constantFrom('Korea', 'USA', 'KR', ''),
  genres: fc.array(fc.constantFrom('Drama', 'Comedia')), type: fc.constantFrom('series', 'movie') });
const fila = fc.record({ cat: fc.record({ type: fc.constantFrom('series', 'movie'), id: fc.string() }), metas: fc.array(meta, { maxLength: 5 }) });
const video = fc.record({ id: fc.uuid(), season: fc.option(fc.nat(3), { nil: undefined }), episode: fc.option(fc.nat(20), { nil: undefined }) });

test('propiedad: las reglas del dominio no modifican sus entradas y repiten el resultado', () => {
  fc.assert(fc.property(fc.array(fila, { maxLength: 4 }), fc.array(video, { maxLength: 8 }), fc.constantFrom('Auto', '1080p'), (filas, videos, calidad) => {
    const filtros = deepFreeze({ pais: 'KR', tipo: 'all', genero: 'Drama' });
    deepFreeze(filas);
    deepFreeze(videos);
    const opciones = catalog.collectFilterOptions(filas);
    assert.deepEqual(plain(catalog.collectFilterOptions(filas)), plain(opciones));
    catalog.resetStaleFilters(filtros, deepFreeze(opciones));
    assert.deepEqual(plain(catalog.applyFilters(filas, filtros)), plain(catalog.applyFilters(filas, filtros)));
    filas.flatMap(f => f.metas).forEach(m => countries.getCountryCode(m));
    episodes.sortVideos(videos);
    episodes.buildEpisodeList(deepFreeze({ id: 'x', type: 'series', name: 'X', videos }));
    if (videos.length) {
      const sesion = deepFreeze({ referencia: { base: 'b', type: 'series', id: 'x' }, ficha: { name: 'X', poster: '' }, episodios: videos, indice: 0, clave: 'b|series|x' });
      const entrada = progress.buildHistoryEntry(sesion, 10, 100, 5);
      assert.deepEqual(plain(progress.buildHistoryEntry(sesion, 10, 100, 5)), plain(entrada), 'misma entrada para los mismos datos y la misma hora');
      progress.trimHistory(deepFreeze({ [entrada.key]: entrada }), 1);
    }
    sources.rankByQuality(deepFreeze(videos.map(v => ({ name: v.id + ' 1080p' }))), calidad);
  }));
});

// ============================================================
// ACTUALIZACIONES INMUTABLES DEL ESTADO
// ============================================================

test('guardar en Mi lista crea una lista nueva en vez de cambiar la anterior', () => {
  const { estado, toggleLibrary } = app.Telon.app.state;
  const antes = estado.biblioteca;
  toggleLibrary({ base: 'b', type: 'series', id: 'tt1', name: 'Serie' });
  assert.notEqual(estado.biblioteca, antes);
  assert.equal(antes.length, 0, 'la lista anterior no cambió');
  const conUna = estado.biblioteca;
  toggleLibrary({ base: 'b', type: 'series', id: 'tt1' });
  assert.equal(conUna.length, 1);
  assert.equal(estado.biblioteca.length, 0);
});

test('desactivar SoloLatino no cambia el addon original: al recargar vuelve activo como los demás', async () => {
  const completa = loadApp({ hasta: 'js/app/catalog-service.js' });
  const { estado } = completa.Telon.app.state;
  const { toggleAddon, reloadDefaultAddons } = completa.Telon.app.catalogService;
  const original = completa.Telon.infra.sololatino.ADDON_SOLOLATINO;
  await reloadDefaultAddons();
  toggleAddon(original.base);
  assert.equal(estado.addons.find(a => a.base === original.base).enabled, false);
  assert.equal(original.enabled, true, 'la constante del módulo no se tocó');
  await reloadDefaultAddons();
  assert.equal(estado.addons.find(a => a.base === original.base).enabled, true);
  completa.close();
});
