/*
Telón - Estado de la app y repositorios de datos guardados
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Un solo objeto de estado para la interfaz y un repositorio por cada cosa que se guarda
en el dispositivo (perfiles, preferencias, sesión, lista, historial, addons). Las
pantallas nunca tocan localStorage: piden y guardan a través de estos repositorios.
Las claves y la forma de lo guardado no se cambian a la ligera: ahí están los datos de
los usuarios.
*/
(function (Telon) {
  'use strict';

  const { store } = Telon.infra.storage;
  const { FILTROS_VACIOS } = Telon.domain.catalog;
  const { refKey, trimHistory } = Telon.domain.progress;

  // ============================================================
  // PERFILES
  // ============================================================

  const perfiles = {
    all() { return store.get('profiles', []); },
    save(lista) { store.set('profiles', lista); },
    active() {
      const id = store.get('activeProfile', null);
      const todos = this.all();
      return todos.find(p => p.id === id) || todos[0] || null;
    },
    setActive(id) { store.set('activeProfile', id); },
    add(nombre, color) {
      const lista = this.all();
      const perfil = { id: Date.now().toString(36), name: nombre, color, pin: '' };
      lista.push(perfil);
      this.save(lista);
      return perfil;
    },
    remove(id) {
      const lista = this.all().filter(p => p.id !== id);
      this.save(lista);
      if (store.get('activeProfile') === id && lista.length) this.setActive(lista[0].id);
    },
    update(id, cambios) {
      const lista = this.all();
      const perfil = lista.find(p => p.id === id);
      if (perfil) Object.assign(perfil, cambios);
      this.save(lista);
    },
    findByName(nombre) {
      return this.all().find(p => p.name.toLowerCase() === nombre.trim().toLowerCase()) || null;
    }
  };

  // ============================================================
  // PREFERENCIAS
  // ============================================================

  const OPCIONES_CALIDAD = ['Auto', '1080p', '720p', '480p'];
  const SUBTITULOS = { lineaPorDefecto: -4, tamanoPorDefecto: 20 };

  const preferencias = {
    quality: () => store.get('quality', 'Auto'),
    cycleQuality() {
      const siguiente = OPCIONES_CALIDAD[(OPCIONES_CALIDAD.indexOf(this.quality()) + 1) % OPCIONES_CALIDAD.length];
      store.set('quality', siguiente);
      return siguiente;
    },
    autoSubs: () => store.get('autoSubs', true),
    toggleAutoSubs() { store.set('autoSubs', !this.autoSubs()); },
    // Los dramas cortos de Narto traen subtítulos quemados en la imagen: por defecto apagados.
    nartoSubs: () => store.get('nartoSubs', false),
    toggleNartoSubs() { store.set('nartoSubs', !this.nartoSubs()); },
    subtitlesEnabledFor(esNarto) { return esNarto ? this.nartoSubs() : this.autoSubs(); },
    subtitleLine: () => store.get('subLine', SUBTITULOS.lineaPorDefecto),
    saveSubtitleLine(linea) { store.set('subLine', linea); },
    subtitleSize: () => store.get('subSize', SUBTITULOS.tamanoPorDefecto),
    saveSubtitleSize(tamano) { store.set('subSize', tamano); }
  };

  // ============================================================
  // SESIÓN DE LA CUENTA
  // ============================================================

  const sesion = {
    get: () => store.get('loginProvider', null),
    save(datos) { store.set('loginProvider', datos); },
    clear() { store.set('loginProvider', null); }
  };

  // ============================================================
  // ESTADO DE LA INTERFAZ
  // ============================================================

  const estado = {
    pestana: 'home', filtros: { ...FILTROS_VACIOS }, pestanaBiblioteca: 'list', busquedaAbierta: false, consulta: '',
    pantallaPerfiles: !perfiles.all().length,
    addons: [], // Los llena reloadDefaultAddons(): la lista viene fija en el código.
    biblioteca: store.get('lib', []), // Guardada con los campos del protocolo Stremio: [{ base, type, id, name, poster, country }]
    historial: store.get('hist', {}), // refKey → última posición vista.
    filas: null, filasConError: 0, cargando: false,
    filasBusqueda: null, buscando: false,
    urlNueva: '', instalando: false, errorInstalar: '', confirmarBorrado: null,
    detalle: null, reproductor: null,
    temporadaDetalle: null, temporadaReproductor: null
  };

  // ============================================================
  // ADDONS
  // ============================================================

  const getEnabledAddons = () => estado.addons.filter(a => a.enabled);
  const findAddon = base => estado.addons.find(a => a.base === base);

  // Los addons virtuales (base "__…__") viven en el código y llevan cachés con páginas HTML
  // enteras: guardarlos llenaba localStorage. Solo persistimos lo que describe a cada addon.
  const isVirtualAddon = addon => /^__.+__$/.test(addon.base);
  const toStoredAddon = addon => ({ base: addon.base, manifest: addon.manifest, enabled: addon.enabled });
  const saveAddons = () => store.set('addons', estado.addons.filter(a => !isVirtualAddon(a)).map(toStoredAddon));

  // ============================================================
  // MI LISTA E HISTORIAL
  // ============================================================

  const isInLibrary = referencia => estado.biblioteca.some(x => refKey(x) === refKey(referencia));

  // Guarda con el nombre y póster de la ficha completa si ya llegó; son mejores que los de la tarjeta.
  // Devuelve true si quedó guardada y false si se quitó.
  function toggleLibrary(referencia, ficha = {}) {
    const indice = estado.biblioteca.findIndex(x => refKey(x) === refKey(referencia));
    if (indice >= 0) {
      estado.biblioteca.splice(indice, 1);
    } else {
      estado.biblioteca.push({ base: referencia.base, type: referencia.type, id: referencia.id, name: ficha.name || referencia.name, poster: ficha.poster || referencia.poster, country: referencia.country });
    }
    store.set('lib', estado.biblioteca);
    return indice < 0;
  }

  function clearLibrary() {
    estado.biblioteca = [];
    store.set('lib', estado.biblioteca);
  }

  function saveHistory() {
    estado.historial = trimHistory(estado.historial);
    store.set('hist', estado.historial);
  }

  function recordProgress(entrada) {
    estado.historial[entrada.key] = entrada;
    saveHistory();
  }

  function clearHistory() {
    estado.historial = {};
    saveHistory();
  }

  const resetAllData = () => store.clearAll();

  Telon.app = Telon.app || {};
  Telon.app.state = { SUBTITULOS, perfiles, preferencias, sesion, estado, refKey, getEnabledAddons, findAddon, isVirtualAddon, saveAddons,
    isInLibrary, toggleLibrary, clearLibrary, recordProgress, clearHistory, resetAllData };
})(window.Telon = window.Telon || {});
