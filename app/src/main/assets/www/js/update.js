/*
Telón - Aviso de nueva versión
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Consulta un version.json publicado en el servidor y, si hay una versión más nueva,
ofrece descargar el APK. Solo aplica a Android: en Samsung el .wgt se reinstala a mano.
*/
(function (Telon) {
  'use strict';

  const { escapeHTML, logIgnored } = Telon.util;
  const plataforma = Telon.platform;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const VERSION_TELON = 2;
  const URL_VERSION = 'https://insanos.net/telon/version.json';

  // ============================================================
  // BANNER
  // ============================================================

  // Los botones se conectan con addEventListener y no con onclick="…": así la URL que viene del
  // servidor nunca termina interpretada como código dentro de un atributo HTML.
  function showUpdateBanner(version) {
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:24px">
        <div style="background:var(--superficie);border:1px solid var(--borde);border-radius:16px;padding:24px;max-width:320px;width:100%;display:flex;flex-direction:column;gap:14px">
          <h3 style="font-size:20px;font-weight:700;color:var(--texto)">Nueva versión disponible</h3>
          <p style="font-size:14px;color:var(--texto-suave);line-height:20px">${escapeHTML(version.notes || 'Hay una actualización de Telón.')}</p>
          <p style="font-size:12px;color:var(--texto-tenue)">v${escapeHTML(version.version)} · Actual: v${VERSION_TELON}</p>
          <div style="display:flex;gap:10px" id="updateBtns">
            <button class="btn" data-update="install">Actualizar</button>
            <button class="btn out" data-update="later">Luego</button>
          </div>
        </div>
      </div>`;
    banner.querySelector('[data-update="install"]').addEventListener('click', () => {
      if (plataforma.downloadUpdate(String(version.url))) {
        banner.querySelector('#updateBtns').innerHTML = '<div class="spin"></div><span style="font-size:13px;color:var(--texto-suave)">Descargando…</span>';
      } else {
        window.open(String(version.url));
        banner.remove();
      }
    });
    banner.querySelector('[data-update="later"]').addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
  }

  async function checkForUpdate() {
    if (!plataforma.admiteActualizacion) return;
    try {
      // El parámetro t evita que un proxy o el WebView nos devuelva un version.json viejo.
      const version = await (await fetch(URL_VERSION + '?t=' + Date.now())).json();
      if (version.version > VERSION_TELON && version.url) showUpdateBanner(version);
    } catch (error) {
      logIgnored('No se pudo consultar si hay versión nueva', error);
    }
  }

  Telon.update = { VERSION_TELON, checkForUpdate, showUpdateBanner };
})(window.Telon = window.Telon || {});
