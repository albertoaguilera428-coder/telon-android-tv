/*
Telón - Ficha de serie
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Muestra la ficha de una serie o película: datos, botón de reproducir o continuar,
guardar en la lista y la grilla de episodios por temporada.
*/
(function (Telon) {
  'use strict';

  const { $, escapeHTML, colorFor, logIgnored } = Telon.util;
  const { getJSON, buildAddonUrl, getCountryCode, buildEpisodeList } = Telon.addonClient;
  const { estado, refKey, findAddon, saveLib, isInLibrary } = Telon.state;
  const { toast, spinnerHTML, episodeLabel, episodeNumber, listSeasons, episodesInSeason } = Telon.ui.components;
  const sololatino = Telon.sololatino;
  const ICONOS = Telon.ICONOS;

  // ============================================================
  // CARGA
  // ============================================================

  // Pinta enseguida con lo que ya sabemos (nombre y póster de la tarjeta) y completa al llegar la ficha.
  async function openDetail(referencia) {
    sololatino.seedKnownSlug(referencia);
    estado.detalle = { referencia, cargando: true, ficha: null, episodios: [] };
    estado.temporadaDetalle = null;
    $('#detail').hidden = false;
    renderDetail();
    const addon = findAddon(referencia.base);
    let ficha = { id: referencia.id, type: referencia.type, name: referencia.name, poster: referencia.poster, description: referencia.description };
    let aviso = '';
    if (addon) {
      try {
        const respuesta = await getJSON(buildAddonUrl(addon, 'meta', referencia.type, referencia.id));
        if (respuesta && respuesta.meta) ficha = { ...ficha, ...respuesta.meta };
      } catch (error) {
        aviso = 'No se pudo cargar la ficha completa (' + error.message + ').';
      }
    }
    // El usuario pudo cerrar o abrir otra ficha mientras esperábamos; esta respuesta ya no aplica.
    if (!estado.detalle || estado.detalle.referencia !== referencia) return;
    estado.detalle = { referencia, cargando: false, ficha, episodios: buildEpisodeList(ficha), aviso };
    renderDetail();
    sololatino.warmUpSlugForImdb(referencia, ficha).catch(error => logIgnored('SoloLatino: no se pudo preparar el slug', error));
  }

  // ============================================================
  // PINTADO
  // ============================================================

  function episodesHTML(detalle, entradaHistorial) {
    if (detalle.episodios.length <= 1) return '';
    const temporadas = listSeasons(detalle.episodios);
    const temporadaElegida = estado.temporadaDetalle != null ? estado.temporadaDetalle : temporadas[0];
    const chipsTemporada = temporadas.length > 1
      ? `<div class="season-chips">${temporadas.map(t => `<button class="chip${t === temporadaElegida ? ' on' : ''}" data-act="season:${t}">${t === 0 ? 'Especiales' : 'Temporada ' + t}</button>`).join('')}</div>`
      : '';
    const botones = episodesInSeason(detalle.episodios, temporadaElegida).map(({ episodio, i }) => {
      const numero = escapeHTML(episodeNumber(episodio, i));
      return `<button class="ep ${entradaHistorial && entradaHistorial.idx === i ? 'seen' : ''}" data-act="play:${i}" aria-label="Episodio ${numero}">${numero}</button>`;
    }).join('');
    return `<h3 style="font-size:18px;font-weight:500">Episodios</h3>${chipsTemporada}<div class="eps">${botones}</div>`;
  }

  function detailBodyHTML(detalle, ficha) {
    if (detalle.cargando) return spinnerHTML('Cargando');
    const entradaHistorial = estado.historial[refKey(detalle.referencia)];
    const actual = entradaHistorial ? Math.min(entradaHistorial.idx, detalle.episodios.length - 1) : 0;
    const pastillas = [getCountryCode(ficha), ...(ficha.genres || []).slice(0, 3), ficha.releaseInfo || ficha.year,
      detalle.episodios.length > 1 ? detalle.episodios.length + ' episodios' : ''].filter(Boolean);
    const textoReproducir = entradaHistorial && entradaHistorial.t > 1 ? 'Continuar ' + escapeHTML(episodeLabel(detalle.episodios, actual)) : 'Reproducir';
    return `${pastillas.length ? `<div class="pills">${pastillas.map(p => `<i>${escapeHTML(p)}</i>`).join('')}</div>` : ''}
      ${ficha.description ? `<p class="desc">${escapeHTML(ficha.description)}</p>` : ''}
      ${detalle.aviso ? `<p class="err">${escapeHTML(detalle.aviso)}</p>` : ''}
      <div class="actions"><button class="btn" data-act="play:${actual}">${textoReproducir}</button>
      <button class="btn out" data-act="savelib">${isInLibrary(detalle.referencia) ? 'Guardado' : 'Guardar'}</button></div>
      ${episodesHTML(detalle, entradaHistorial)}`;
  }

  function renderDetail() {
    const detalle = estado.detalle, contenedor = $('#detail');
    if (!detalle) { contenedor.hidden = true; contenedor.innerHTML = ''; return; }
    const ficha = detalle.ficha || detalle.referencia, fondo = ficha.background || ficha.poster;
    contenedor.innerHTML = `<div class="dhero" style="background-color:${colorFor(ficha.name)};${fondo ? `background-image:url('${escapeHTML(fondo)}')` : ''}"><button class="iconbtn" data-act="closedetail" aria-label="Volver">${ICONOS.back}</button></div>
    <div class="dbody"><h1>${escapeHTML(ficha.name)}</h1>${detailBodyHTML(detalle, ficha)}</div>`;
  }

  function closeDetail() {
    estado.detalle = null;
    $('#detail').hidden = true;
    $('#detail').innerHTML = '';
  }

  // ============================================================
  // MI LISTA
  // ============================================================

  // Guardamos con el nombre y póster de la ficha completa si ya llegó; son mejores que los de la tarjeta.
  function toggleLib(referencia) {
    const clave = refKey(referencia);
    const indice = estado.biblioteca.findIndex(x => refKey(x) === clave);
    if (indice >= 0) {
      estado.biblioteca.splice(indice, 1);
      toast('Quitado de tu lista');
    } else {
      const ficha = (estado.detalle && estado.detalle.ficha) || {};
      estado.biblioteca.push({ base: referencia.base, type: referencia.type, id: referencia.id, name: ficha.name || referencia.name, poster: ficha.poster || referencia.poster, country: referencia.country });
      toast('Guardado en tu lista');
    }
    saveLib();
  }

  Telon.ui.detail = { openDetail, renderDetail, closeDetail, toggleLib };
})(window.Telon = window.Telon || {});
