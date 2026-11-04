/*
Telón - Arranque y acciones globales
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Último archivo en cargar: conecta los clics (data-act) con lo que hace cada pantalla,
expone las funciones que llama el sistema (botón atrás, pausa) y arranca la app.
*/
(function (Telon) {
  'use strict';

  const plataforma = Telon.infra.platform;
  const { toggleFilterValue, FILTROS_VACIOS } = Telon.domain.catalog;
  const { estado, perfiles, preferencias, clearHistory, clearLibrary, resetAllData } = Telon.app.state;
  const catalogo = Telon.app.catalogService;
  const { $, COLORES_PERFIL } = Telon.ui.dom;
  const { toast, findCard } = Telon.ui.components;
  const { homeBody, loadHome, runSearch } = Telon.ui.home;
  const { render, setTab, install } = Telon.ui.screens;
  const { openDetail, renderDetail, closeDetail, toggleLib } = Telon.ui.detail;
  const { openPlayer, closePlayer, playerSheet, playerClick, saveProgress, resume } = Telon.ui.player;
  const cuenta = Telon.ui.account;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Esperamos a que el usuario deje de escribir antes de consultar a todos los addons.
  const ESPERA_BUSQUEDA_MS = 350;

  // ============================================================
  // ADDONS
  // ============================================================

  async function reloadAddons() {
    toast('Recargando addons…');
    // Si mientras tanto empezó otra recarga, esa se encarga de pintar: esta ya no aplica.
    if (!await catalogo.reloadDefaultAddons()) return;
    estado.filas = null;
    estado.filasBusqueda = null;
    render();
    loadHome();
    toast('Addons recargados');
  }

  // ============================================================
  // ACCIONES DE PERFIL
  // ============================================================

  function addProfile() {
    const nombre = prompt('Nombre del perfil:');
    if (!nombre || !nombre.trim()) return;
    const perfil = perfiles.add(nombre.trim(), COLORES_PERFIL[perfiles.all().length % COLORES_PERFIL.length]);
    if (perfiles.all().length === 1) perfiles.setActive(perfil.id);
    render();
  }

  function pickGalleryImage(perfil) {
    const selectorArchivo = document.getElementById('pffile');
    if (!selectorArchivo) return;
    selectorArchivo.onchange = evento => {
      const archivo = evento.target.files[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = () => { perfiles.update(perfil.id, { image: lector.result }); render(); toast('Foto actualizada'); };
      lector.readAsDataURL(archivo);
      selectorArchivo.value = '';
    };
    selectorArchivo.click();
  }

  function editProfileImage() {
    const perfil = perfiles.active();
    if (!perfil) { toast('Selecciona un perfil primero'); return; }
    const eleccion = prompt('Escribe la URL de una imagen, o escribe "galería" para elegir una foto del teléfono:');
    if (!eleccion) return;
    const respuesta = eleccion.trim();
    if (respuesta.toLowerCase() === 'galería' || respuesta.toLowerCase() === 'galeria') {
      pickGalleryImage(perfil);
    } else if (respuesta.startsWith('http')) {
      perfiles.update(perfil.id, { image: respuesta });
      render();
      toast('Foto actualizada');
    } else {
      toast('URL no válida');
    }
  }

  function manageProfiles() {
    const nombres = perfiles.all().map(p => p.name).join(', ');
    const nombreABorrar = prompt('Escribe el nombre del perfil a eliminar:\n(' + nombres + ')');
    if (!nombreABorrar) return;
    const encontrado = perfiles.findByName(nombreABorrar);
    if (!encontrado) { toast('Perfil no encontrado'); return; }
    perfiles.remove(encontrado.id);
    toast('Perfil eliminado');
    render();
  }

  // ============================================================
  // ACCIONES DE ADDONS Y DATOS
  // ============================================================

  function toggleAddon(base) {
    if (!catalogo.toggleAddon(base)) return;
    estado.filas = null;
    estado.filasBusqueda = null;
    render();
  }

  function deleteAddon(base) {
    if (estado.confirmarBorrado === base) {
      catalogo.removeAddon(base);
      estado.filas = null;
      estado.confirmarBorrado = null;
      toast('Addon quitado');
    } else {
      estado.confirmarBorrado = base;
    }
    render();
  }

  function cycleQuality() {
    const siguiente = preferencias.cycleQuality();
    toast('Calidad: ' + siguiente);
    render();
  }

  function confirmAndRun(pregunta, accion) {
    if (confirm(pregunta)) accion();
  }

  function toggleSearch() {
    estado.busquedaAbierta = !estado.busquedaAbierta;
    if (!estado.busquedaAbierta) { estado.consulta = ''; estado.filasBusqueda = null; }
    render();
    if (estado.busquedaAbierta) $('#q').focus();
  }

  const resetFilters = () => { estado.filtros = { ...FILTROS_VACIOS }; };

  // ============================================================
  // TABLA DE ACCIONES (data-act="accion:argumento")
  // ============================================================

  const ACCIONES = {
    tab: argumento => { if ($('#detail') && !$('#detail').hidden) closeDetail(); setTab(argumento); },
    filter: argumento => { estado.filtros.pais = argumento; homeBody(); },
    ftype: argumento => { estado.filtros.tipo = toggleFilterValue(estado.filtros.tipo, argumento); homeBody(); },
    fgenre: argumento => { estado.filtros.genero = toggleFilterValue(estado.filtros.genero, argumento); homeBody(); },
    filterreset: () => { resetFilters(); homeBody(); },
    pickprofile: argumento => {
      perfiles.setActive(argumento);
      estado.pantallaPerfiles = false;
      render();
      if (!estado.filas && estado.addons.length) loadHome();
    },
    addprofile: addProfile,
    showprofiles: () => { estado.pantallaPerfiles = true; render(); },
    editprofileimg: editProfileImage,
    manageprofiles: manageProfiles,
    refresh: () => { estado.filas = null; loadHome(); },
    reloadaddons: () => reloadAddons(),
    search: toggleSearch,
    open: (argumento, boton) => { const referencia = findCard(boton.dataset.k); if (referencia) openDetail(referencia); },
    closedetail: () => closeDetail(),
    season: argumento => { estado.temporadaDetalle = +argumento; renderDetail(); },
    savelib: () => { toggleLib(estado.detalle.referencia); renderDetail(); },
    play: argumento => { const d = estado.detalle; if (d && !d.cargando) openPlayer(d.referencia, d.ficha, d.episodios, +argumento); },
    resume: (argumento, boton) => resume(boton.dataset.k),
    libtab: argumento => { estado.pestanaBiblioteca = argumento; render(); },
    install: () => install(),
    toggle: toggleAddon,
    del: deleteAddon,
    togglesubs: () => { preferencias.toggleAutoSubs(); render(); },
    togglenartosubs: () => { preferencias.toggleNartoSubs(); render(); },
    setquality: cycleQuality,
    clearhist: () => confirmAndRun('¿Borrar todo el historial?', () => { clearHistory(); toast('Historial borrado'); render(); }),
    clearlib: () => confirmAndRun('¿Vaciar tu lista?', () => { clearLibrary(); toast('Lista vaciada'); render(); }),
    clearall: () => confirmAndRun('¿Restablecer todo? Se borran perfiles, historial, lista y addons.', () => { resetAllData(); location.reload(); }),
    register: cuenta.registerAccount,
    emaillogin: cuenta.loginWithEmail,
    resendverify: cuenta.resendVerification,
    checkverify: cuenta.checkVerification,
    logout: cuenta.logout
  };

  function handleGlobalClick(evento) {
    // El reproductor tiene su propia tabla de acciones (data-p).
    if (evento.target.closest('#player')) return;
    const boton = evento.target.closest('[data-act]');
    if (!boton) return;
    const [accion, ...resto] = boton.dataset.act.split(':');
    if (Object.prototype.hasOwnProperty.call(ACCIONES, accion)) ACCIONES[accion](resto.join(':'), boton);
  }

  function handleInput(evento) {
    if (evento.target.id === 'addurl') estado.urlNueva = evento.target.value;
    if (evento.target.id === 'q') {
      estado.consulta = evento.target.value;
      clearTimeout(estado._temporizadorBusqueda);
      estado._temporizadorBusqueda = setTimeout(runSearch, ESPERA_BUSQUEDA_MS);
    }
  }

  // ============================================================
  // FUNCIONES QUE LLAMA EL SISTEMA (MainActivity / adaptador de Tizen)
  // ============================================================

  // Botón atrás: cierra lo que esté más arriba. Devuelve false si no queda nada y hay que salir.
  function handleBack() {
    if (estado.pantallaPerfiles && perfiles.active()) { estado.pantallaPerfiles = false; render(); return true; }
    if (estado.reproductor) { if (estado.reproductor.panel) playerSheet(null); else closePlayer(); return true; }
    if (estado.detalle) { closeDetail(); return true; }
    if (estado.busquedaAbierta) { estado.busquedaAbierta = false; estado.consulta = ''; estado.filasBusqueda = null; render(); return true; }
    if (estado.pestana !== 'home') { setTab('home'); return true; }
    return false;
  }

  function handleSystemPause() {
    if (!estado.reproductor) return;
    estado.reproductor.video.pause();
    saveProgress(true);
  }

  // ============================================================
  // ARRANQUE
  // ============================================================

  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', evento => { if (evento.key === 'Enter' && evento.target.id === 'addurl') install(); });
  $('#player').addEventListener('click', playerClick);

  window.telonBack = handleBack;
  window.telonPause = handleSystemPause;
  window.__telon = estado; // Para inspeccionar el estado desde chrome://inspect mientras depuramos.

  if (plataforma.esTv) document.body.classList.add('tv');
  render();
  reloadAddons();
  Telon.ui.updateBanner.checkForUpdate();

  Telon.main = { ACCIONES, handleBack, reloadAddons };
})(window.Telon = window.Telon || {});
