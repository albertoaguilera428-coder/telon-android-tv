/*
Telón - Pantalla de ajustes
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Cuenta y perfil, preferencias de reproducción, borrar datos e información de la app.
*/
(function (Telon) {
  'use strict';

  const { escapeHTML, safeColor } = Telon.ui.dom;
  const { estado, perfiles, preferencias, sesion } = Telon.app.state;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CUENTA
  // ============================================================

  function profileCardHTML() {
    const perfil = perfiles.active();
    if (!perfil) return '';
    return `<div class="set-card" data-act="showprofiles"><div class="set-avatar" style="background:${safeColor(perfil.color)}">${escapeHTML(perfil.name[0].toUpperCase())}</div><div class="itext"><b>${escapeHTML(perfil.name)}</b><span>Cambiar perfil</span></div><span class="set-arrow">${ICONOS.back}</span></div>`;
  }

  function verificationCardsHTML() {
    return `<div class="set-card" data-act="resendverify"><div class="set-icon amarillo"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="0"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg></div><div class="itext"><b>Reenviar verificación</b><span>Te enviaremos un correo para verificar tu cuenta</span></div></div><div class="set-card" data-act="checkverify"><div class="set-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><div class="itext"><b>Ya verifiqué mi correo</b><span>Toca aquí para actualizar el estado</span></div></div>`;
  }

  function accountHTML() {
    const datosSesion = sesion.get();
    if (!datosSesion) {
      return `<div class="auth-form"><input id="authname" type="text" placeholder="Nombre" class="auth-input"><input id="authemail" type="email" placeholder="Correo electrónico" class="auth-input"><input id="authpass" type="password" placeholder="Contraseña (mín. 6 caracteres)" class="auth-input"><button class="btn pri" data-act="register">Crear cuenta</button><div class="auth-separador">¿Ya tienes cuenta?</div><button class="btn out" data-act="emaillogin">Iniciar sesión</button></div>`;
    }
    const marcaSinVerificar = datosSesion.verified ? '' : ' · <em class="aviso-amarillo">Sin verificar</em>';
    const tarjetaSesion = `<div class="set-card"><div class="set-icon">${ICONOS.user}</div><div class="itext"><b>${escapeHTML(datosSesion.name || datosSesion.email)}</b><span>${escapeHTML(datosSesion.email)}${marcaSinVerificar}</span></div><button class="btn out chico" data-act="logout">Cerrar sesión</button></div>`;
    return tarjetaSesion + (datosSesion.verified ? '' : verificationCardsHTML());
  }

  // ============================================================
  // PANTALLA
  // ============================================================

  function settingsHTML() {
    return `<div class="head"><h1>Ajustes</h1></div><main class="scroll con-aire">
    <div class="set-section"><label>Cuenta</label>${profileCardHTML()}${accountHTML()}</div>
    <div class="set-section"><label>Reproducción</label>
      <div class="set-card" data-act="setquality"><div class="itext"><b>Calidad preferida</b><span>${escapeHTML(preferencias.quality())}</span></div><span class="set-arrow">${ICONOS.back}</span></div>
      <div class="set-card"><div class="itext"><b>Subtítulos automáticos</b><span>Activar subtítulos si están disponibles</span></div><button class="switch" role="switch" aria-checked="${preferencias.autoSubs()}" data-act="togglesubs"><i></i></button></div>
      <div class="set-card"><div class="itext"><b>Subtítulos en dramas cortos</b><span>Activar subtítulos en series de Narto Drama</span></div><button class="switch" role="switch" aria-checked="${preferencias.nartoSubs()}" data-act="togglenartosubs"><i></i></button></div></div>
    <div class="set-section"><label>Datos</label>
      <div class="set-card" data-act="clearhist"><div class="itext"><b>Borrar historial</b><span>${Object.keys(estado.historial).length} elementos</span></div></div>
      <div class="set-card" data-act="clearlib"><div class="itext"><b>Vaciar mi lista</b><span>${estado.biblioteca.length} elementos guardados</span></div></div>
      <div class="set-card" data-act="clearall"><div class="itext"><b>Restablecer todo</b><span>Borra perfiles, historial, lista y addons</span></div></div></div>
    <div class="set-section"><label>Info</label>
      <div class="set-card"><div class="itext"><b>Telón</b><span>v1.0 · Todos los derechos reservados</span></div></div></div>
  </main>`;
  }

  Telon.ui.settingsScreen = { settingsHTML };
})(window.Telon = window.Telon || {});
