/*
Telón - Piezas de interfaz reutilizables
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Tarjetas, pósters, avatares, avisos y etiquetas que aparecen en varias pantallas.
Todo devuelve HTML como texto; quien lo usa decide dónde pintarlo.
*/
(function (Telon) {
  'use strict';

  const { $, escapeHTML, toneClass, safeUrl, safeColor } = Telon.ui.dom;
  const { getCountryCode } = Telon.domain.countries;
  const { refKey } = Telon.domain.progress;

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

  // Los botones solo llevan la clave en data-k; aquí queda el objeto completo para abrirlo al hacer
  // clic. Se vacía en cada pintado completo: antes guardaba todas las tarjetas vistas desde que se
  // abrió la app y solo crecía.
  const indiceTarjetas = new Map();

  function registerCard(referencia) {
    const clave = refKey(referencia);
    indiceTarjetas.set(clave, referencia);
    return clave;
  }

  const findCard = clave => indiceTarjetas.get(clave);
  const clearCards = () => indiceTarjetas.clear();
  const cardCount = () => indiceTarjetas.size;

  // Siluetas mientras carga: el usuario ve la forma de lo que viene en lugar de un círculo girando.
  const skeletonCardsHTML = (cantidad = 6) => Array.from({ length: cantidad }, () => '<span class="esqueleto-tarjeta"><span class="esqueleto esqueleto-poster"></span><span class="esqueleto esqueleto-linea"></span></span>').join('');
  const skeletonHomeHTML = etiqueta => `<div class="esqueletos" role="progressbar" aria-label="${etiqueta}"><span class="esqueleto esqueleto-hero"></span>${[1, 2].map(() => `<div class="section"><span class="esqueleto esqueleto-titulo"></span><div class="row">${skeletonCardsHTML()}</div></div>`).join('')}</div>`;
  const skeletonDetailHTML = () => '<div class="esqueletos" role="progressbar" aria-label="Cargando"><span class="esqueleto esqueleto-linea larga"></span><span class="esqueleto esqueleto-linea"></span><span class="esqueleto esqueleto-boton"></span></div>';

  const spinnerHTML = etiqueta => `<div class="spin" role="progressbar" aria-label="${etiqueta}"></div>`;

  function posterHTML(ficha, extra = '') {
    const poster = safeUrl(ficha.poster);
    const imagen = poster ? `<img loading="lazy" src="${escapeHTML(poster)}" alt="" data-fallback="noimg">` : '';
    const pais = getCountryCode(ficha);
    const etiquetaPais = pais ? `<span class="tag">${escapeHTML(pais)}</span>` : '';
    return `<div class="poster ${toneClass(ficha.name)}${poster ? '' : ' noimg'}">${imagen}${etiquetaPais}<span class="ptitle">${escapeHTML(ficha.name)}</span>${extra}</div>`;
  }

  function cardHTML(addon, tipo, ficha, extra = '', claseExtra = '') {
    const clave = registerCard({ base: addon.base, type: ficha.type || tipo, id: ficha.id, name: ficha.name, poster: ficha.poster, country: getCountryCode(ficha), description: ficha.description });
    const datos = [(ficha.genres || [])[0], ficha.releaseInfo || ficha.year].filter(Boolean).join(' · ');
    return `<button class="card ${claseExtra}" data-act="open" data-k="${escapeHTML(clave)}">${posterHTML(ficha, extra)}<span class="cname">${escapeHTML(ficha.name)}</span>${datos ? `<span class="cmeta">${escapeHTML(datos)}</span>` : ''}</button>`;
  }

  function emptyAddonsHTML() {
    return `<div class="empty"><h3>Todavía no tienes addons</h3><p>Telón no trae contenido propio: lo traen tus addons. Pega el enlace del <b>manifest.json</b> de uno para ver sus series aquí.</p><button class="btn" data-act="tab:addons">Añadir un addon</button></div>`;
  }

  // ============================================================
  // PERFILES
  // ============================================================

  const initialOf = perfil => escapeHTML(perfil.name[0].toUpperCase());

  function pfAvatarHTML(perfil) {
    const imagen = safeUrl(perfil.image), color = safeColor(perfil.color);
    if (imagen) return `<span class="pf-avatar" style="background:${color}"><img class="pf-foto" src="${escapeHTML(imagen)}" alt="" data-fallback="remove"></span>`;
    return `<span class="pf-avatar" style="background:${color}">${initialOf(perfil)}</span>`;
  }

  function miniAvatarHTML(perfil) {
    if (!perfil) return '';
    const imagen = safeUrl(perfil.image), color = safeColor(perfil.color);
    if (imagen) return `<button class="pf-mini" data-act="showprofiles" style="background:${color}"><img class="pf-foto" src="${escapeHTML(imagen)}" alt="" data-fallback="initial" data-inicial="${initialOf(perfil)}"></button>`;
    return `<button class="pf-mini" data-act="showprofiles" style="background:${color}">${initialOf(perfil)}</button>`;
  }

  Telon.ui = Telon.ui || {};
  Telon.ui.components = { toast, registerCard, findCard, clearCards, cardCount, spinnerHTML, skeletonHomeHTML, skeletonDetailHTML, posterHTML, cardHTML, emptyAddonsHTML, pfAvatarHTML, miniAvatarHTML };
})(window.Telon = window.Telon || {});
