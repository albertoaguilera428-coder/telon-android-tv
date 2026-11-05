/*
Telón - Empaquetado para televisores Samsung (.wgt)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Empaqueta la misma app web del APK (empaquetar-web.mjs: un solo telon.js rebajado para
el Chromium de Tizen 6.5), le suma config.xml y el ícono, y la deja en build/tizen. Si Tizen Studio está instalado y existe un
perfil de certificados, además firma y genera build/Telon.wgt:

  TIZEN_PROFILE=MiPerfil npm run build:tizen

Sin perfil queda build/Telon-sin-firmar.wgt, útil para revisar el contenido; la TV
solo instala paquetes firmados con un certificado de distribuidor de Samsung.
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageWeb, OBJETIVO } from './empaquetar-web.mjs';

// ============================================================
// CONSTANTES
// ============================================================

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'build', 'tizen');
const ICONO = path.join(RAIZ, 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png');

// ============================================================
// PASOS
// ============================================================

function copyTizenFiles() {
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
  packageWeb(SALIDA);
  copyTizenFiles();
  console.log(`App web lista en ${path.relative(RAIZ, SALIDA)} (objetivo ${OBJETIVO}).`);

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
