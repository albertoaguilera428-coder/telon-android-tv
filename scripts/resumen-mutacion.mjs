/*
Telón - Resumen de las pruebas de mutación
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

En el CI, Stryker corre repartido en varias máquinas y cada una deja su reporte JSON. Este
script los junta y escribe en Markdown el puntaje total, el de cada archivo y la lista de
mutantes sobrevivientes (los que ninguna prueba detectó), para leerlo sin descargar nada.

  node scripts/resumen-mutacion.mjs <carpeta-con-reportes> >> "$GITHUB_STEP_SUMMARY"
*/
import fs from 'node:fs';
import path from 'node:path';

// ============================================================
// CONSTANTES
// ============================================================

const DETECTADOS = ['Killed', 'Timeout'];
const NO_DETECTADOS = ['Survived', 'NoCoverage'];
const MAXIMO_SOBREVIVIENTES_LISTADOS = 80;

// ============================================================
// LECTURA
// ============================================================

function listReports(carpeta) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap(entrada => {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) return listReports(ruta);
    return entrada.name.endsWith('.json') ? [ruta] : [];
  });
}

// Formato de Stryker (mutation-testing-report-schema): { files: { ruta: { mutants: [...] } } }.
function collectMutants(reportes) {
  const porArchivo = new Map();
  for (const reporte of reportes) {
    const datos = JSON.parse(fs.readFileSync(reporte, 'utf8'));
    for (const [archivo, { mutants }] of Object.entries(datos.files || {})) {
      porArchivo.set(archivo, [...(porArchivo.get(archivo) || []), ...mutants]);
    }
  }
  return porArchivo;
}

// ============================================================
// CÁLCULO
// ============================================================

const count = (mutantes, estados) => mutantes.filter(m => estados.includes(m.status)).length;

function scoreOf(mutantes) {
  const detectados = count(mutantes, DETECTADOS);
  const validos = detectados + count(mutantes, NO_DETECTADOS);
  return validos ? (detectados / validos) * 100 : 100;
}

// ============================================================
// SALIDA
// ============================================================

function summarize(porArchivo) {
  const todos = [...porArchivo.values()].flat();
  const lineas = [`## Pruebas de mutación: ${scoreOf(todos).toFixed(1)} %`, '',
    `${count(todos, DETECTADOS)} detectados · ${count(todos, ['Survived'])} sobrevivientes · ${count(todos, ['NoCoverage'])} sin cobertura · ${count(todos, ['Timeout'])} por tiempo`, '',
    '| Archivo | Puntaje | Detectados | Sobrevivientes |', '|---|---|---|---|'];
  for (const [archivo, mutantes] of [...porArchivo].sort((a, b) => scoreOf(a[1]) - scoreOf(b[1]))) {
    lineas.push(`| ${archivo} | ${scoreOf(mutantes).toFixed(1)} % | ${count(mutantes, DETECTADOS)} | ${count(mutantes, NO_DETECTADOS)} |`);
  }
  const sobrevivientes = [...porArchivo].flatMap(([archivo, mutantes]) => mutantes
    .filter(m => NO_DETECTADOS.includes(m.status))
    .map(m => `- \`${archivo}:${m.location.start.line}\` ${m.mutatorName}${m.replacement ? ': `' + m.replacement.replace(/\s+/g, ' ').slice(0, 90) + '`' : ''}`));
  if (sobrevivientes.length) {
    lineas.push('', `### Sobrevivientes (${sobrevivientes.length})`, '', ...sobrevivientes.slice(0, MAXIMO_SOBREVIVIENTES_LISTADOS));
    if (sobrevivientes.length > MAXIMO_SOBREVIVIENTES_LISTADOS) lineas.push(`- … y ${sobrevivientes.length - MAXIMO_SOBREVIVIENTES_LISTADOS} más (ver los reportes descargables).`);
  }
  return lineas.join('\n');
}

// ============================================================
// PRINCIPAL
// ============================================================

const carpeta = process.argv[2];
if (!carpeta || !fs.existsSync(carpeta)) {
  console.error('Uso: node scripts/resumen-mutacion.mjs <carpeta-con-reportes>');
  process.exit(1);
}
const reportes = listReports(carpeta);
if (!reportes.length) {
  console.log('## Pruebas de mutación\n\nNo llegó ningún reporte: revisar los trabajos de Stryker.');
  process.exit(0);
}
console.log(summarize(collectMutants(reportes)));
