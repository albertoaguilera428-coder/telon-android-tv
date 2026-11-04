/*
Telón - Adaptador de plataforma
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

La misma app web corre en tres lugares: dentro del APK de Android (celular, tablet o
Android TV), como app .wgt en televisores Samsung (Tizen) y en un navegador mientras
desarrollamos. Este archivo es el único que sabe en cuál está; el resto de la app le
pregunta a Telon.infra.platform y no se entera de los detalles de cada sistema.

Se carga en el <head>, antes que todo, para ajustar el viewport antes del primer pintado.
*/
(function (Telon) {
  'use strict';

  // ============================================================
  // DETECCIÓN
  // ============================================================

  const puenteAndroid = window.TelonBridge;
  const apiTizen = window.tizen;

  function detectPlatformName() {
    if (puenteAndroid) return 'android';
    if (apiTizen) return 'tizen';
    return 'browser';
  }

  // MainActivity responde isTv() según el modo del sistema (UiModeManager). Si por algún
  // motivo no responde, asumimos TV porque así se comportaba la app antes de soportar celulares.
  function readAndroidTvFlag() {
    try {
      return typeof puenteAndroid.isTv === 'function' ? puenteAndroid.isTv() === true : true;
    } catch (error) {
      console.warn('[Telón] No se pudo leer isTv() del puente Android', error);
      return true;
    }
  }

  const nombre = detectPlatformName();
  const esTv = nombre === 'tizen' || (nombre === 'android' && readAndroidTvFlag());

  // ============================================================
  // VIEWPORT
  // ============================================================

  // En TV diseñamos sobre un lienzo fijo de 1920 px (los televisores Android reportan 960 px
  // por la densidad). En celular y tablet usamos el ancho real del dispositivo.
  const VIEWPORT_TV = 'width=1920';
  const VIEWPORT_TACTIL = 'width=device-width, initial-scale=1, viewport-fit=cover';

  function applyViewport() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute('content', esTv ? VIEWPORT_TV : VIEWPORT_TACTIL);
  }

  // ============================================================
  // CONTROL REMOTO DE SAMSUNG (TIZEN)
  // ============================================================

  // Tizen entrega las teclas del control como keyCodes propios. Las traducimos a los
  // códigos de Android (KeyEvent) porque la app ya sabe reaccionar a esos vía window._tvKey.
  const TECLAS_TIZEN_A_ANDROID = {
    37: 21, // izquierda → DPAD_LEFT
    38: 19, // arriba → DPAD_UP
    39: 22, // derecha → DPAD_RIGHT
    40: 20, // abajo → DPAD_DOWN
    13: 66, // OK → ENTER
    10252: 85, // MediaPlayPause → MEDIA_PLAY_PAUSE
    415: 126, // MediaPlay → MEDIA_PLAY
    19: 127, // MediaPause → MEDIA_PAUSE
    413: 86, // MediaStop → MEDIA_STOP
    412: 89, // MediaRewind → MEDIA_REWIND
    417: 90, // MediaFastForward → MEDIA_FAST_FORWARD
    10233: 87, // MediaTrackNext → MEDIA_NEXT
    10232: 88 // MediaTrackPrevious → MEDIA_PREVIOUS
  };
  const TECLA_ATRAS_TIZEN = 10009;
  // Las flechas y OK llegan solas; las teclas multimedia hay que pedirlas explícitamente.
  const TECLAS_MULTIMEDIA_TIZEN = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
    'MediaRewind', 'MediaFastForward', 'MediaTrackNext', 'MediaTrackPrevious'];

  function translateTizenKey(codigoTizen) {
    return Object.prototype.hasOwnProperty.call(TECLAS_TIZEN_A_ANDROID, codigoTizen)
      ? TECLAS_TIZEN_A_ANDROID[codigoTizen]
      : null;
  }

  function exitApp() {
    if (nombre !== 'tizen') return;
    try {
      apiTizen.application.getCurrentApplication().exit();
    } catch (error) {
      console.warn('[Telón] Tizen no permitió cerrar la app', error);
    }
  }

  function handleTizenKeydown(evento) {
    if (evento.keyCode === TECLA_ATRAS_TIZEN) {
      evento.preventDefault();
      // Igual que en Android: primero la app cierra lo que tenga abierto; si no queda nada, salimos.
      const atendido = typeof window.telonBack === 'function' && window.telonBack();
      if (!atendido) exitApp();
      return;
    }
    const codigoAndroid = translateTizenKey(evento.keyCode);
    if (codigoAndroid === null || typeof window._tvKey !== 'function') return;
    evento.preventDefault();
    window._tvKey(codigoAndroid);
  }

  function installTizenRemote() {
    TECLAS_MULTIMEDIA_TIZEN.forEach(tecla => {
      try {
        apiTizen.tvinputdevice.registerKey(tecla);
      } catch (error) {
        // Algunos modelos no tienen todas las teclas; la app sigue funcionando sin esa en particular.
        console.warn('[Telón] Tizen no registró la tecla ' + tecla, error);
      }
    });
    document.addEventListener('keydown', handleTizenKeydown);
  }

  // ============================================================
  // ACCIONES QUE DEPENDEN DEL SISTEMA
  // ============================================================

  function callAndroid(metodo, args) {
    if (nombre !== 'android') return false;
    try {
      puenteAndroid[metodo].apply(puenteAndroid, args);
      return true;
    } catch (error) {
      console.warn('[Telón] Falló TelonBridge.' + metodo, error);
      return false;
    }
  }

  // En celular el reproductor gira la pantalla según el formato del video; en TV no aplica.
  function setOrientation(modo) {
    callAndroid('setOrientation', [modo]);
  }

  // Devuelve false si la plataforma no puede abrir el embed, para que el reproductor avise.
  function openEmbed(urlEmbed, referente) {
    return callAndroid('openEmbed', [urlEmbed, referente]);
  }

  function closeEmbed() {
    callAndroid('closeEmbed', []);
  }

  function downloadUpdate(url) {
    return callAndroid('downloadAndInstall', [url]);
  }

  // ============================================================
  // ARRANQUE
  // ============================================================

  applyViewport();
  if (nombre === 'tizen') installTizenRemote();

  Telon.infra = Telon.infra || {};
  Telon.infra.platform = {
    nombre,
    esTv,
    // Solo MainActivity puede atrapar el m3u8 de un reproductor embebido (shouldInterceptRequest).
    admiteEmbed: nombre === 'android',
    // Las actualizaciones se publican como APK; en Samsung se reinstala el .wgt a mano.
    admiteActualizacion: nombre === 'android',
    setOrientation,
    openEmbed,
    closeEmbed,
    downloadUpdate,
    exitApp,
    translateTizenKey
  };
})(window.Telon = window.Telon || {});
