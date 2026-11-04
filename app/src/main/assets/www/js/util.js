/*
Telón - Utilidades compartidas
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Piezas pequeñas sin dependencias que usa toda la app: escapar HTML, guardar en
localStorage, colores e iniciales para las tarjetas sin imagen y el registro de
errores que decidimos no mostrar al usuario.
*/
(function (Telon) {
  'use strict';

  // ============================================================
  // CONSTANTES
  // ============================================================

  // Colores de respaldo para pósters sin imagen: cada serie siempre cae en el mismo.
  const COLORES = ['#7B61FF', '#E8364F', '#2563EB', '#D946EF', '#0D9488', '#EA580C'];
  const COLORES_PERFIL = ['#B23A48', '#2F6DB5', '#2E8B6A', '#9B59B6', '#E67E22', '#1ABC9C'];
  const PREFIJO_ALMACEN = 'telon.';
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

  // ============================================================
  // ERRORES QUE NO INTERRUMPEN AL USUARIO
  // ============================================================

  // Hay fallos esperables (un addon caído, un subtítulo que no baja) en los que lo correcto es
  // seguir con lo que hay. No los tragamos en silencio: quedan en la consola para depurar.
  function logIgnored(contexto, error) {
    console.warn('[Telón] ' + contexto, error);
  }

  // ============================================================
  // ALMACENAMIENTO LOCAL
  // ============================================================

  const store = {
    get(clave, porDefecto) {
      try {
        const valor = localStorage.getItem(PREFIJO_ALMACEN + clave);
        return valor ? JSON.parse(valor) : porDefecto;
      } catch (error) {
        logIgnored('No se pudo leer ' + clave + ' del almacenamiento', error);
        return porDefecto;
      }
    },
    set(clave, valor) {
      try {
        localStorage.setItem(PREFIJO_ALMACEN + clave, JSON.stringify(valor));
      } catch (error) {
        // Si localStorage se llena, perdemos este guardado pero la app sigue viva.
        logIgnored('No se pudo guardar ' + clave, error);
      }
    }
  };

  Telon.util = { COLORES, COLORES_PERFIL, $, escapeHTML, colorFor, toInitials, logIgnored, store };
})(window.Telon = window.Telon || {});
