/*
Telón - Casos de uso: reproducción
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Busca fuentes y subtítulos para un episodio y guarda el progreso. El reproductor (la
pantalla) solo se ocupa del <video> y de los controles.
*/
'use strict';

import { resolveStreams, resolveSubs, subBlob } from '../infra/addon-client.js';
import * as plataforma from '../infra/platform.js';
import { buildHistoryEntry } from '../domain/progress.js';
import { rankByQuality } from '../domain/sources.js';
import { getEnabledAddons, recordProgress, preferencias } from './state.js';
import { isNartoAddon } from '../infra/addons/narto.js';

// Los dramas cortos de Narto son verticales; todo lo demás se ve horizontal.
const isVerticalFormat = referencia => isNartoAddon(referencia.base);

// En Samsung no se puede atrapar el m3u8 de un embed: esas fuentes ni se ofrecen.
const isPlayable = fuente => plataforma.admiteEmbed || fuente._tipo !== 'embed';

// onFirst arranca el video con la primera fuente reproducible; la promesa trae todas. Ambas
// listas vienen ordenadas según la calidad preferida.
async function findStreams(tipo, idVideo, onFirst) {
  const calidad = preferencias.quality();
  const avisar = onFirst ? fuentes => onFirst(rankByQuality(fuentes, calidad)) : undefined;
  return rankByQuality(await resolveStreams(getEnabledAddons(), tipo, idVideo, avisar, isPlayable), calidad);
}

// Devuelve lo necesario para un <track> o null si no hay subtítulos.
async function findSubtitleTrack(tipo, idVideo) {
  const subtitulo = await resolveSubs(getEnabledAddons(), tipo, idVideo, []);
  if (!subtitulo) return null;
  return { etiqueta: subtitulo.lang || 'Subtítulos', idioma: (subtitulo.lang || 'es').slice(0, 2), src: await subBlob(subtitulo.url) };
}

function saveProgress(sesionReproduccion, segundos, duracion) {
  recordProgress(buildHistoryEntry(sesionReproduccion, segundos, duracion, Date.now()));
}

export { isVerticalFormat, findStreams, findSubtitleTrack, saveProgress };
