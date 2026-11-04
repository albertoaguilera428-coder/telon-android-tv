/*
Telón - Pantalla de addons
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Instalar un addon por enlace, activarlo, desactivarlo o quitarlo (con confirmación).
*/
(function (Telon) {
  'use strict';

  const { escapeHTML, toneClass, toInitials, safeUrl } = Telon.ui.dom;
  const { userMessageFor } = Telon.infra.errors;
  const { listResourceNames } = Telon.domain.catalog;
  const { estado, updateState } = Telon.app.state;
  const { installAddon } = Telon.app.catalogService;
  const { toast } = Telon.ui.components;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // LISTA DE ADDONS
  // ============================================================

  function addonItemHTML(addon) {
    const m = addon.manifest;
    const recursos = listResourceNames(m);
    const logo = safeUrl(m.logo) ? `<img src="${escapeHTML(safeUrl(m.logo))}" alt="" data-fallback="remove">` : '';
    // Quitar un addon pide dos toques: el primero arma la confirmación, el segundo borra.
    const confirmando = estado.confirmarBorrado === addon.base;
    return `<div class="item"><div class="logo48 ${toneClass(m.name)}">${logo || escapeHTML(toInitials(m.name))}</div>
      <div class="itext"><b>${escapeHTML(m.name)} <span class="version">v${escapeHTML(m.version || '?')}</span></b><span>${escapeHTML(m.description || addon.base)}</span><div class="res">${recursos.map(r => `<i>${escapeHTML(r)}</i>`).join('')}</div></div>
      <button class="del ${confirmando ? 'sure' : ''}" data-act="del:${escapeHTML(addon.base)}" aria-label="Quitar ${escapeHTML(m.name)}">${confirmando ? 'Quitar' : ICONOS.trash}</button>
      <button class="switch" role="switch" aria-checked="${addon.enabled}" aria-label="Activar ${escapeHTML(m.name)}" data-act="toggle:${escapeHTML(addon.base)}"><i></i></button></div>`;
  }

  function addonsHTML() {
    const instalados = estado.addons.length ? `<div class="list">${estado.addons.map(addonItemHTML).join('')}</div>` : '<p class="hint con-margen">No hay addons instalados.</p>';
    return `<div class="head"><h1>Addons</h1><p>Cada addon aporta catálogos, fuentes de video o subtítulos. Activa solo los que quieras.</p></div>
    <main class="scroll con-aire">
      <div class="addwrap"><label for="addurl">Añadir addon por enlace</label>
        <div class="addrow"><input id="addurl" type="url" inputmode="url" placeholder="https://…/manifest.json" value="${escapeHTML(estado.urlNueva)}" autocomplete="off" autocapitalize="off"><button class="btn" data-act="install" ${estado.instalando ? 'disabled' : ''}>${estado.instalando ? '…' : 'Instalar'}</button></div>
        ${estado.errorInstalar ? `<p class="err" role="alert">${escapeHTML(estado.errorInstalar)}</p>` : ''}
        <p class="hint">Acepta la URL del manifest.json o la carpeta que lo contiene. Si el servidor está en tu red local usa la IP del equipo, por ejemplo http://192.168.1.20:7000/manifest.json</p></div>
      <div class="section"><h2>Instalados</h2></div>
      ${instalados}
    </main>`;
  }

  // ============================================================
  // INSTALAR POR ENLACE
  // ============================================================

  async function install() {
    if (!estado.urlNueva.trim()) return;
    updateState({ instalando: true, errorInstalar: '' });
    try {
      const manifest = await installAddon(estado.urlNueva);
      if (manifest) toast('Instalado: ' + manifest.name);
      updateState({ urlNueva: '', filas: null, filasBusqueda: null, instalando: false });
    } catch (error) {
      updateState({ errorInstalar: 'No se pudo instalar: ' + userMessageFor(error) + '. Revisa el enlace y que el servidor esté encendido.', instalando: false });
    }
  }

  Telon.ui.addonsScreen = { addonsHTML, install };
})(window.Telon = window.Telon || {});
