/*
Telón - Ficha de serie
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Muestra la ficha de una serie o película: datos, botón de reproducir o continuar,
guardar en la lista y la grilla de episodios por temporada.
*/
(function (Telon) {
  'use strict';

  const { $, escapeHTML, toneClass, cssUrl } = Telon.ui.dom;
  const { getCountryCode } = Telon.domain.countries;
  const { episodeLabel, episodeNumber, listSeasons, episodesInSeason } = Telon.domain.episodes;
  const { estado, refKey, isInLibrary, toggleLibrary } = Telon.app.state;
  const { prepareTitle, fetchFullMeta, warmUpSources } = Telon.app.catalogService;
  const { toast, spinnerHTML } = Telon.ui.components;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CARGA
  // ============================================================

  // Pinta enseguida con lo que ya sabemos (nombre y póster de la tarjeta) y completa al llegar la ficha.
  async function openDetail(referencia) {
    prepareTitle(referencia);
    estado.detalle = { referencia, cargando: true, ficha: null, episodios: [] };
    estado.temporadaDetalle = null;
    $('#detail').hidden = false;
    renderDetail();
    const { ficha, episodios, aviso } = await fetchFullMeta(referencia);
    // El usuario pudo cerrar o abrir otra ficha mientras esperábamos; esta respuesta ya no aplica.
    if (!estado.detalle || estado.detalle.referencia !== referencia) return;
    estado.detalle = { referencia, cargando: false, ficha, episodios, aviso };
    renderDetail();
    warmUpSources(referencia, ficha);
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
    const ficha = detalle.ficha || detalle.referencia, fondo = cssUrl(ficha.background || ficha.poster);
    contenedor.innerHTML = `<div class="dhero ${toneClass(ficha.name)}"${fondo ? ` style="--imagen:${escapeHTML(fondo)}"` : ''}><button class="iconbtn" data-act="closedetail" aria-label="Volver">${ICONOS.back}</button></div>
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

  function toggleLib(referencia) {
    const guardada = toggleLibrary(referencia, (estado.detalle && estado.detalle.ficha) || {});
    toast(guardada ? 'Guardado en tu lista' : 'Quitado de tu lista');
  }

  Telon.ui.detail = { openDetail, renderDetail, closeDetail, toggleLib };
})(window.Telon = window.Telon || {});
