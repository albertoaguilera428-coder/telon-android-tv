/*
Telón - Foto de perfil desde la galería
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

La foto se guarda en el dispositivo como data URL (Base64). Base64 es solo una forma de
escribir bytes como texto: no protege nada y además pesa un 33 % más. Una foto de celular
de 4 MB pasaba los 5 MB que admite localStorage y el guardado fallaba en silencio. Por eso
se recorta al centro y se reduce a 256 px en JPEG antes de guardarla (unos 20–40 KB).
*/
'use strict';

import { InvalidDataError } from '../infra/errors.js';

// ============================================================
// CONSTANTES
// ============================================================

const LADO_AVATAR_PX = 256;
const CALIDAD_JPEG = 0.85;

// ============================================================
// RECORTE
// ============================================================

// El cuadrado más grande centrado dentro de la imagen (como object-fit: cover).
function coverCrop(ancho, alto) {
  const lado = Math.min(ancho, alto);
  return { x: Math.round((ancho - lado) / 2), y: Math.round((alto - lado) / 2), lado };
}

function loadImage(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => { URL.revokeObjectURL(url); resolver(imagen); };
    imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new InvalidDataError('el archivo no es una imagen que se pueda abrir')); };
    imagen.src = url;
  });
}

async function resizeToAvatar(archivo) {
  const imagen = await loadImage(archivo);
  const recorte = coverCrop(imagen.naturalWidth, imagen.naturalHeight);
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO_AVATAR_PX;
  lienzo.height = LADO_AVATAR_PX;
  lienzo.getContext('2d').drawImage(imagen, recorte.x, recorte.y, recorte.lado, recorte.lado, 0, 0, LADO_AVATAR_PX, LADO_AVATAR_PX);
  return lienzo.toDataURL('image/jpeg', CALIDAD_JPEG);
}

export { coverCrop, resizeToAvatar };
