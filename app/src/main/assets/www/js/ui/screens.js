/*
Telón - Pantallas de perfiles, addons, biblioteca y ajustes
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Además de esas pantallas, aquí vive render(): el que decide qué se pinta según la
pestaña activa y arma la barra de navegación.
*/
(function (Telon) {
  'use strict';

  const { $, escapeHTML, toneClass, toInitials, safeUrl, safeColor } = Telon.ui.dom;
  const plataforma = Telon.infra.platform;
  const { userMessageFor } = Telon.infra.errors;
  const { listResourceNames } = Telon.domain.catalog;
  const { progressPercent, sortByRecent } = Telon.domain.progress;
  const { estado, updateState, perfiles, preferencias, sesion } = Telon.app.state;
  const { installAddon } = Telon.app.catalogService;
  const { toast, registerCard, clearCards, posterHTML, pfAvatarHTML } = Telon.ui.components;
  const { homeHTML, homeBody, loadHome } = Telon.ui.home;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const PESTANAS_NAVEGACION = [['home', 'Inicio', ICONOS.home], ['lib', 'Biblioteca', ICONOS.lib], ['settings', 'Ajustes', ICONOS.gear]];
  // Esperamos a que el DOM nuevo esté pintado antes de poner el foco del control remoto.
  const ESPERA_FOCO_TV_MS = 50;

  // ============================================================
  // PANTALLA: PERFILES
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

  // ============================================================
  // PANTALLA: ADDONS
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

  // ============================================================
  // PANTALLA: BIBLIOTECA
  // ============================================================

  function savedListHTML() {
    if (!estado.biblioteca.length) return `<div class="empty"><h3>Tu lista está vacía</h3><p>Abre una serie y toca «Guardar» para tenerla aquí.</p></div>`;
    const tarjetas = estado.biblioteca.slice().reverse().map(item => {
      const clave = registerCard(item);
      return `<button class="card" data-act="open" data-k="${escapeHTML(clave)}">${posterHTML(item)}<span class="cname">${escapeHTML(item.name)}</span></button>`;
    }).join('');
    return `<div class="grid3">${tarjetas}</div>`;
  }

  function historyListHTML() {
    const entradas = sortByRecent(estado.historial);
    if (!entradas.length) return `<div class="empty"><h3>Sin historial</h3><p>Lo que veas aparecerá aquí para retomarlo.</p></div>`;
    const filas = entradas.map(e => `<button class="hrow" data-act="resume" data-k="${escapeHTML(e.key)}">${posterHTML({ name: e.name, poster: e.poster })}<div class="itext"><b>${escapeHTML(e.name)}</b><span>${escapeHTML(e.label || '')}</span><div class="prog"><i style="width:${progressPercent(e)}%"></i></div></div></button>`).join('');
    return `<div class="list con-aire">${filas}</div>`;
  }

  function libHTML() {
    const enLista = estado.pestanaBiblioteca === 'list';
    return `<div class="head"><h1>Biblioteca</h1></div>
    <div class="tabs"><button class="${enLista ? 'on' : ''}" data-act="libtab:list">Mi lista</button><button class="${estado.pestanaBiblioteca === 'hist' ? 'on' : ''}" data-act="libtab:hist">Historial</button></div>
    <main class="scroll">${enLista ? savedListHTML() : historyListHTML()}</main>`;
  }

  // ============================================================
  // PANTALLA: AJUSTES
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

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================

  const PANTALLAS = { addons: addonsHTML, settings: settingsHTML, lib: libHTML };

  // render() reemplaza el HTML y el botón enfocado desaparece. Recordamos qué acción tenía para
  // devolverle el foco al botón equivalente: si no, cada clic te mandaba a otro lado de la pantalla.
  function describeFocusedButton() {
    const enfocado = document.activeElement;
    if (!enfocado || !enfocado.dataset || !enfocado.dataset.act) return null;
    return { accion: enfocado.dataset.act, clave: enfocado.dataset.k };
  }

  function findEquivalentButton(descripcion) {
    if (!descripcion) return null;
    return [...document.querySelectorAll('#screen [data-act], #nav [data-act]')]
      .find(b => b.dataset.act === descripcion.accion && b.dataset.k === descripcion.clave) || null;
  }

  // En TV no hay dedo que toque: si nadie tiene el foco, el control remoto no sirve. Sin botón
  // equivalente, la prioridad es la pestaña activa, luego la pantalla. Se consulta por separado
  // porque una lista de selectores devuelve el primero en orden del documento, no por prioridad.
  function restoreTvFocus(descripcion) {
    setTimeout(() => {
      const objetivo = findEquivalentButton(descripcion) || document.querySelector('#nav button.on')
        || document.querySelector('#screen button') || document.querySelector('#nav button');
      if (objetivo) { objetivo.focus(); objetivo.scrollIntoView({ block: 'nearest' }); }
    }, ESPERA_FOCO_TV_MS);
  }

  function navigationHTML() {
    return PESTANAS_NAVEGACION.map(([clave, etiqueta, icono]) => {
      const activa = estado.pestana === clave;
      return `<button class="${activa ? 'on' : ''}" data-act="tab:${clave}" ${activa ? 'aria-current="page"' : ''}><span class="pill">${icono}</span>${etiqueta}</button>`;
    }).join('');
  }

  // Pestaña que está pintada ahora: el scroll solo se conserva al repintar esa misma.
  let pestanaPintada = null;

  function render() {
    if (estado.pantallaPerfiles) {
      pestanaPintada = null;
      $('#screen').innerHTML = profileScreenHTML();
      $('#nav').innerHTML = '';
      return;
    }
    // Al repintar la misma pestaña conservamos el scroll, si no cada toque te mandaría al inicio de
    // la lista. Al cambiar de pestaña se empieza arriba: el scroll de otra pantalla no significa nada.
    const focoPrevio = describeFocusedButton();
    const mismaPestana = pestanaPintada === estado.pestana;
    pestanaPintada = estado.pestana;
    // La pantalla se pinta de nuevo entera: las tarjetas que se registren son las únicas a la vista.
    clearCards();
    const scrollActual = document.querySelector('#screen .scroll');
    const scrollPrevio = scrollActual && mismaPestana ? scrollActual.scrollTop : 0;
    const pantalla = $('#screen');
    if (estado.pestana === 'home') {
      pantalla.innerHTML = homeHTML();
      homeBody();
    } else {
      pantalla.innerHTML = (PANTALLAS[estado.pestana] || libHTML)();
    }
    const scrollNuevo = document.querySelector('#screen .scroll');
    if (scrollNuevo && scrollPrevio) scrollNuevo.scrollTop = scrollPrevio;
    $('#nav').innerHTML = navigationHTML();
    if (plataforma.esTv) restoreTvFocus(focoPrevio);
  }

  function setTab(pestana) {
    updateState({ pestana, confirmarBorrado: null });
    if (pestana === 'home' && estado.filas === null && estado.addons.length && !estado.cargando) loadHome();
  }

  Telon.ui.screens = { render, setTab, install };
})(window.Telon = window.Telon || {});
