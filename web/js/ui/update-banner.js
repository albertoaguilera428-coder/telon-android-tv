/*
Telón - Banner de nueva versión
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Si app/update-service.js encuentra una versión más nueva, ofrece descargar el APK.
*/
'use strict';

import { escapeHTML } from './dom.js';
import { ICONOS } from './icons.js';
import { VERSION_TELON, fetchNewerVersion, downloadUpdate } from '../app/update-service.js';

// ============================================================
// BANNER
// ============================================================

// Los botones se conectan con addEventListener y no con onclick="…": así la URL que viene del
// servidor nunca termina interpretada como código dentro de un atributo HTML.
function showUpdateBanner(version) {
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.innerHTML = `<div class="modal-fondo">
      <div class="modal">
        <span class="modal-icono">${ICONOS.update}</span>
        <h3>Nueva versión disponible</h3>
        <p>${escapeHTML(version.notes || 'Hay una actualización de Telón.')}</p>
        <p class="modal-nota">v${escapeHTML(version.version)} · Actual: v${VERSION_TELON}</p>
        <div class="fila-acciones" id="updateBtns">
          <button class="btn" data-update="install">Actualizar</button>
          <button class="btn out" data-update="later">Luego</button>
        </div>
      </div>
    </div>`;
  banner.querySelector('[data-update="install"]').addEventListener('click', () => {
    if (downloadUpdate(version.url)) {
      banner.querySelector('#updateBtns').innerHTML = '<div class="spin"></div><span class="modal-nota">Descargando…</span>';
    } else {
      window.open(String(version.url));
      banner.remove();
    }
  });
  banner.querySelector('[data-update="later"]').addEventListener('click', () => banner.remove());
  document.body.appendChild(banner);
}

async function checkForUpdate() {
  const version = await fetchNewerVersion();
  if (version) showUpdateBanner(version);
}

export { checkForUpdate, showUpdateBanner };
