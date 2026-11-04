/*
Telón - Pantalla de inicio y búsqueda
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Inicio arma, a partir de los catálogos de los addons activos, los filtros, el
destacado, "Continuar viendo" y una sección por catálogo. La búsqueda consulta solo
los catálogos que declaran soportarla.
*/
(function (Telon) {
  'use strict';

  const { $, escapeHTML, colorFor, logIgnored } = Telon.util;
  const { getJSON, buildAddonUrl, getCountryCode, getCountryLabel } = Telon.addonClient;
  const { estado, perfiles, getEnabledAddons } = Telon.state;
  const { registerCard, spinnerHTML, posterHTML, cardHTML, progressPercent, emptyAddonsHTML, miniAvatarHTML } = Telon.ui.components;
  const ICONOS = Telon.ICONOS;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const ETIQUETAS_TIPO = { series: 'Series', movie: 'Películas', short: 'Cortos' };
  const MAXIMO_CHIPS_GENERO = 12;
  const MAXIMO_CONTINUAR_VIENDO = 10;
  const ID_SOLOLATINO = 'app.telon.sololatino';
  // Encabezados de grupo más amigables que el nombre técnico de cada addon virtual.
  const ETIQUETAS_GRUPO = { 'app.telon.sololatino': 'Series', 'app.telon.nartodrama': 'Dramas Cortos' };
  const TODOS = 'all';

  // ============================================================
  // ESQUELETO
  // ============================================================

  function homeHTML() {
    return `<header class="appbar"><span class="logo"><img src="logo.webp" alt="Telón" style="height:36px"></span><div style="display:flex">
    <button class="iconbtn" data-act="reloadaddons" aria-label="Recargar addons" title="Recargar addons">${ICONOS.refresh}</button>
    <button class="iconbtn" data-act="search" aria-label="Buscar">${ICONOS.search}</button>${miniAvatarHTML(perfiles.active())}</div></header>
    ${estado.busquedaAbierta ? `<div class="searchbar"><input id="q" type="search" placeholder="Buscar series, géneros, países…" value="${escapeHTML(estado.consulta)}" autocomplete="off"></div>` : ''}
    <main class="scroll" id="homeBody"></main>`;
  }

  // ============================================================
  // FILTROS
  // ============================================================

  const unique = lista => [...new Set(lista.filter(Boolean))];

  function collectFilterOptions(filas) {
    return {
      codigosPais: unique(filas.flatMap(f => f.metas.map(getCountryCode))),
      generos: unique(filas.flatMap(f => f.metas.flatMap(m => m.genres || []))).sort(),
      tipos: unique(filas.map(f => f.cat.type))
    };
  }

  // Si al recargar ya no existe la opción elegida (otro addon, otro catálogo), volvemos a "Todo".
  function resetStaleFilters({ codigosPais, generos, tipos }) {
    if (estado.filtroPais !== TODOS && !codigosPais.includes(estado.filtroPais)) estado.filtroPais = TODOS;
    if (estado.filtroGenero !== TODOS && !generos.includes(estado.filtroGenero)) estado.filtroGenero = TODOS;
    if (estado.filtroTipo !== TODOS && !tipos.includes(estado.filtroTipo)) estado.filtroTipo = TODOS;
  }

  const chipHTML = (activo, accion, texto) => `<button class="chip ${activo ? 'on' : ''}" data-act="${accion}">${escapeHTML(texto)}</button>`;

  function filterChipsHTML({ codigosPais, generos, tipos }) {
    if (tipos.length <= 1 && !codigosPais.length && !generos.length) return '';
    const sinFiltros = estado.filtroPais === TODOS && estado.filtroTipo === TODOS && estado.filtroGenero === TODOS;
    const chipsTipo = tipos.length > 1 ? tipos.map(t => chipHTML(estado.filtroTipo === t, 'ftype:' + escapeHTML(t), ETIQUETAS_TIPO[t] || t)).join('') : '';
    const chipsPais = codigosPais.map(c => chipHTML(estado.filtroPais === c, 'filter:' + escapeHTML(c), getCountryLabel(c))).join('');
    const chipsGenero = generos.slice(0, MAXIMO_CHIPS_GENERO).map(g => chipHTML(estado.filtroGenero === g, 'fgenre:' + escapeHTML(g), g)).join('');
    return `<div class="chips"><button class="chip ${sinFiltros ? 'on' : ''}" data-act="filterreset">Todo</button>${chipsTipo}${chipsPais}${chipsGenero}</div>`;
  }

  function applyFilters(filas) {
    const pasaFiltros = m => (estado.filtroPais === TODOS || getCountryCode(m) === estado.filtroPais)
      && (estado.filtroGenero === TODOS || (m.genres || []).includes(estado.filtroGenero));
    return filas
      .map(f => ({ ...f, metas: f.metas.filter(pasaFiltros) }))
      .filter(f => f.metas.length && (estado.filtroTipo === TODOS || f.cat.type === estado.filtroTipo));
  }

  // ============================================================
  // SECCIONES
  // ============================================================

  function heroHTML(visibles) {
    const primero = visibles[0] && visibles[0].metas[0];
    if (!primero) return '';
    const addon = visibles[0].addon;
    const pais = getCountryCode(primero);
    const clave = registerCard({ base: addon.base, type: primero.type || visibles[0].cat.type, id: primero.id, name: primero.name, poster: primero.poster, country: pais });
    const imagenFondo = primero.background || primero.poster;
    const subtitulo = [(primero.genres || []).slice(0, 2).join(' · '), addon.manifest.name].filter(Boolean).join(' · ');
    return `<button class="hero" data-act="open" data-k="${escapeHTML(clave)}" style="background-color:${colorFor(primero.name)};${imagenFondo ? `background-image:url('${escapeHTML(imagenFondo)}')` : ''}">
      <span class="badge">Destacado${pais ? ' · ' + escapeHTML(pais) : ''}</span>
      <span class="herorow"><span><h2>${escapeHTML(primero.name)}</h2><div class="herosub">${escapeHTML(subtitulo)}</div></span><span class="playfab">${ICONOS.play}</span></span></button>`;
  }

  function continueWatchingHTML() {
    const recientes = Object.values(estado.historial).filter(h => h.t > 1).sort((a, b) => b.ts - a.ts).slice(0, MAXIMO_CONTINUAR_VIENDO);
    if (!recientes.length) return '';
    const tarjetas = recientes.map(h => {
      const barra = `<div class="prog"><i style="width:${progressPercent(h)}%"></i></div>`;
      return `<button class="card wide" data-act="resume" data-k="${escapeHTML(h.key)}">${posterHTML({ name: h.name, poster: h.poster }, barra)}<span class="cname">${escapeHTML(h.name)}</span><span class="cmeta">${escapeHTML(h.label || '')}</span></button>`;
    }).join('');
    return `<div class="section"><h2>Continuar viendo</h2><div class="row">${tarjetas}</div></div>`;
  }

  // SoloLatino se ve mejor en fila horizontal; el resto en grilla de tres.
  function catalogSectionHTML(fila) {
    const enFila = fila.addon.manifest.id === ID_SOLOLATINO;
    return `<div class="section"><h2>${escapeHTML(fila.cat.name || fila.cat.id)}</h2><span class="sub">${escapeHTML(fila.addon.manifest.name)}</span><div class="${enFila ? 'row' : 'grid3'}">${fila.metas.map(m => cardHTML(fila.addon, fila.cat.type, m)).join('')}</div></div>`;
  }

  // Cada vez que cambia el addon ponemos un encabezado de grupo para separar de dónde viene el contenido.
  function catalogSectionsHTML(visibles) {
    let ultimoIdAddon = '';
    return visibles.map(fila => {
      const idAddon = fila.addon.manifest.id;
      let encabezado = '';
      if (idAddon !== ultimoIdAddon) {
        ultimoIdAddon = idAddon;
        encabezado = `<div class="section" style="margin-top:16px"><h2 style="font-size:26px;opacity:.5">${escapeHTML(ETIQUETAS_GRUPO[idAddon] || fila.addon.manifest.name)}</h2></div>`;
      }
      return encabezado + catalogSectionHTML(fila);
    }).join('');
  }

  function noCatalogsHTML() {
    const motivo = estado.filasConError ? 'Los addons no respondieron.' : 'Tus addons activos no ofrecen catálogos.';
    return `<div class="empty"><h3>Sin catálogos</h3><p>${motivo} Revisa que estén activos y que el servidor esté encendido.</p><div style="display:flex;gap:8px"><button class="btn" data-act="refresh">Reintentar</button><button class="btn out" data-act="tab:addons">Ver addons</button></div></div>`;
  }

  function homeBody() {
    const contenedor = $('#homeBody');
    if (!contenedor) return;
    if (!estado.addons.length) { contenedor.innerHTML = emptyAddonsHTML(); return; }
    if (estado.busquedaAbierta && estado.consulta.trim()) { contenedor.innerHTML = searchHTML(); return; }
    if (estado.cargando && !estado.filas) { contenedor.innerHTML = spinnerHTML('Cargando'); return; }
    const filas = estado.filas || [];
    if (!filas.length) { contenedor.innerHTML = noCatalogsHTML(); return; }
    const opciones = collectFilterOptions(filas);
    resetStaleFilters(opciones);
    const visibles = applyFilters(filas);
    const avisoErrores = estado.filasConError ? `<p class="hint" style="padding:0 16px">${estado.filasConError} catálogo(s) no respondieron.</p>` : '';
    contenedor.innerHTML = filterChipsHTML(opciones) + heroHTML(visibles) + continueWatchingHTML() + catalogSectionsHTML(visibles) + avisoErrores;
  }

  // ============================================================
  // CARGA DE CATÁLOGOS Y BÚSQUEDA
  // ============================================================

  const toRow = (addon, catalogo) => respuesta => ({ addon, cat: catalogo, metas: (respuesta.metas || []).filter(m => m && m.id && m.name) });

  // Los catálogos que exigen un parámetro (género, búsqueda…) no se pueden mostrar sin él.
  const needsExtra = catalogo => (catalogo.extra || []).some(e => e.isRequired) || (catalogo.extraRequired || []).length;
  const supportsSearch = catalogo => (catalogo.extra || []).some(e => e.name === 'search') || (catalogo.extraSupported || []).includes('search');

  async function loadHome() {
    estado.cargando = true;
    estado.filasConError = 0;
    if (estado.pestana === 'home') homeBody();
    const peticiones = [];
    for (const addon of getEnabledAddons()) {
      for (const catalogo of (addon.manifest.catalogs || [])) {
        if (needsExtra(catalogo)) continue;
        peticiones.push(getJSON(buildAddonUrl(addon, 'catalog', catalogo.type, catalogo.id))
          .then(toRow(addon, catalogo))
          .catch(error => {
            logIgnored('El catálogo ' + catalogo.id + ' no respondió', error);
            estado.filasConError++;
            return null;
          }));
      }
    }
    estado.filas = (await Promise.all(peticiones)).filter(f => f && f.metas.length);
    estado.cargando = false;
    if (estado.pestana === 'home') homeBody();
  }

  function searchHTML() {
    if (estado.buscando) return spinnerHTML('Buscando');
    const filas = estado.filasBusqueda || [];
    if (!filas.length) return `<div class="empty"><h3>Sin resultados</h3><p>Ningún addon devolvió resultados para «${escapeHTML(estado.consulta)}». Solo buscan los catálogos que declaran soporte de búsqueda.</p></div>`;
    return filas.map(catalogSectionHTML).join('');
  }

  // Si el usuario sigue escribiendo, una búsqueda vieja puede terminar después de la nueva;
  // el número de secuencia descarta esas respuestas tardías.
  let secuenciaBusqueda = 0;

  async function runSearch() {
    const consulta = estado.consulta.trim();
    const secuencia = ++secuenciaBusqueda;
    if (!consulta) { estado.filasBusqueda = null; homeBody(); return; }
    estado.buscando = true;
    homeBody();
    const peticiones = [];
    for (const addon of getEnabledAddons()) {
      for (const catalogo of (addon.manifest.catalogs || [])) {
        if (!supportsSearch(catalogo)) continue;
        peticiones.push(getJSON(buildAddonUrl(addon, 'catalog', catalogo.type, catalogo.id, 'search=' + encodeURIComponent(consulta)))
          .then(toRow(addon, catalogo))
          .catch(error => {
            logIgnored('La búsqueda en ' + catalogo.id + ' falló', error);
            return null;
          }));
      }
    }
    const resultados = (await Promise.all(peticiones)).filter(f => f && f.metas.length);
    if (secuencia !== secuenciaBusqueda) return;
    estado.filasBusqueda = resultados;
    estado.buscando = false;
    homeBody();
  }

  Telon.ui.home = { homeHTML, homeBody, loadHome, runSearch, collectFilterOptions, applyFilters };
})(window.Telon = window.Telon || {});
