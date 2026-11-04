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

  const { $, escapeHTML, toneClass, cssUrl } = Telon.ui.dom;
  const { getCountryCode, getCountryLabel } = Telon.domain.countries;
  const { collectFilterOptions, resetStaleFilters, applyFilters, hasActiveFilters } = Telon.domain.catalog;
  const { progressPercent, continueWatching } = Telon.domain.progress;
  const { estado, perfiles } = Telon.app.state;
  const { loadCatalogs, searchCatalogs } = Telon.app.catalogService;
  const { registerCard, spinnerHTML, skeletonHomeHTML, posterHTML, cardHTML, emptyAddonsHTML, miniAvatarHTML } = Telon.ui.components;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CONSTANTES
  // ============================================================

  const ETIQUETAS_TIPO = { series: 'Series', movie: 'Películas', short: 'Cortos' };
  const MAXIMO_CHIPS_GENERO = 12;
  const ID_SOLOLATINO = 'app.telon.sololatino';
  // Encabezados de grupo más amigables que el nombre técnico de cada addon virtual.
  const ETIQUETAS_GRUPO = { 'app.telon.sololatino': 'Series', 'app.telon.nartodrama': 'Dramas Cortos' };

  // ============================================================
  // ESQUELETO
  // ============================================================

  function homeHTML() {
    return `<header class="appbar"><span class="logo"><img src="logo.webp" alt=""><span class="titulo-marca">TELÓN</span></span><div class="appbar-acciones">
    <button class="iconbtn" data-act="reloadaddons" aria-label="Recargar addons" title="Recargar addons">${ICONOS.refresh}</button>
    <button class="iconbtn" data-act="search" aria-label="Buscar">${ICONOS.search}</button>${miniAvatarHTML(perfiles.active())}</div></header>
    ${estado.busquedaAbierta ? `<div class="searchbar"><input id="q" type="search" placeholder="Buscar series, géneros, países…" value="${escapeHTML(estado.consulta)}" autocomplete="off"></div>` : ''}
    <main class="scroll" id="homeBody"></main>`;
  }

  // ============================================================
  // FILTROS
  // ============================================================

  const chipHTML = (activo, accion, texto) => `<button class="chip ${activo ? 'on' : ''}" data-act="${accion}">${escapeHTML(texto)}</button>`;

  function filterChipsHTML({ codigosPais, generos, tipos }, filtros) {
    if (tipos.length <= 1 && !codigosPais.length && !generos.length) return '';
    const sinFiltros = !hasActiveFilters(filtros);
    const chipsTipo = tipos.length > 1 ? tipos.map(t => chipHTML(filtros.tipo === t, 'ftype:' + escapeHTML(t), ETIQUETAS_TIPO[t] || t)).join('') : '';
    const chipsPais = codigosPais.map(c => chipHTML(filtros.pais === c, 'filter:' + escapeHTML(c), getCountryLabel(c))).join('');
    const chipsGenero = generos.slice(0, MAXIMO_CHIPS_GENERO).map(g => chipHTML(filtros.genero === g, 'fgenre:' + escapeHTML(g), g)).join('');
    return `<div class="chips"><button class="chip ${sinFiltros ? 'on' : ''}" data-act="filterreset">Todo</button>${chipsTipo}${chipsPais}${chipsGenero}</div>`;
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
    const imagenFondo = cssUrl(primero.background || primero.poster);
    const subtitulo = [(primero.genres || []).slice(0, 2).join(' · '), addon.manifest.name].filter(Boolean).join(' · ');
    // La imagen viaja como variable CSS: style.css la usa en las dos capas (ambiente y arte).
    const variableImagen = imagenFondo ? ` style="--imagen:${escapeHTML(imagenFondo)}"` : '';
    return `<button class="hero ${toneClass(primero.name)}" data-act="open" data-k="${escapeHTML(clave)}"${variableImagen}>
      <span class="hero-ambiente"></span><span class="hero-arte"></span>
      <span class="hero-texto"><span class="badge">Destacado${pais ? ' · ' + escapeHTML(pais) : ''}</span>
      <span class="hero-titulo">${escapeHTML(primero.name)}</span><span class="herosub">${escapeHTML(subtitulo)}</span>
      <span class="hero-acciones"><span class="playfab">${ICONOS.play}Ver ahora</span></span></span></button>`;
  }

  function continueWatchingHTML() {
    const recientes = continueWatching(estado.historial);
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
        encabezado = `<div class="grupo"><span>${escapeHTML(ETIQUETAS_GRUPO[idAddon] || fila.addon.manifest.name)}</span></div>`;
      }
      return encabezado + catalogSectionHTML(fila);
    }).join('');
  }

  function noCatalogsHTML() {
    const motivo = estado.filasConError ? 'Los addons no respondieron.' : 'Tus addons activos no ofrecen catálogos.';
    return `<div class="empty"><h3>Sin catálogos</h3><p>${motivo} Revisa que estén activos y que el servidor esté encendido.</p><div class="fila-acciones"><button class="btn" data-act="refresh">Reintentar</button><button class="btn out" data-act="tab:addons">Ver addons</button></div></div>`;
  }

  function homeBody() {
    const contenedor = $('#homeBody');
    if (!contenedor) return;
    if (!estado.addons.length) { contenedor.innerHTML = emptyAddonsHTML(); return; }
    if (estado.busquedaAbierta && estado.consulta.trim()) { contenedor.innerHTML = searchHTML(); return; }
    if (estado.cargando && !estado.filas) { contenedor.innerHTML = skeletonHomeHTML('Cargando'); return; }
    const filas = estado.filas || [];
    if (!filas.length) { contenedor.innerHTML = noCatalogsHTML(); return; }
    const opciones = collectFilterOptions(filas);
    estado.filtros = resetStaleFilters(estado.filtros, opciones);
    const visibles = applyFilters(filas, estado.filtros);
    const avisoErrores = estado.filasConError ? `<p class="hint con-margen">${estado.filasConError} catálogo(s) no respondieron.</p>` : '';
    contenedor.innerHTML = filterChipsHTML(opciones, estado.filtros) + heroHTML(visibles) + continueWatchingHTML() + catalogSectionsHTML(visibles) + avisoErrores;
  }

  // ============================================================
  // CARGA DE CATÁLOGOS Y BÚSQUEDA
  // ============================================================

  // Si se pide cargar otra vez (recargar addons, cambiar de perfil) mientras una carga sigue en
  // curso, la respuesta vieja puede llegar después de la nueva y pisarla. El número de
  // secuencia descarta esas respuestas tardías.
  let secuenciaCarga = 0;

  async function loadHome() {
    const secuencia = ++secuenciaCarga;
    estado.cargando = true;
    estado.filasConError = 0;
    if (estado.pestana === 'home') homeBody();
    const { filas, errores } = await loadCatalogs();
    if (secuencia !== secuenciaCarga) return;
    estado.filas = filas;
    estado.filasConError = errores;
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
    const resultados = await searchCatalogs(consulta);
    if (secuencia !== secuenciaBusqueda) return;
    estado.filasBusqueda = resultados;
    estado.buscando = false;
    homeBody();
  }

  Telon.ui.home = { homeHTML, homeBody, loadHome, runSearch };
})(window.Telon = window.Telon || {});
