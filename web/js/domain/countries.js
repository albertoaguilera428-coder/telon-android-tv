/*
Telón - Dominio: países
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Cada addon escribe el país a su manera ("Korea", "KR", ["Corea"]). Aquí se normaliza a un
código para el filtro y la etiqueta del póster. Lógica pura: sin DOM, red ni almacenamiento.
*/
'use strict';

// ============================================================
// CONSTANTES
// ============================================================

const ETIQUETAS_PAIS = { CN: 'China', US: 'EEUU', KR: 'Corea', JP: 'Japón', ES: 'España', MX: 'México',
  CO: 'Colombia', AR: 'Argentina', TH: 'Tailandia', TW: 'Taiwán', IN: 'India', UK: 'UK', GB: 'UK',
  DE: 'Alemania', FR: 'Francia', IT: 'Italia', BR: 'Brasil', CA: 'Canadá', AU: 'Australia', AT: 'Austria',
  RU: 'Rusia', ID: 'Indonesia', PH: 'Filipinas', TR: 'Turquía', UA: 'Ucrania', CL: 'Chile', PE: 'Perú', HK: 'Hong Kong' };
// Si el addon ya manda un código de dos letras lo respetamos; GB se muestra como UK, igual que siempre.
const CODIGOS_EQUIVALENTES = { GB: 'UK' };
// Nombres en inglés y español. Cada patrón exige el nombre desde el inicio y, en los cortos,
// la palabra completa: así "Indonesia" no cae en India ni "Estonia" en España.
const ALIAS_PAIS = [
  [/^(CHINA|CHINO|CHINESE|MAINLAND CHINA)\b/, 'CN'],
  [/^(USA|EE\.? ?UU\.?|UNITED STATES|ESTADOS UNIDOS|AMERICAN)\b/, 'US'],
  [/^(KOREA|COREA|KOREAN|SOUTH KOREA)\b/, 'KR'],
  [/^(JAP[AÓO]N|JAPANESE)\b/, 'JP'],
  [/^(THAI|THAILAND|TAILANDIA)\b/, 'TH'],
  [/^TAIW[AÁ]N\b/, 'TW'],
  [/^(ESPA[ÑN]A|SPAIN|SPANISH)\b/, 'ES'],
  [/^(M[EÉ]XICO|MEXICAN)\b/, 'MX'],
  [/^(INDIA|INDIAN)\b/, 'IN'],
  [/^(UNITED KINGDOM|GREAT BRITAIN|REINO UNIDO|BRIT|ENGLAND|INGLATERRA)/, 'UK'],
  [/^(GERMANY|GERMAN|ALEMANIA)\b/, 'DE'],
  [/^(FRANCE|FRENCH|FRANCIA)\b/, 'FR'],
  [/^(ITALY|ITALIAN|ITALIA)\b/, 'IT'],
  [/^BRA[SZ]IL\b/, 'BR'],
  [/^CANAD[AÁ]\b/, 'CA'],
  [/^AUSTRALIA\b/, 'AU'],
  [/^AUSTRIA\b/, 'AT'],
  [/^(RUSSIA|RUSIA|RUSSIAN)\b/, 'RU'],
  [/^INDONESIA\b/, 'ID'],
  [/^(PHILIPPINES|FILIPINAS)\b/, 'PH'],
  [/^(TURKEY|TURQU[IÍ]A|T[UÜ]RKIYE)\b/, 'TR'],
  [/^(UKRAINE|UCRANIA)\b/, 'UA'],
  [/^(COLOMBIA)\b/, 'CO'],
  [/^(ARGENTINA)\b/, 'AR'],
  [/^CHILE\b/, 'CL'],
  [/^PER[UÚ]\b/, 'PE'],
  [/^HONG KONG\b/, 'HK']
];

// ============================================================
// REGLAS
// ============================================================

function getCountryCode(ficha) {
  let pais = ficha && (ficha.country || ficha.countries);
  if (Array.isArray(pais)) pais = pais[0];
  if (!pais) return '';
  const mayus = String(pais).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(mayus)) return CODIGOS_EQUIVALENTES[mayus] || mayus;
  const alias = ALIAS_PAIS.find(([patron]) => patron.test(mayus));
  // Último recurso para países que no conocemos: las dos primeras letras sirven para agrupar.
  return alias ? alias[1] : mayus.slice(0, 2);
}

const getCountryLabel = codigo => ETIQUETAS_PAIS[codigo] || codigo;


export { getCountryCode, getCountryLabel };
