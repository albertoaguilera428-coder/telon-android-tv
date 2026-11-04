/*
Telón - Dominio: episodios y temporadas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Cómo se ordena y se arma la lista de episodios de una ficha, y cómo se etiquetan.
Lógica pura: sin DOM, red ni almacenamiento.
*/
'use strict';

// Orden por temporada y episodio; si faltan datos se respeta el orden en que vinieron.
const sortVideos = listaVideos => listaVideos
  .map((video, i) => ({ video, i }))
  .sort((a, b) => ((a.video.season || 0) - (b.video.season || 0))
    || ((a.video.episode ?? a.i) - (b.video.episode ?? b.i))
    || (a.i - b.i))
  .map(x => x.video);

// Algunos addons no mandan la lista de videos pero sí dicen "24 episodios" en la descripción.
// Solo para series: en una película esa frase suele ser parte de la sinopsis.
const MAXIMO_EPISODIOS_INFERIDOS = 300;

function inferEpisodesFromDescription(ficha) {
  if (ficha.type !== 'series') return [];
  const coincidencia = (ficha.description || '').match(/(\d+)\s*[Ee]pisodios?/);
  if (!coincidencia) return [];
  const cantidad = Math.min(+coincidencia[1], MAXIMO_EPISODIOS_INFERIDOS);
  const episodios = [];
  // Mismo formato de ID que usa Stremio para series (id:temporada:episodio).
  for (let e = 1; e <= cantidad; e++) episodios.push({ id: `${ficha.id}:1:${e}`, title: `Episodio ${e}`, season: 1, episode: e });
  return episodios;
}

// Lista de episodios lista para reproducir. Si el addon no trae videos intentamos deducirlos de
// la descripción; si tampoco se puede (películas, por ejemplo), queda un solo ítem.
function buildEpisodeList(ficha) {
  const episodios = Array.isArray(ficha.videos) ? sortVideos(ficha.videos.filter(v => v && v.id)) : [];
  if (episodios.length) return episodios;
  const inferidos = inferEpisodesFromDescription(ficha);
  return inferidos.length ? inferidos : [{ id: ficha.id, title: ficha.name }];
}

// Las películas no llevan "Ep. 1": solo etiquetamos cuando hay más de un episodio.
const episodeNumber = (episodio, i) => episodio.episode != null ? episodio.episode : i + 1;

function episodeLabel(episodios, i) {
  const episodio = episodios[i];
  if (!episodio || episodios.length < 2) return '';
  return 'Ep. ' + episodeNumber(episodio, i);
}

const seasonOf = episodio => episodio.season != null ? episodio.season : 1;
const listSeasons = episodios => [...new Set(episodios.map(seasonOf))].sort((a, b) => a - b);
const episodesInSeason = (episodios, temporada) => episodios.map((episodio, i) => ({ episodio, i })).filter(x => seasonOf(x.episodio) === temporada);

export { sortVideos, buildEpisodeList, episodeNumber, episodeLabel, seasonOf, listSeasons, episodesInSeason };
