/*
Telón - Ayudas de presentación
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Escapar HTML, buscar en el DOM y los colores e iniciales de las tarjetas sin imagen.
*/
(function (Telon) {
  'use strict';

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Colores de respaldo para pósters sin imagen: cada serie siempre cae en el mismo.
  const COLORES = ['#7B61FF', '#E8364F', '#2563EB', '#D946EF', '#0D9488', '#EA580C'];
  const COLORES_PERFIL = ['#B23A48', '#2F6DB5', '#2E8B6A', '#9B59B6', '#E67E22', '#1ABC9C'];
  const ENTIDADES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  // ============================================================
  // DOM Y TEXTO
  // ============================================================

  const $ = selector => document.querySelector(selector);

  // Todo texto que viene de un addon pasa por aquí antes de ir a innerHTML: los addons son
  // de terceros y no queremos que un título con <script> se ejecute en la app.
  const escapeHTML = valor => String(valor === null || valor === undefined ? '' : valor)
    .replace(/[&<>"']/g, caracter => ENTIDADES_HTML[caracter]);

  const colorFor = texto => {
    let hash = 0;
    for (const caracter of String(texto || '')) hash = (hash * 31 + caracter.charCodeAt(0)) | 0;
    return COLORES[Math.abs(hash) % COLORES.length];
  };

  const toInitials = texto => String(texto || '?').trim().split(/\s+/).slice(0, 2)
    .map(palabra => palabra[0]).join('').toUpperCase();

  Telon.ui = Telon.ui || {};
  Telon.ui.dom = { COLORES, COLORES_PERFIL, $, escapeHTML, colorFor, toInitials };
})(window.Telon = window.Telon || {});
