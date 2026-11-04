/*
Telón - Piezas de interfaz reutilizables
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Tarjetas, pósters, avatares, avisos y etiquetas que aparecen en varias pantallas.
Todo devuelve HTML como texto; quien lo usa decide dónde pintarlo.
*/
(function (Telon) {
  'use strict';

  const { $, escapeHTML, colorFor } = Telon.util;
  const { getCountryCode } = Telon.addonClient;
  const { refKey } = Telon.state;

  // ============================================================
  // AVISOS EMERGENTES (TOAST)
  // ============================================================

  const DURACION_TOAST_MS = 3200;
  let temporizadorToast;

  function toast(mensaje) {
    const contenedor = $('#toast');
    contenedor.innerHTML = `<div>${escapeHTML(mensaje)}</div>`;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { contenedor.innerHTML = ''; }, DURACION_TOAST_MS);
  }

  // ============================================================
  // TARJETAS Y PÓSTERS
  // ============================================================

  // Los botones solo llevan la clave en data-k; aquí queda el objeto completo para abrirlo al hacer clic.
  const indiceTarjetas = {};

  function registerCard(referencia) {
    const clave = refKey(referencia);
    indiceTarjetas[clave] = referencia;
    return clave;
  }

  const findCard = clave => indiceTarjetas[clave];

  const spinnerHTML = etiqueta => `<div class="spin" role="progressbar" aria-label="${etiqueta}"></div>`;

  function posterHTML(ficha, extra = '') {
    const imagen = ficha.poster ? `<img loading="lazy" src="${escapeHTML(ficha.poster)}" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()">` : '';
    const pais = getCountryCode(ficha);
    const etiquetaPais = pais ? `<span class="tag">${escapeHTML(pais)}</span>` : '';
    return `<div class="poster ${ficha.poster ? '' : 'noimg'}" style="background:${colorFor(ficha.name)}">${imagen}${etiquetaPais}<span class="ptitle">${escapeHTML(ficha.name)}</span>${extra}</div>`;
  }

  function cardHTML(addon, tipo, ficha, extra = '', claseExtra = '') {
    const clave = registerCard({ base: addon.base, type: ficha.type || tipo, id: ficha.id, name: ficha.name, poster: ficha.poster, country: getCountryCode(ficha), description: ficha.description });
    const datos = [(ficha.genres || [])[0], ficha.releaseInfo || ficha.year].filter(Boolean).join(' · ');
    return `<button class="card ${claseExtra}" data-act="open" data-k="${escapeHTML(clave)}">${posterHTML(ficha, extra)}<span class="cname">${escapeHTML(ficha.name)}</span>${datos ? `<span class="cmeta">${escapeHTML(datos)}</span>` : ''}</button>`;
  }

  // Barra de progreso para "Continuar viendo" y el historial.
  function progressPercent(entrada) {
    return entrada.dur ? Math.min(100, Math.round(entrada.t / entrada.dur * 100)) : 0;
  }

  function emptyAddonsHTML() {
    return `<div class="empty"><h3>Todavía no tienes addons</h3><p>Telón no trae contenido propio: lo traen tus addons. Pega el enlace del <b>manifest.json</b> de uno para ver sus series aquí.</p><button class="btn" data-act="tab:addons">Añadir un addon</button></div>`;
  }

  // ============================================================
  // PERFILES
  // ============================================================

  const initialOf = perfil => escapeHTML(perfil.name[0].toUpperCase());

  function pfAvatarHTML(perfil, tamano) {
    const lado = tamano || 96;
    if (perfil.image) return `<span class="pf-avatar" style="background:${escapeHTML(perfil.color)}"><img src="${escapeHTML(perfil.image)}" style="width:${lado}px;height:${lado}px;border-radius:12px;object-fit:cover" onerror="this.remove()"></span>`;
    return `<span class="pf-avatar" style="background:${escapeHTML(perfil.color)}">${initialOf(perfil)}</span>`;
  }

  function miniAvatarHTML(perfil) {
    if (!perfil) return '';
    if (perfil.image) return `<button class="pf-mini" data-act="showprofiles" style="background:${escapeHTML(perfil.color)};padding:0;overflow:hidden"><img src="${escapeHTML(perfil.image)}" style="width:32px;height:32px;border-radius:16px;object-fit:cover" onerror="this.parentNode.textContent='${initialOf(perfil)}'"></button>`;
    return `<button class="pf-mini" data-act="showprofiles" style="background:${escapeHTML(perfil.color)}">${initialOf(perfil)}</button>`;
  }

  // ============================================================
  // EPISODIOS Y TEMPORADAS
  // ============================================================

  // Las películas no llevan "Ep. 1": solo etiquetamos cuando hay más de un episodio.
  function episodeLabel(episodios, i) {
    const episodio = episodios[i];
    if (!episodio || episodios.length < 2) return '';
    return 'Ep. ' + episodeNumber(episodio, i);
  }

  const episodeNumber = (episodio, i) => episodio.episode != null ? episodio.episode : i + 1;
  const seasonOf = episodio => episodio.season != null ? episodio.season : 1;
  const listSeasons = episodios => [...new Set(episodios.map(seasonOf))].sort((a, b) => a - b);
  const episodesInSeason = (episodios, temporada) => episodios.map((episodio, i) => ({ episodio, i })).filter(x => seasonOf(x.episodio) === temporada);

  Telon.ui = Telon.ui || {};
  Telon.ui.components = { toast, registerCard, findCard, spinnerHTML, posterHTML, cardHTML, progressPercent, emptyAddonsHTML,
    pfAvatarHTML, miniAvatarHTML, episodeLabel, episodeNumber, seasonOf, listSeasons, episodesInSeason };
})(window.Telon = window.Telon || {});
