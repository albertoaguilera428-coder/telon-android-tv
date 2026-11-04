/*
Telón - Pantalla de biblioteca
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Mi lista (lo guardado) e historial (lo visto, para retomarlo donde quedó).
*/
(function (Telon) {
  'use strict';

  const { escapeHTML } = Telon.ui.dom;
  const { progressPercent, sortByRecent } = Telon.domain.progress;
  const { estado } = Telon.app.state;
  const { registerCard, posterHTML } = Telon.ui.components;

  // ============================================================
  // MI LISTA E HISTORIAL
  // ============================================================

  function savedListHTML() {
    if (!estado.biblioteca.length) return `<div class="empty"><h3>Tu lista está vacía</h3><p>Abre una serie y toca «Guardar» para tenerla aquí.</p></div>`;
    const tarjetas = estado.biblioteca.slice().reverse().map(item => {
      const clave = registerCard(item);
      return `<button class="card" data-act="open" data-k="${escapeHTML(clave)}">${posterHTML(item)}<span class="cname">${escapeHTML(item.name)}</span></button>`;
    }).join('');
    return `<div class="grid3">${tarjetas}</div>`;
  }

  function historyListHTML() {
    const entradas = sortByRecent(estado.historial);
    if (!entradas.length) return `<div class="empty"><h3>Sin historial</h3><p>Lo que veas aparecerá aquí para retomarlo.</p></div>`;
    const filas = entradas.map(e => `<button class="hrow" data-act="resume" data-k="${escapeHTML(e.key)}">${posterHTML({ name: e.name, poster: e.poster })}<div class="itext"><b>${escapeHTML(e.name)}</b><span>${escapeHTML(e.label || '')}</span><div class="prog"><i style="width:${progressPercent(e)}%"></i></div></div></button>`).join('');
    return `<div class="list con-aire">${filas}</div>`;
  }

  // ============================================================
  // PANTALLA
  // ============================================================

  function libHTML() {
    const enLista = estado.pestanaBiblioteca === 'list';
    return `<div class="head"><h1>Biblioteca</h1></div>
    <div class="tabs"><button class="${enLista ? 'on' : ''}" data-act="libtab:list">Mi lista</button><button class="${estado.pestanaBiblioteca === 'hist' ? 'on' : ''}" data-act="libtab:hist">Historial</button></div>
    <main class="scroll">${enLista ? savedListHTML() : historyListHTML()}</main>`;
  }

  Telon.ui.libraryScreen = { libHTML };
})(window.Telon = window.Telon || {});
