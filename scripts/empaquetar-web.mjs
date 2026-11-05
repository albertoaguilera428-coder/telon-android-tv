/*
Telón - Empaquetado de la app web (Android y Samsung)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Junta los módulos de web/js en un solo telon.js y deja la app lista para copiar. Hace
falta porque el WebView de Android y el televisor Samsung cargan la app desde archivos
(file://), y ahí el navegador no deja cargar módulos ES. El código se rebaja para el
Chromium de Tizen 6.5 (televisores 2021), el más viejo que soportamos.

  node scripts/empaquetar-web.mjs <carpeta-de-salida>

Gradle lo corre antes de armar el APK (tarea empaquetarWeb) y build-tizen.mjs lo usa para
el .wgt. En desarrollo no hace falta: web/index.html carga js/main.js como módulo.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync, transformSync } from 'esbuild';

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'web');
// Tizen 6.5 (televisores 2021) trae Chromium 85: sin ?? asignado, inset ni aspect-ratio.
export const OBJETIVO = 'chrome85';
const ARCHIVOS_ESTATICOS = ['logo.webp'];
const CARPETAS_ESTATICAS = ['fonts'];
const ETIQUETA_MODULO = '<script type="module" src="js/main.js"></script>';
const ETIQUETA_PAQUETE = '<script src="telon.js"></script>';

// ============================================================
// PASOS
// ============================================================

// Un solo archivo sin minificar: si algo falla en la TV, el error se puede leer.
function bundleScripts(salida) {
  buildSync({
    entryPoints: [path.join(WEB, 'js', 'main.js')],
    outfile: path.join(salida, 'telon.js'),
    bundle: true,
    format: 'iife',
    target: OBJETIVO,
    legalComments: 'inline',
    logLevel: 'error'
  });
}

// El CSS también se rebaja: esbuild convierte inset (Chromium 87) en top/right/bottom/left.
function transpileStyles(salida) {
  const css = fs.readFileSync(path.join(WEB, 'style.css'), 'utf8');
  const { code } = transformSync(css, { loader: 'css', target: OBJETIVO, sourcefile: 'style.css', legalComments: 'inline' });
  fs.writeFileSync(path.join(salida, 'style.css'), code);
}

function writeIndex(salida) {
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  if (!html.includes(ETIQUETA_MODULO)) throw new Error('web/index.html ya no carga ' + ETIQUETA_MODULO + '; actualiza empaquetar-web.mjs');
  fs.writeFileSync(path.join(salida, 'index.html'), html.replace(ETIQUETA_MODULO, ETIQUETA_PAQUETE));
}

function copyStaticFiles(salida) {
  ARCHIVOS_ESTATICOS.forEach(archivo => fs.copyFileSync(path.join(WEB, archivo), path.join(salida, archivo)));
  CARPETAS_ESTATICAS.forEach(carpeta => fs.cpSync(path.join(WEB, carpeta), path.join(salida, carpeta), { recursive: true }));
}

// ============================================================
// PRINCIPAL
// ============================================================

export function packageWeb(salida) {
  fs.rmSync(salida, { recursive: true, force: true });
  fs.mkdirSync(salida, { recursive: true });
  bundleScripts(salida);
  transpileStyles(salida);
  writeIndex(salida);
  copyStaticFiles(salida);
  return salida;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const salida = process.argv[2];
  if (!salida) {
    console.error('Uso: node scripts/empaquetar-web.mjs <carpeta-de-salida>');
    process.exit(1);
  }
  packageWeb(path.resolve(salida));
  console.log(`App web empaquetada en ${path.relative(RAIZ, path.resolve(salida)) || salida} (objetivo ${OBJETIVO}).`);
}
