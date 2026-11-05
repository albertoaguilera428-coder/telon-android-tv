/*
Telón - Pruebas de la lista de episodios: orden, temporadas y episodios deducidos
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');

const app = loadApp({ hasta: 'js/domain/episodes.js' });
const episodios = app.Telon.domain.episodes;
test.after(() => app.close());

const ids = lista => plain(lista).map(v => v.id);

test('dos videos con la misma temporada y número conservan el orden en que vinieron', () => {
  const lista = [{ id: 'x', season: 1, episode: 1 }, { id: 'y', season: 1, episode: 1 }, { id: 'z', season: 1, episode: 1 }];
  assert.deepEqual(ids(episodios.sortVideos(lista)), ['x', 'y', 'z']);
});

test('los episodios se deducen de la descripción, con o sin espacio y en singular', () => {
  const deducidos = descripcion => episodios.buildEpisodeList({ id: 'tt9', type: 'series', name: 'Serie', description: descripcion });
  assert.equal(deducidos('Son 12episodios cortos').length, 12);
  assert.equal(deducidos('Un especial de 1 episodio').length, 1);
  assert.equal(plain(deducidos('Un especial de 1 episodio'))[0].id, 'tt9:1:1', 'con el formato de Stremio');
});

test('sin videos ni episodios en la descripción queda un solo ítem: la propia ficha', () => {
  const lista = plain(episodios.buildEpisodeList({ id: 'tt9', type: 'series', name: 'Serie', description: 'Una historia de amor' }));
  assert.deepEqual(lista, [{ id: 'tt9', title: 'Serie' }]);
});

test('sin temporada se cuenta como la 1; la temporada 0 (especiales) se respeta', () => {
  assert.equal(episodios.seasonOf({}), 1);
  assert.equal(episodios.seasonOf({ season: 0 }), 0);
  assert.equal(episodios.seasonOf({ season: 3 }), 3);
});

test('las temporadas se listan sin repetir y en orden numérico (10 va después de 2)', () => {
  assert.deepEqual(plain(episodios.listSeasons([{ season: 10 }, { season: 2 }, { season: 2 }, { season: 1 }])), [1, 2, 10]);
});

test('los episodios de una temporada conservan su posición en la lista completa', () => {
  const lista = [{ id: 'a', season: 1 }, { id: 'b', season: 2 }, { id: 'c', season: 1 }];
  assert.deepEqual(plain(episodios.episodesInSeason(lista, 1)).map(x => [x.episodio.id, x.i]), [['a', 0], ['c', 2]]);
  assert.deepEqual(plain(episodios.episodesInSeason(lista, 2)).map(x => [x.episodio.id, x.i]), [['b', 1]]);
});
