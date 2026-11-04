/*
Telón - Ayudas de presentación
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Escapar HTML, buscar en el DOM y los colores e iniciales de las tarjetas sin imagen.
*/
'use strict';

// ============================================================
// CONSTANTES
// ============================================================

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

// Índice de tono (0 a 5) para los degradados de pósters sin imagen: cada título cae siempre
// en el mismo, definido en style.css como .tono-N.
const CANTIDAD_TONOS = 6;
const toneFor = texto => {
  let hash = 0;
  for (const caracter of String(texto || '')) hash = (hash * 31 + caracter.charCodeAt(0)) | 0;
  return Math.abs(hash) % CANTIDAD_TONOS;
};
const toneClass = texto => 'tono-' + toneFor(texto);

const toInitials = texto => String(texto || '?').trim().split(/\s+/).slice(0, 2)
  .map(palabra => palabra[0]).join('').toUpperCase();

// ============================================================
// URLS Y COLORES QUE VIENEN DE AFUERA
// ============================================================

// Una URL de póster de un addon solo puede ser una imagen de verdad: nada de javascript:,
// file: ni texto armado para escapar del atributo.
const ESQUEMAS_IMAGEN = /^(https?:\/\/|data:image\/|blob:)/i;
const safeUrl = url => (typeof url === 'string' && ESQUEMAS_IMAGEN.test(url.trim()) ? url.trim() : '');

// Dentro de url(...) en CSS, comillas, paréntesis y espacios permitirían cerrar la función y
// agregar reglas propias. Se codifican como en una URL (%22, %28…), que el navegador entiende igual.
const encodeCssUrlChar = caracter => '%' + caracter.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
function cssUrl(url) {
  const segura = safeUrl(url);
  return segura ? 'url("' + segura.replace(/["'()\\\s<>]/g, encodeCssUrlChar) + '")' : '';
}

// Los colores de perfil se guardan en el dispositivo; igual se validan antes de ir a un style.
const safeColor = color => (/^#[0-9a-f]{3,8}$/i.test(String(color)) ? color : '#555555');

// ============================================================
// IMÁGENES ROTAS
// ============================================================

// En lugar de onerror="…" en el HTML (que una CSP estricta bloquea y que es un punto de
// inyección), cada <img> dice qué hacer si falla y un único listener lo aplica.
const RESPALDOS_IMAGEN = {
  // Póster sin imagen: queda el color de fondo con el título encima.
  noimg: imagen => { imagen.parentNode.classList.add('noimg'); imagen.remove(); },
  remove: imagen => imagen.remove(),
  // Avatar: se reemplaza por la inicial del perfil.
  initial: imagen => { imagen.parentNode.textContent = imagen.dataset.inicial || ''; }
};

function handleImageError(evento) {
  const imagen = evento.target;
  if (!imagen || imagen.tagName !== 'IMG' || !imagen.dataset.fallback || !imagen.parentNode) return;
  const respaldo = RESPALDOS_IMAGEN[imagen.dataset.fallback];
  if (respaldo) respaldo(imagen);
}

// Los errores de carga de imágenes no burbujean: hay que escucharlos en la fase de captura.
document.addEventListener('error', handleImageError, true);

export { COLORES_PERFIL, $, escapeHTML, toneFor, toneClass, toInitials, safeUrl, cssUrl, safeColor };
