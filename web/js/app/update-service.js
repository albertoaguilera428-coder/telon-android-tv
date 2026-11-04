/*
Telón - Caso de uso: buscar una versión nueva
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Consulta el version.json publicado. Solo aplica a Android: en Samsung el .wgt se
reinstala a mano.
*/
'use strict';

import { logIgnored } from '../infra/log.js';
import { fetchRemoteJSON } from '../infra/http.js';
import * as plataforma from '../infra/platform.js';

const VERSION_TELON = 2;
const URL_VERSION = 'https://insanos.net/telon/version.json';

// Devuelve { version, url, notes } si hay una versión más nueva, o null.
async function fetchNewerVersion() {
  if (!plataforma.admiteActualizacion) return null;
  try {
    // El parámetro t evita que un proxy o el WebView nos devuelva un version.json viejo.
    const version = await fetchRemoteJSON(URL_VERSION + '?t=' + Date.now());
    return version.version > VERSION_TELON && version.url ? version : null;
  } catch (error) {
    logIgnored('No se pudo consultar si hay versión nueva', error);
    return null;
  }
}

const downloadUpdate = url => plataforma.downloadUpdate(String(url));

export { VERSION_TELON, fetchNewerVersion, downloadUpdate };
