/*
Telón - Dominio: catálogos y filtros
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Qué filtros se ofrecen según lo que trajeron los addons, cómo se aplican y qué catálogos
se pueden mostrar o buscar. Lógica pura: recibe datos y devuelve datos.
*/
'use strict';

import { getCountryCode } from './countries.js';

// ============================================================
// CONSTANTES
// ============================================================

const TODOS = 'all';
const FILTROS_VACIOS = { pais: TODOS, tipo: TODOS, genero: TODOS };

// ============================================================
// CATÁLOGOS
// ============================================================

// Los catálogos que exigen un parámetro (género, búsqueda…) no se pueden mostrar sin él.
const needsExtra = catalogo => Boolean((catalogo.extra || []).some(e => e.isRequired) || (catalogo.extraRequired || []).length);
const supportsSearch = catalogo => (catalogo.extra || []).some(e => e.name === 'search') || (catalogo.extraSupported || []).includes('search');
const keepValidMetas = metas => (metas || []).filter(m => m && m.id && m.name);
// Un recurso del manifest puede ser un texto ("stream") o un objeto ({ name: "stream", … }).
const listResourceNames = manifest => [...new Set((manifest.resources || []).map(r => typeof r === 'string' ? r : r.name))];

// ============================================================
// FILTROS
// ============================================================

const unique = lista => [...new Set(lista.filter(Boolean))];

function collectFilterOptions(filas) {
  return {
    codigosPais: unique(filas.flatMap(f => f.metas.map(getCountryCode))),
    generos: unique(filas.flatMap(f => f.metas.flatMap(m => m.genres || []))).sort(),
    tipos: unique(filas.map(f => f.cat.type))
  };
}

// Si al recargar ya no existe la opción elegida (otro addon, otro catálogo), vuelve a "Todo".
function resetStaleFilters(filtros, { codigosPais, generos, tipos }) {
  return {
    pais: filtros.pais !== TODOS && !codigosPais.includes(filtros.pais) ? TODOS : filtros.pais,
    genero: filtros.genero !== TODOS && !generos.includes(filtros.genero) ? TODOS : filtros.genero,
    tipo: filtros.tipo !== TODOS && !tipos.includes(filtros.tipo) ? TODOS : filtros.tipo
  };
}

function applyFilters(filas, filtros) {
  const pasaFiltros = m => (filtros.pais === TODOS || getCountryCode(m) === filtros.pais)
    && (filtros.genero === TODOS || (m.genres || []).includes(filtros.genero));
  return filas
    .map(f => ({ ...f, metas: f.metas.filter(pasaFiltros) }))
    .filter(f => f.metas.length && (filtros.tipo === TODOS || f.cat.type === filtros.tipo));
}

const hasActiveFilters = filtros => filtros.pais !== TODOS || filtros.tipo !== TODOS || filtros.genero !== TODOS;
// Tocar el chip activo lo apaga; tocar otro lo cambia.
const toggleFilterValue = (actual, valor) => actual === valor ? TODOS : valor;

export { FILTROS_VACIOS, needsExtra, supportsSearch, keepValidMetas, listResourceNames, collectFilterOptions, resetStaleFilters, applyFilters, hasActiveFilters, toggleFilterValue };
