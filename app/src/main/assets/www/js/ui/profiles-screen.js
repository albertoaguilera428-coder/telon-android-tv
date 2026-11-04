/*
Telón - Pantalla de perfiles
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

"¿Quién está viendo?": elegir, crear y administrar perfiles, y cambiar la foto.
*/
(function (Telon) {
  'use strict';

  const { escapeHTML } = Telon.ui.dom;
  const { perfiles } = Telon.app.state;
  const { pfAvatarHTML } = Telon.ui.components;

  // ============================================================
  // PANTALLA
  // ============================================================

  function profileScreenHTML() {
    const lista = perfiles.all();
    const tarjetas = lista.map(p => `<button class="pf-card" data-act="pickprofile:${escapeHTML(p.id)}">${pfAvatarHTML(p)}<span class="pf-name">${escapeHTML(p.name)}</span></button>`).join('');
    const tarjetaNueva = `<button class="pf-card" data-act="addprofile"><span class="pf-avatar pf-add"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span class="pf-name">Añadir perfil</span></button>`;
    const acciones = lista.length ? `<div class="fila-acciones pf-acciones"><button class="btn out" data-act="editprofileimg">Cambiar foto</button><button class="btn out" data-act="manageprofiles">Administrar</button></div>` : '';
    return `<div class="pf-screen"><span class="pf-title">¿Quién está viendo?</span><div class="pf-grid">${tarjetas}${tarjetaNueva}</div>
    ${acciones}
    <input type="file" id="pffile" accept="image/*" hidden></div>`;
  }

  Telon.ui.profilesScreen = { profileScreenHTML };
})(window.Telon = window.Telon || {});
