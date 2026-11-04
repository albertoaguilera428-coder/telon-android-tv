/*
Telón - Pintado de pantallas y navegación
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

render() decide qué pantalla se pinta según la pestaña activa, arma la barra de
navegación, conserva el scroll y en TV devuelve el foco al botón equivalente. Cada
pantalla vive en su archivo (*-screen.js y home.js).
*/
(function (Telon) {
  'use strict';

  const { $ } = Telon.ui.dom;
  const plataforma = Telon.infra.platform;
  const { estado, updateState } = Telon.app.state;
  const { clearCards } = Telon.ui.components;
  const { homeHTML, homeBody, loadHome } = Telon.ui.home;
  const { profileScreenHTML } = Telon.ui.profilesScreen;
  const { addonsHTML } = Telon.ui.addonsScreen;
  const { libHTML } = Telon.ui.libraryScreen;
  const { settingsHTML } = Telon.ui.settingsScreen;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const PESTANAS_NAVEGACION = [['home', 'Inicio', ICONOS.home], ['lib', 'Biblioteca', ICONOS.lib], ['settings', 'Ajustes', ICONOS.gear]];
  // Esperamos a que el DOM nuevo esté pintado antes de poner el foco del control remoto.
  const ESPERA_FOCO_TV_MS = 50;

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

  Telon.ui.screens = { render, setTab };
})(window.Telon = window.Telon || {});
