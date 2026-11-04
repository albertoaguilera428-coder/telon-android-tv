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
  const { estado, updateState, refKey, isInLibrary, toggleLibrary } = Telon.app.state;
  const { prepareTitle, fetchFullMeta, warmUpSources } = Telon.app.catalogService;
  const { toast, skeletonDetailHTML, posterHTML } = Telon.ui.components;
  const ICONOS = Telon.ui.ICONOS;

  // ============================================================
  // CARGA
  // ============================================================

  // Pinta enseguida con lo que ya sabemos (nombre y póster de la tarjeta) y completa al llegar la ficha.
  async function openDetail(referencia) {
    prepareTitle(referencia);
    // Cada cambio de estado.detalle repinta la ficha (main.js está suscrito).
    updateState({ detalle: { referencia, cargando: true, ficha: null, episodios: [] }, temporadaDetalle: null });
    const { ficha, episodios, aviso } = await fetchFullMeta(referencia);
    // El usuario pudo cerrar o abrir otra ficha mientras esperábamos; esta respuesta ya no aplica.
    if (!estado.detalle || estado.detalle.referencia !== referencia) return;
    updateState({ detalle: { referencia, cargando: false, ficha, episodios, aviso } });
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
    return `<section class="d-episodios"><h3 class="subtitulo">Episodios</h3>${chipsTemporada}<div class="eps">${botones}</div></section>`;
  }

  function detailBodyHTML(detalle, ficha) {
    if (detalle.cargando) return skeletonDetailHTML();
    const entradaHistorial = estado.historial[refKey(detalle.referencia)];
    const actual = entradaHistorial ? Math.min(entradaHistorial.idx, detalle.episodios.length - 1) : 0;
    const pastillas = [getCountryCode(ficha), ...(ficha.genres || []).slice(0, 3), ficha.releaseInfo || ficha.year,
      detalle.episodios.length > 1 ? detalle.episodios.length + ' episodios' : ''].filter(Boolean);
    const textoReproducir = entradaHistorial && entradaHistorial.t > 1 ? 'Continuar ' + escapeHTML(episodeLabel(detalle.episodios, actual)) : 'Reproducir';
    return `${pastillas.length ? `<div class="pills">${pastillas.map(p => `<i>${escapeHTML(p)}</i>`).join('')}</div>` : ''}
      ${ficha.description ? `<p class="desc">${escapeHTML(ficha.description)}</p>` : ''}
      ${detalle.aviso ? `<p class="err">${escapeHTML(detalle.aviso)}</p>` : ''}
      <div class="actions"><button class="btn" data-act="play:${actual}">${ICONOS.play}${textoReproducir}</button>
      <button class="btn out" data-act="savelib">${isInLibrary(detalle.referencia) ? ICONOS.saveOn + 'Guardado' : ICONOS.save + 'Guardar'}</button></div>
      ${episodesHTML(detalle, entradaHistorial)}`;
  }

  // Encabezado: ambiente de color con el póster desenfocado detrás; el póster nítido y el título
  // van en el cuerpo (en TV, póster a la izquierda e información a la derecha).
  function renderDetail() {
    const detalle = estado.detalle, contenedor = $('#detail');
    if (!detalle) { contenedor.hidden = true; contenedor.innerHTML = ''; return; }
    contenedor.hidden = false;
    const ficha = detalle.ficha || detalle.referencia, fondo = cssUrl(ficha.background || ficha.poster);
    const variableImagen = fondo ? ` style="--imagen:${escapeHTML(fondo)}"` : '';
    contenedor.innerHTML = `<div class="dhero ${toneClass(ficha.name)}"${variableImagen}><span class="hero-ambiente"></span><span class="hero-arte"></span><button class="iconbtn" data-act="closedetail" aria-label="Volver">${ICONOS.back}</button></div>
    <div class="dbody"><div class="d-cabecera"><div class="d-poster">${posterHTML(ficha)}</div><div class="d-info"><h1>${escapeHTML(ficha.name)}</h1>${detailBodyHTML(detalle, ficha)}</div></div></div>`;
  }

  function closeDetail() {
    updateState({ detalle: null });
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
