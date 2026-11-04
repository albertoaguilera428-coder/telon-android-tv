/*
Telón - Empaquetado para televisores Samsung (.wgt)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Toma la misma app web del APK, rebaja la sintaxis de JavaScript para el Chromium de
Tizen 5.5 y la deja lista en build/tizen. Si Tizen Studio está instalado y existe un
perfil de certificados, además firma y genera build/Telon.wgt:

  TIZEN_PROFILE=MiPerfil npm run build:tizen

Sin perfil queda build/Telon-sin-firmar.wgt, útil para revisar el contenido; la TV
solo instala paquetes firmados con un certificado de distribuidor de Samsung.
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(RAIZ, 'app', 'src', 'main', 'assets', 'www');
const SALIDA = path.join(RAIZ, 'build', 'tizen');
const ICONO = path.join(RAIZ, 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png');
// Tizen 5.5 (televisores 2020) trae Chromium 69: sin ?. ni ?? ni otras novedades.
const OBJETIVO_JS = 'chrome69';
const ARCHIVOS_ESTATICOS = ['index.html', 'logo.webp'];
const CARPETAS_ESTATICAS = ['fonts'];

// ============================================================
// PASOS
// ============================================================

function cleanOutput() {
  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(SALIDA, { recursive: true });
}

function listScripts(html) {
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}

// Cada módulo se transforma por separado (sin empaquetar en uno): así el orden y los nombres
// de archivo siguen siendo los de index.html y los errores en la TV apuntan al módulo correcto.
function transpileScript(rutaRelativa) {
  const codigo = fs.readFileSync(path.join(WWW, rutaRelativa), 'utf8');
  const { code } = transformSync(codigo, { loader: 'js', target: OBJETIVO_JS, sourcefile: rutaRelativa, legalComments: 'inline' });
  const destino = path.join(SALIDA, rutaRelativa);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, code);
}

// El CSS también se rebaja: esbuild convierte inset en top/right/bottom/left y otras propiedades
// que Chromium 69 no entiende. No puede inventar gap en flexbox (Chromium 84): eso se ve en README.
function transpileStyles() {
  const css = fs.readFileSync(path.join(WWW, 'style.css'), 'utf8');
  const { code } = transformSync(css, { loader: 'css', target: OBJETIVO_JS, sourcefile: 'style.css', legalComments: 'inline' });
  fs.writeFileSync(path.join(SALIDA, 'style.css'), code);
}

function copyStaticFiles() {
  ARCHIVOS_ESTATICOS.forEach(archivo => fs.copyFileSync(path.join(WWW, archivo), path.join(SALIDA, archivo)));
  CARPETAS_ESTATICAS.forEach(carpeta => fs.cpSync(path.join(WWW, carpeta), path.join(SALIDA, carpeta), { recursive: true }));
  fs.copyFileSync(path.join(RAIZ, 'tizen', 'config.xml'), path.join(SALIDA, 'config.xml'));
  fs.copyFileSync(ICONO, path.join(SALIDA, 'icon.png'));
}

function commandExists(comando) {
  try {
    execFileSync(comando, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function packageSigned(perfil) {
  execFileSync('tizen', ['package', '-t', 'wgt', '-s', perfil, '--', SALIDA], { stdio: 'inherit' });
  const generado = fs.readdirSync(SALIDA).find(archivo => archivo.endsWith('.wgt'));
  if (!generado) throw new Error('Tizen Studio no generó el .wgt; revisa el perfil de certificados ' + perfil);
  const destino = path.join(RAIZ, 'build', 'Telon.wgt');
  fs.renameSync(path.join(SALIDA, generado), destino);
  return destino;
}

// Un .wgt es un zip; sin firma sirve para inspeccionarlo, no para instalarlo.
function packageUnsigned() {
  const destino = path.join(RAIZ, 'build', 'Telon-sin-firmar.wgt');
  fs.rmSync(destino, { force: true });
  if (!commandExists('zip')) return null;
  execFileSync('zip', ['-qr', destino, '.'], { cwd: SALIDA });
  return destino;
}

// ============================================================
// PRINCIPAL
// ============================================================

function main() {
  cleanOutput();
  const scripts = listScripts(fs.readFileSync(path.join(WWW, 'index.html'), 'utf8'));
  scripts.forEach(transpileScript);
  transpileStyles();
  copyStaticFiles();
  console.log(`App web lista en ${path.relative(RAIZ, SALIDA)} (${scripts.length} módulos, objetivo ${OBJETIVO_JS}).`);

  const perfil = process.env.TIZEN_PROFILE;
  if (perfil && commandExists('tizen')) {
    console.log('Paquete firmado: ' + path.relative(RAIZ, packageSigned(perfil)));
    console.log('Instalar en la TV: tizen install -n build/Telon.wgt -t <nombre-del-televisor>');
    return;
  }
  const sinFirmar = packageUnsigned();
  if (sinFirmar) console.log('Paquete SIN firmar (solo para revisar): ' + path.relative(RAIZ, sinFirmar));
  console.log('Para instalar en la TV hace falta firmarlo: TIZEN_PROFILE=<perfil> npm run build:tizen (ver README, "Samsung").');
}

main();
