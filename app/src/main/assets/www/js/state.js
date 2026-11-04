/*
Telón - Estado de la app y datos guardados
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Un solo objeto de estado para toda la interfaz, más los perfiles, la lista y el
historial que se guardan en el dispositivo. Las claves de localStorage y la forma de
lo guardado no se cambian a la ligera: ahí están los datos de los usuarios.
*/
(function (Telon) {
  'use strict';

  const { store } = Telon.util;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Suficiente para "Continuar viendo" sin que el historial crezca sin límite en el almacenamiento.
  const MAXIMO_HISTORIAL = 60;

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
    }
  };

  // ============================================================
  // ESTADO DE LA INTERFAZ
  // ============================================================

  const estado = {
    pestana: 'home', filtroPais: 'all', filtroTipo: 'all', filtroGenero: 'all', pestanaBiblioteca: 'list', busquedaAbierta: false, consulta: '',
    pantallaPerfiles: !perfiles.all().length,
    addons: [], // Los llena reloadAddons(): la lista viene fija en el código, no la arma el usuario.
    biblioteca: store.get('lib', []), // Guardada con los campos del protocolo Stremio: [{ base, type, id, name, poster, country }]
    historial: store.get('hist', {}), // refKey → última posición vista.
    filas: null, filasConError: 0, cargando: false,
    filasBusqueda: null, buscando: false,
    urlNueva: '', instalando: false, errorInstalar: '', confirmarBorrado: null,
    detalle: null, reproductor: null,
    temporadaDetalle: null, temporadaReproductor: null
  };

  const refKey = r => r.base + '|' + r.type + '|' + r.id;

  const getEnabledAddons = () => estado.addons.filter(a => a.enabled);
  const findAddon = base => estado.addons.find(a => a.base === base);

  // ============================================================
  // GUARDADO
  // ============================================================

  // Los addons virtuales (base "__…__") viven en el código y llevan cachés con páginas HTML
  // enteras: guardarlos llenaba localStorage. Solo persistimos lo que describe a cada addon.
  const isVirtualAddon = addon => /^__.+__$/.test(addon.base);
  const toStoredAddon = addon => ({ base: addon.base, manifest: addon.manifest, enabled: addon.enabled });
  const saveAddons = () => store.set('addons', estado.addons.filter(a => !isVirtualAddon(a)).map(toStoredAddon));

  const saveLib = () => store.set('lib', estado.biblioteca);

  // Conserva las entradas más recientes; el orden de inserción del objeto queda de más nueva a más vieja.
  function trimHistory(historial, maximo = MAXIMO_HISTORIAL) {
    const recortado = {};
    Object.values(historial).sort((a, b) => b.ts - a.ts).slice(0, maximo).forEach(e => { recortado[e.key] = e; });
    return recortado;
  }

  const saveHist = () => {
    estado.historial = trimHistory(estado.historial);
    store.set('hist', estado.historial);
  };

  const isInLibrary = referencia => estado.biblioteca.some(x => refKey(x) === refKey(referencia));

  Telon.state = { MAXIMO_HISTORIAL, perfiles, estado, refKey, getEnabledAddons, findAddon, isVirtualAddon, saveAddons, saveLib, saveHist, trimHistory, isInLibrary };
})(window.Telon = window.Telon || {});
