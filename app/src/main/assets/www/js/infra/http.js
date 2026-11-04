/*
Telón - Peticiones HTTP con buenos modales
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Toda petición de la app (addons, sitios, Firebase, aviso de versión) pasa por aquí. Tres
reglas: respetar el 429 de cada servidor, no abrir más de cierta cantidad de conexiones
a la vez y no esperar para siempre a un servidor que no contesta.
*/
(function (Telon) {
  'use strict';

  const ESPERA_POR_DEFECTO_MS = 15000;

  // ============================================================
  // RED Y LÍMITES DE CONSUMO
  // ============================================================

  // Si un servidor responde 429 respetamos su Retry-After (o 30 s si no lo dice) y no le volvemos a
  // pedir nada hasta que pase. No reintentamos solos: el usuario decide con "Reintentar". Así un
  // addon saturado no recibe una ráfaga de peticiones de cada televisor que tiene la app abierta.
  const ESPERA_429_POR_DEFECTO_MS = 30000;
  const ESPERA_429_MAXIMA_MS = 600000;
  const esperaPorOrigen = Object.create(null);

  function originOf(url) {
    try {
      return new URL(url).origin;
    } catch {
      // Las rutas de addons virtuales ("__x__/…") no son URLs: no tienen servidor al que limitar.
      return '';
    }
  }

  // Retry-After puede venir en segundos ("120") o como fecha HTTP.
  function parseRetryAfter(valor, ahora) {
    if (!valor) return ESPERA_429_POR_DEFECTO_MS;
    const segundos = Number(valor);
    const ms = Number.isFinite(segundos) ? segundos * 1000 : Date.parse(valor) - ahora;
    if (!Number.isFinite(ms)) return ESPERA_429_POR_DEFECTO_MS;
    return Math.min(Math.max(ms, 0), ESPERA_429_MAXIMA_MS);
  }

  function secondsToWait(origen) {
    const hasta = esperaPorOrigen[origen];
    if (!hasta) return 0;
    const restante = hasta - Date.now();
    return restante > 0 ? Math.ceil(restante / 1000) : 0;
  }

  // ============================================================
  // TOPE DE PETICIONES SIMULTÁNEAS
  // ============================================================

  // El inicio, la búsqueda y las fuentes consultan a todos los addons a la vez. Con muchos addons
  // eso son decenas de conexiones en un WebView de televisor con poca memoria. 8 alcanza para que
  // el inicio cargue sin cola en el caso normal (≈7 catálogos); lo demás espera su turno en orden.
  // La cola también tiene tope: si se llena, preferimos rechazar a acumular trabajo sin fin.
  const MAXIMO_SIMULTANEAS = 8;
  const MAXIMO_EN_ESPERA = 100;
  let activas = 0;
  const enEspera = [];

  function acquireSlot() {
    if (activas < MAXIMO_SIMULTANEAS) {
      activas++;
      return Promise.resolve();
    }
    if (enEspera.length >= MAXIMO_EN_ESPERA) return Promise.reject(new Error('demasiadas peticiones en espera'));
    return new Promise(resolver => enEspera.push(resolver));
  }

  // El turno pasa directo al siguiente en la cola, sin bajar y subir el contador.
  function releaseSlot() {
    const siguiente = enEspera.shift();
    if (siguiente) siguiente(); else activas--;
  }

  const activeRequests = () => ({ activas, enEspera: enEspera.length });

  // ============================================================
  // PETICIÓN BASE
  // ============================================================

  function recordRateLimit(respuesta, origen) {
    if (respuesta.status !== 429 || !origen) return;
    const ahora = Date.now();
    const retryAfter = respuesta.headers && respuesta.headers.get ? respuesta.headers.get('Retry-After') : null;
    esperaPorOrigen[origen] = ahora + parseRetryAfter(retryAfter, ahora);
  }

  // Todas las peticiones de la app a addons y sitios pasan por aquí: respeta el 429, espera su turno
  // y corta a los ms indicados (el reloj empieza cuando sale la petición, no mientras espera turno).
  // Si quien llama ya trae su propia señal de cancelación, se respeta esa.
  async function politeFetch(url, opciones = {}, ms = ESPERA_POR_DEFECTO_MS) {
    const origen = originOf(url);
    const espera = origen ? secondsToWait(origen) : 0;
    if (espera > 0) throw new Error('el servidor pidió esperar; reintenta en ' + espera + ' s');
    await acquireSlot();
    const control = opciones.signal ? null : new AbortController();
    const temporizador = control ? setTimeout(() => control.abort(), ms) : null;
    try {
      const respuesta = await fetch(url, control ? { ...opciones, signal: control.signal } : opciones);
      recordRateLimit(respuesta, origen);
      return respuesta;
    } catch (error) {
      if (control && control.signal.aborted) throw new Error('tiempo de espera agotado', { cause: error });
      throw error;
    } finally {
      clearTimeout(temporizador);
      releaseSlot();
    }
  }

  async function fetchRemoteJSON(url, ms = ESPERA_POR_DEFECTO_MS) {
    try {
      const respuesta = await politeFetch(url, {}, ms);
      if (respuesta.status === 429) throw new Error('demasiadas solicitudes; reintenta en ' + secondsToWait(originOf(url)) + ' s');
      if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
      return await respuesta.json();
    } catch (error) {
      throw new Error(error.message, { cause: error });
    }
  }

  Telon.infra.http = { MAXIMO_SIMULTANEAS, MAXIMO_EN_ESPERA, politeFetch, fetchRemoteJSON, parseRetryAfter, activeRequests };
})(window.Telon = window.Telon || {});
