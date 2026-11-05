/*
Telón - Una persona usando la app (para los recorridos en Chromium)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Encapsula cómo usa la app una persona según el aparato. En el celular, elegir algo es tocarlo.
En el TV, es llegar con las flechas del control hasta ese botón y apretar OK: si el foco se
queda pegado y no llega, falla diciendo a qué no se pudo llegar y desde dónde. Así cada paso
de un recorrido comprueba también que esa opción se alcanza con el control.
*/
'use strict';

// ============================================================
// CONSTANTES
// ============================================================

const MAXIMO_TECLAS_PARA_LLEGAR = 45;
const PAUSA_TRAS_TECLA_MS = 110;
const PAUSA_TRAS_ELEGIR_MS = 220;

// ============================================================
// LECTURA DE LA PANTALLA
// ============================================================

// Dentro del navegador: posición del foco actual y del primer elemento visible que coincide.
function readPositions(selector) {
  const visible = e => e.offsetParent !== null && e.getBoundingClientRect().width > 0;
  const objetivo = [...document.querySelectorAll(selector)].find(visible);
  const actual = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  const describir = e => (e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} ${e.dataset.act || e.dataset.p || ''} «${(e.textContent || e.placeholder || '').trim().slice(0, 30)}»` : 'nada');
  const caja = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  if (!objetivo) return { error: 'no hay nada visible que coincida con ' + selector };
  if (actual === objetivo) return { listo: true };
  return { objetivo: caja(objetivo), actual: actual ? caja(actual) : null, desde: describir(actual) };
}

const sameRow = (a, b) => a.top < b.bottom && b.top < a.bottom;

// La flecha principal hacia el objetivo y, si esa no mueve el foco, la del otro eje.
function arrowsTowards(actual, objetivo) {
  const horizontal = objetivo.cx > actual.cx ? 'ArrowRight' : 'ArrowLeft';
  const vertical = objetivo.cy > actual.cy ? 'ArrowDown' : 'ArrowUp';
  return sameRow(actual, objetivo) ? [horizontal, vertical] : [vertical, horizontal];
}

// ============================================================
// LA PERSONA
// ============================================================

function createPerson(pagina, modo) {
  const enTv = modo !== 'android-phone';
  const respuestasDialogo = [];
  pagina.on('dialog', dialogo => dialogo.accept(dialogo.type() === 'prompt' ? (respuestasDialogo.shift() ?? '') : undefined));

  const pause = (ms = PAUSA_TRAS_TECLA_MS) => pagina.waitForTimeout(ms);
  const focusId = () => pagina.evaluate(() => {
    const e = document.activeElement;
    return e && e !== document.body ? [e.tagName, e.id, e.dataset.act, e.dataset.p, e.dataset.k, e.textContent.trim().slice(0, 30)].join('|') : '';
  });

  async function press(tecla) {
    await pagina.keyboard.press(tecla);
    await pause();
  }

  // Llega con las flechas hasta el elemento, como alguien en el sofá.
  async function reach(selector, descripcion = selector) {
    const camino = [];
    for (let i = 0; i < MAXIMO_TECLAS_PARA_LLEGAR; i++) {
      const estado = await pagina.evaluate(readPositions, selector);
      if (estado.error) throw new Error(`No se puede llegar a ${descripcion}: ${estado.error}`);
      if (estado.listo) return;
      const flechas = estado.actual ? arrowsTowards(estado.actual, estado.objetivo) : ['ArrowDown'];
      camino.push(estado.desde);
      const antes = await focusId();
      let seMovio = false;
      for (const flecha of flechas) {
        await press(flecha);
        if (await focusId() !== antes) { seMovio = true; break; }
      }
      if (!seMovio) throw new Error(`El control no llega a ${descripcion}: el foco se queda en ${estado.desde}`);
    }
    // El final del camino muestra si el foco rebota entre dos lugares.
    throw new Error(`El control no llega a ${descripcion} en ${MAXIMO_TECLAS_PARA_LLEGAR} teclas. Últimos pasos: ${camino.slice(-6).join(' → ')}`);
  }

  // Elegir: en TV, llegar con el control y apretar OK; en el celular, tocar.
  async function choose(selector, descripcion = selector) {
    if (enTv) {
      await reach(selector, descripcion);
      await press('Enter');
    } else {
      await pagina.locator(selector).locator('visible=true').first().click();
    }
    await pause(PAUSA_TRAS_ELEGIR_MS);
  }

  // Escribir en un campo: en TV se llega con el control (el texto lo pone el teclado en pantalla).
  async function write(selector, texto) {
    if (enTv) await reach(selector, 'el campo ' + selector);
    await pagina.locator(selector).first().fill(texto);
    await pagina.locator(selector).first().dispatchEvent('input');
    await pause();
  }

  // Lo que manda el sistema: la tecla Atrás (MainActivity llama telonBack) y las teclas
  // multimedia del control (MainActivity llama _tvKey).
  async function back() {
    const atendido = await pagina.evaluate(() => window.telonBack());
    await pause(PAUSA_TRAS_ELEGIR_MS);
    return atendido;
  }
  async function systemKey(codigoAndroid) {
    await pagina.evaluate(codigo => window._tvKey(codigo), codigoAndroid);
    await pause(PAUSA_TRAS_ELEGIR_MS);
  }

  return {
    enTv,
    press,
    reach,
    choose,
    write,
    back,
    systemKey,
    answerNextDialog: texto => respuestasDialogo.push(texto),
    focus: () => pagina.evaluate(readPositions, ':focus').then(() => focusId()),
    toast: () => pagina.locator('#toast').textContent(),
    text: selector => pagina.locator(selector).locator('visible=true').first().textContent(),
    count: selector => pagina.locator(selector).locator('visible=true').count(),
    state: funcion => pagina.evaluate(funcion)
  };
}

module.exports = { createPerson };
