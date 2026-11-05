/*
Telón - Recorrido completo de una persona que abre la app por primera vez
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Sigue docs/pruebas/recorrido-completo.md paso a paso en un Chromium real con la app
empaquetada: una vez como en un Android TV (solo flechas y OK del control) y otra como en un
celular (toques). Si una etapa falla, el mensaje dice qué no pudo hacer la persona.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { packageApp, startStaticServer, platformInitScript, contextOptions, answerFromFixtures, fulfillWith, launchOrSkip } = require('../support/navegador');
const { createPerson } = require('../support/persona');

// ============================================================
// CONSTANTES
// ============================================================

// Teclas del control que llegan por MainActivity (android.view.KeyEvent).
const TECLA = { SIGUIENTE: 87, ANTERIOR: 88, PLAY_PAUSA: 85 };
// PNG de 1×1 px para elegir una foto de la galería.
const FOTO_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

packageApp();

// ============================================================
// RED CONTROLABLE
// ============================================================

// Las respuestas de prueba, con interruptores para provocar fallas en etapas concretas.
function createNetwork() {
  const fallas = { video: 'pendiente', firebase: null, catalogoCaido: false, sinInternet: false, versionNueva: false };
  async function answer(solicitud) {
    const url = solicitud.request().url();
    // El video de prueba no existe: queda cargando (se simula la reproducción) o falla.
    if (url.startsWith('https://cdn/')) return fallas.video === 'falla' ? solicitud.fulfill({ status: 404, body: '' }) : undefined;
    if (fallas.sinInternet && !url.includes('version.json')) return solicitud.abort('internetdisconnected');
    if (fallas.catalogoCaido && url.includes('cinemeta-es/catalog/series/top.json')) return solicitud.fulfill({ status: 500, body: '' });
    if (fallas.firebase && url.includes(`accounts:${fallas.firebase.operacion}`)) return fulfillWith(solicitud, { json: { error: { message: fallas.firebase.codigo } } });
    if (fallas.versionNueva && url.includes('version.json')) return fulfillWith(solicitud, { json: { version: 3, notes: 'Mejoras', url: 'https://ejemplo.com/telon.apk' } });
    return answerFromFixtures(solicitud);
  }
  return { fallas, answer };
}

// ============================================================
// AYUDAS
// ============================================================

// jsdom no, Chromium sí reproduce; pero el video de prueba no existe. Se fija lo que el
// navegador informaría al reproducir: segundo actual y duración.
const simulatePlayback = (pagina, segundos, duracion = 600) => pagina.evaluate(([s, d]) => {
  const video = window.__telon.reproductor.video;
  Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: s });
  Object.defineProperty(video, 'duration', { configurable: true, writable: true, value: d });
}, [segundos, duracion]);

const player = pagina => pagina.evaluate(() => {
  const r = window.__telon.reproductor;
  return r && { indice: r.sesion.indice, fuente: r.sesion.indiceFuente, panel: r.panel, pausado: r.video.paused, segundo: r.video.currentTime,
    silenciado: r.video.muted, velocidad: r.video.playbackRate, subs: r.sesion.subsActivos, tamanoSubs: r.sesion.tamanoSubs };
});

const profileId = (pagina, nombre) => pagina.evaluate(n => JSON.parse(localStorage.getItem('telon.profiles')).find(p => p.name === n).id, nombre);

// Desliza el dedo sobre el video (celular): hacia arriba pasa al episodio siguiente.
const swipe = (pagina, desdeY, hastaY) => pagina.evaluate(([y0, y1]) => {
  const escenario = document.querySelector('#player .stage');
  const toque = (tipo, propiedad, y) => {
    const evento = new Event(tipo, { bubbles: true });
    Object.defineProperty(evento, propiedad, { value: [{ clientX: 150, clientY: y }] });
    escenario.dispatchEvent(evento);
  };
  toque('touchstart', 'touches', y0);
  toque('touchend', 'changedTouches', y1);
}, [desdeY, hastaY]);

// ============================================================
// EL RECORRIDO
// ============================================================

async function runJourney(t, navegador, base, modo) {
  const red = createNetwork();
  const contexto = await navegador.newContext(contextOptions(modo));
  await contexto.addInitScript(platformInitScript(modo, { conPerfil: false }));
  await contexto.route(url => !url.href.startsWith(base.replace('index.html', '')), red.answer);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', error => errores.push(error.message));
  const persona = createPerson(pagina, modo);
  const { enTv } = persona;
  const etapa = (nombre, cuerpo) => t.test(nombre, cuerpo);

  try {
    await etapa('1. Abre la app por primera vez y crea su perfil', async () => {
      await pagina.goto(base);
      await pagina.waitForSelector('.pf-screen');
      assert.match(await persona.text('.pf-title'), /Quién está viendo/);
      assert.equal(await persona.count('[data-act^="pickprofile:"]'), 0, 'arranca sin perfiles y sin pedir registro');
      persona.answerNextDialog('Ana');
      await persona.choose('[data-act="addprofile"]', 'Añadir perfil');
      await persona.choose(`[data-act="pickprofile:${await profileId(pagina, 'Ana')}"]`, 'el perfil de Ana');
      await pagina.waitForSelector('.card');
    });

    await etapa('2. Mira el Inicio', async () => {
      const pestanas = await pagina.locator('#nav button').allTextContents();
      assert.deepEqual(pestanas.map(p => p.trim()), enTv ? ['Inicio', 'Biblioteca', 'Ajustes', 'Buscar'] : ['Inicio', 'Biblioteca', 'Ajustes']);
      assert.ok(await persona.count('.chip') >= 3, 'hay filtros');
      assert.ok(await persona.count('.hero') === 1, 'hay un destacado');
      assert.ok(await persona.count('.section h2') >= 1, 'hay secciones de catálogos');
      if (enTv) {
        await persona.reach('.card[data-k*="tt002"]', 'una tarjeta de la fila');
        await persona.press('ArrowRight'); await persona.press('ArrowRight');
        await persona.reach('#nav button.on', 'la pestaña activa');
      }
    });

    await etapa('3. Filtra por país, género y tipo', async () => {
      await persona.choose('[data-act="filter:KR"]', 'el filtro Corea');
      assert.equal(await persona.count('.chip.on[data-act="filter:KR"]'), 1);
      const tarjetasCorea = await persona.count('.card');
      await persona.choose('[data-act="filterreset"]', 'Todo');
      assert.ok(await persona.count('.card') > tarjetasCorea, 'Todo vuelve a mostrar más títulos');
      await persona.choose('[data-act="ftype:movie"]', 'Películas');
      assert.equal(await persona.count('.card[data-k*="tt001"]'), 0, 'con Películas no aparecen series');
      await persona.choose('[data-act="filterreset"]', 'Todo');
    });

    await etapa('4. Busca un título', async () => {
      await persona.choose(enTv ? '#nav [data-act="search"]' : '.appbar [data-act="search"]', 'Buscar');
      assert.equal(await pagina.evaluate(() => document.activeElement.id), 'q', 'el foco queda en el campo');
      await persona.write('#q', 'show');
      await pagina.waitForSelector('#homeBody .card', { timeout: 5000 });
      if (enTv) {
        await persona.press('ArrowDown');
        assert.ok(await pagina.evaluate(() => Boolean(document.activeElement.closest('#homeBody'))), 'baja a los resultados');
      }
      await persona.back();
      assert.equal(await persona.count('#q'), 0, 'Atrás cierra la búsqueda');
    });

    await etapa('5. Abre una serie, cambia de temporada y la guarda', async () => {
      await persona.choose('.card[data-k*="tt001"]', 'la tarjeta de Drama Coreano');
      await pagina.waitForSelector('#detail .actions');
      assert.match(await persona.text('#detail h1'), /Drama Coreano/);
      if (enTv) assert.match(await persona.focus(), /play:/, 'en TV el foco ya está en Reproducir');
      await persona.choose('[data-act="season:2"]', 'la temporada 2');
      assert.equal(await persona.count('.season-chips .chip.on[data-act="season:2"]'), 1);
      await persona.choose('[data-act="savelib"]', 'Guardar');
      assert.match(await persona.text('[data-act="savelib"]'), /Guardado/);
      assert.match(await persona.toast(), /Guardado en tu lista/);
      await persona.back();
      assert.equal(await pagina.locator('#detail').isHidden(), true);
      if (enTv) assert.match(await persona.focus(), /tt001/, 'el foco vuelve a la tarjeta');
    });

    await etapa('6. Reproduce y usa todos los controles', async () => {
      await persona.choose('.card[data-k*="tt001"]', 'Drama Coreano');
      await pagina.waitForSelector('#detail .actions');
      await persona.choose('[data-act^="play:"]', 'Reproducir');
      await pagina.waitForSelector('#player .rail button');
      await simulatePlayback(pagina, 100);

      // Pausa y reanuda.
      const antes = (await player(pagina)).pausado;
      if (enTv) await persona.press('Enter');
      else {
        // Con los controles ocultos, el primer toque solo los muestra; a la vista, el toque pausa.
        if (await pagina.evaluate(() => document.querySelector('#player').classList.contains('hide-ui'))) await persona.choose('#player .stage');
        await persona.choose('#player .stage');
      }
      assert.notEqual((await player(pagina)).pausado, antes, 'pausa o reanuda');

      // Adelantar y retroceder con el control.
      if (enTv) {
        await pagina.evaluate(() => document.activeElement.blur());
        await persona.press('ArrowRight');
        assert.equal((await player(pagina)).segundo, 110, '→ adelanta 10 segundos');
        await persona.press('ArrowLeft');
        assert.equal((await player(pagina)).segundo, 100, '← retrocede 10 segundos');
      }

      // Sonido y velocidad.
      await persona.choose('#prail [data-p="mute"]', 'Sonido');
      assert.equal((await player(pagina)).silenciado, true);
      await persona.choose('#prail [data-p="mute"]', 'Sonido');
      assert.equal((await player(pagina)).silenciado, false);
      await persona.choose('#prail [data-p="speed"]', 'Velocidad');
      assert.equal((await player(pagina)).velocidad, 1.5, 'la velocidad pasa de 1x a 1.5x');

      // Subtítulos: interruptor, posición y tamaño; Atrás cierra el panel.
      await persona.choose('#prail [data-p="subs"]', 'Subs');
      assert.equal((await player(pagina)).panel, 'subs');
      const subs = (await player(pagina)).subs;
      await persona.choose('.sheet [data-p="subtoggle"]', 'el interruptor de subtítulos');
      assert.notEqual((await player(pagina)).subs, subs);
      const tamano = (await player(pagina)).tamanoSubs;
      await persona.choose('.sheet [data-p="subsize:2"]', 'A+');
      assert.equal((await player(pagina)).tamanoSubs, tamano + 2);
      await persona.choose('.sheet [data-p="subpos:-1"]', 'Arriba');
      await persona.back();
      assert.equal((await player(pagina)).panel, null, 'Atrás cierra el panel sin cerrar el video');

      // Episodios y fuentes.
      await persona.choose('#prail [data-p="eps"]', 'Episodios');
      await persona.choose('.sheet [data-p="ep:1"]', 'el episodio 2');
      await pagina.waitForTimeout(300);
      assert.equal((await player(pagina)).indice, 1, 'cambia al episodio elegido');
      const fuente = (await player(pagina)).fuente;
      await persona.choose('#prail [data-p="sources"], #player .srcchip', 'Fuentes');
      const otra = await pagina.evaluate(f => [...document.querySelectorAll('.sheet [data-p^="src:"]')].map(b => b.dataset.p).find(p => p !== 'src:' + f), fuente);
      await persona.choose(`.sheet [data-p="${otra}"]`, 'otra fuente');
      assert.notEqual((await player(pagina)).fuente, fuente, 'cambia de fuente');

      // Guardar desde el reproductor (ya estaba guardada: se quita y se vuelve a guardar).
      await persona.choose('#prail [data-p="save"]', 'Guardar');
      await persona.choose('#prail [data-p="save"]', 'Guardar');
      assert.equal(await pagina.locator('#prail [data-p="save"]').getAttribute('class'), 'on');

      // Episodio siguiente y anterior.
      if (enTv) await persona.systemKey(TECLA.ANTERIOR);
      else { await swipe(pagina, 300, 600); await pagina.waitForTimeout(400); }
      await pagina.waitForTimeout(300);
      assert.equal((await player(pagina)).indice, 0, 'vuelve al episodio anterior');
      if (enTv) await persona.systemKey(TECLA.SIGUIENTE);
      else { await swipe(pagina, 600, 300); await pagina.waitForTimeout(400); }
      await pagina.waitForTimeout(300);
      assert.equal((await player(pagina)).indice, 1, 'pasa al siguiente');

      // Termina un episodio: sigue con el siguiente.
      await pagina.evaluate(() => window.__telon.reproductor.video.dispatchEvent(new Event('ended')));
      await pagina.waitForTimeout(500);
      assert.equal((await player(pagina)).indice, 2, 'al terminar sigue con el siguiente episodio');

      // Cierra a mitad del episodio: la ficha ofrece continuar.
      await simulatePlayback(pagina, 120);
      if (enTv) {
        await persona.choose('#player [data-p="back"]', 'el botón volver del reproductor');
      } else {
        await persona.back();
      }
      assert.equal(await player(pagina), null, 'se cerró el reproductor');
      assert.match(await persona.text('#detail [data-act^="play:"]'), /Continuar/);
      await persona.back();
    });

    await etapa('7. Sigue viendo desde el Inicio', async () => {
      await pagina.waitForSelector('.section h2:text("Continuar viendo")');
      await persona.choose('[data-act="resume"]', 'la serie en Continuar viendo');
      await pagina.waitForSelector('#player .rail button');
      assert.equal((await player(pagina)).indice, 2, 'retoma el episodio donde quedó');
      await persona.back(); await persona.back();
    });

    await etapa('8. Revisa su biblioteca', async () => {
      await persona.choose('#nav [data-act="tab:lib"]', 'Biblioteca');
      assert.ok(await persona.count('.grid3 .card[data-k*="tt001"]') === 1, 'Mi lista tiene la serie guardada');
      await persona.choose('[data-act="libtab:hist"]', 'Historial');
      assert.ok(await persona.count('.hrow[data-act="resume"]') >= 1, 'el historial tiene lo visto');
    });

    await etapa('9. Crea una cuenta, prueba los errores, verifica y vuelve a entrar', async () => {
      await persona.choose('#nav [data-act="tab:settings"]', 'Ajustes');
      await persona.write('#authname', 'Ana');
      await persona.write('#authpass', 'secreto1');
      await persona.choose('[data-act="register"]', 'Crear cuenta');
      assert.match(await persona.toast(), /Escribe tu correo/);
      await persona.write('#authemail', 'ana@x.com');
      await persona.write('#authpass', '123');
      await persona.choose('[data-act="register"]', 'Crear cuenta');
      assert.match(await persona.toast(), /al menos 6/);
      red.fallas.firebase = { operacion: 'signUp', codigo: 'EMAIL_EXISTS' };
      await persona.write('#authpass', 'secreto1');
      await persona.choose('[data-act="register"]', 'Crear cuenta');
      await pagina.waitForTimeout(300);
      assert.match(await persona.toast(), /ya tiene cuenta/);
      red.fallas.firebase = null;
      await persona.choose('[data-act="register"]', 'Crear cuenta');
      await pagina.waitForSelector('[data-act="checkverify"]');
      assert.match(await persona.text('.set-section'), /Sin verificar/);
      await persona.choose('[data-act="checkverify"]', 'Ya verifiqué mi correo');
      await pagina.waitForTimeout(300);
      assert.match(await persona.toast(), /verificado/);
      await persona.choose('[data-act="logout"]', 'Cerrar sesión');
      await pagina.waitForSelector('#authemail');
      red.fallas.firebase = { operacion: 'signInWithPassword', codigo: 'INVALID_PASSWORD' };
      await persona.write('#authemail', 'ana@x.com');
      await persona.write('#authpass', 'otra123');
      await persona.choose('[data-act="emaillogin"]', 'Iniciar sesión');
      await pagina.waitForTimeout(300);
      assert.match(await persona.toast(), /Contraseña incorrecta/);
      red.fallas.firebase = null;
      await persona.write('#authpass', 'secreto1');
      await persona.choose('[data-act="emaillogin"]', 'Iniciar sesión');
      await pagina.waitForSelector('[data-act="logout"]');
    });

    await etapa('10. Cambia los ajustes y borra sus datos', async () => {
      await persona.choose('[data-act="setquality"]', 'Calidad preferida');
      assert.match(await persona.text('[data-act="setquality"]'), /1080p/);
      const subs = await pagina.getAttribute('[data-act="togglesubs"]', 'aria-checked');
      await persona.choose('[data-act="togglesubs"]', 'Subtítulos automáticos');
      assert.notEqual(await pagina.getAttribute('[data-act="togglesubs"]', 'aria-checked'), subs);
      await persona.choose('.set-card[data-act="reloadaddons"]', 'Recargar catálogos');
      await pagina.waitForTimeout(500);
      assert.match(await persona.toast(), /Addons recargados/);
      await persona.choose('[data-act="clearhist"]', 'Borrar historial');
      assert.match(await persona.text('[data-act="clearhist"]'), /(^|\D)0 elementos/);
      await persona.choose('[data-act="clearlib"]', 'Vaciar mi lista');
      assert.match(await persona.text('[data-act="clearlib"]'), /(^|\D)0 elementos/);
    });

    await etapa('11. Crea un segundo perfil, le pone foto y lo borra', async () => {
      // Ana guarda una serie para comprobar que cada perfil tiene su propia lista.
      await persona.choose('#nav [data-act="tab:home"]', 'Inicio');
      await persona.choose('.card[data-k*="tt001"]', 'Drama Coreano');
      await pagina.waitForSelector('#detail .actions');
      await persona.choose('[data-act="savelib"]', 'Guardar');
      await persona.back();
      await persona.choose('#nav [data-act="tab:settings"]', 'Ajustes');
      await persona.choose('[data-act="showprofiles"]', 'Cambiar perfil');
      await pagina.waitForSelector('.pf-grid');
      persona.answerNextDialog('Beto');
      await persona.choose('[data-act="addprofile"]', 'Añadir perfil');
      await persona.choose(`[data-act="pickprofile:${await profileId(pagina, 'Beto')}"]`, 'el perfil de Beto');
      // La Biblioteca recuerda la última pestaña: se elige Mi lista para no mirar el historial.
      await persona.choose('#nav [data-act="tab:lib"]', 'Biblioteca');
      await persona.choose('[data-act="libtab:list"]', 'Mi lista');
      assert.equal(await persona.count('#screen .card'), 0, 'Beto empieza con su propia lista, vacía (la serie de Ana no aparece)');
      await persona.choose('#nav [data-act="tab:home"]', 'Inicio');
      if (!enTv) assert.equal((await persona.text('.appbar .pf-mini')).trim(), 'B', 'arriba se ve el avatar de Beto');
      await persona.choose('#nav [data-act="tab:settings"]', 'Ajustes');
      assert.match(await persona.text('[data-act="showprofiles"]'), /Beto/, 'Ajustes muestra el perfil activo');
      await persona.choose('[data-act="showprofiles"]', 'Cambiar perfil');
      persona.answerNextDialog('https://img/beto.jpg');
      await persona.choose('[data-act="editprofileimg"]', 'Cambiar foto');
      assert.equal(await persona.count('.pf-avatar img[src="https://img/beto.jpg"]'), 1, 'la foto aparece en el perfil');
      if (!enTv) {
        persona.answerNextDialog('galería');
        const [selector] = await Promise.all([pagina.waitForEvent('filechooser'), persona.choose('[data-act="editprofileimg"]', 'Cambiar foto')]);
        await selector.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: FOTO_PNG });
        await pagina.waitForTimeout(500);
        assert.equal(await persona.count('.pf-avatar img[src^="data:image/jpeg"]'), 1, 'la foto de la galería queda guardada');
      }
      persona.answerNextDialog('Nadie');
      await persona.choose('[data-act="manageprofiles"]', 'Administrar');
      assert.match(await persona.toast(), /Perfil no encontrado/);
      persona.answerNextDialog('Beto');
      await persona.choose('[data-act="manageprofiles"]', 'Administrar');
      assert.equal(await persona.count('.pf-card .pf-name:text("Beto")'), 0, 'Beto ya no está');
      await persona.choose(`[data-act="pickprofile:${await profileId(pagina, 'Ana')}"]`, 'el perfil de Ana');
      await persona.choose('#nav [data-act="tab:lib"]', 'Biblioteca');
      await persona.choose('[data-act="libtab:list"]', 'Mi lista');
      assert.equal(await persona.count('.grid3 .card[data-k*="tt001"]'), 1, 'al volver a Ana, su lista sigue con su serie');
    });

    await etapa('12. Administra sus addons desde Ajustes', async () => {
      await persona.choose('#nav [data-act="tab:settings"]', 'Ajustes');
      await persona.choose('.set-card[data-act="tab:addons"]', 'Addons');
      await pagina.waitForSelector('.addwrap');
      await persona.write('#addurl', 'https://no-existe.test/manifest.json');
      await persona.choose('[data-act="install"]', 'Instalar');
      await pagina.waitForSelector('.err');
      assert.match(await persona.text('.err'), /No se pudo instalar/);
      await persona.write('#addurl', 'stremio://insanos.net/cinemeta-es/manifest.json');
      await persona.choose('[data-act="install"]', 'Instalar');
      await pagina.waitForTimeout(400);
      assert.match(await persona.toast(), /Instalado: Cinemeta ES/);
      const cinemeta = '[data-act="toggle:https://insanos.net/cinemeta-es"]';
      await persona.choose(cinemeta, 'el interruptor de Cinemeta');
      assert.equal(await pagina.getAttribute(cinemeta, 'aria-checked'), 'false');
      await persona.choose('#nav [data-act="tab:home"]', 'Inicio');
      await pagina.waitForTimeout(400);
      assert.equal(await persona.count('.card[data-k*="tt001"]'), 0, 'sin Cinemeta no aparecen sus series');
      await persona.choose('#nav [data-act="tab:settings"]', 'Ajustes');
      await persona.choose('.set-card[data-act="tab:addons"]', 'Addons');
      await persona.choose(cinemeta, 'el interruptor de Cinemeta');
      await persona.choose('[data-act="del:https://insanos.net/cinemeta-es"]', 'Quitar');
      assert.match(await persona.text('[data-act="del:https://insanos.net/cinemeta-es"]'), /Quitar/, 'el primer toque pide confirmar');
      await persona.choose('[data-act="del:https://insanos.net/cinemeta-es"]', 'Quitar');
      assert.equal(await persona.count('[data-act="del:https://insanos.net/cinemeta-es"]'), 0, 'el segundo toque lo quita');
      await persona.write('#addurl', 'https://insanos.net/cinemeta-es/manifest.json');
      await persona.choose('[data-act="install"]', 'Instalar');
      await pagina.waitForTimeout(400);
    });

    await etapa('13. Cuando algo falla: un catálogo caído y sin internet', async () => {
      red.fallas.catalogoCaido = true;
      await persona.choose('#nav [data-act="tab:settings"]', 'Ajustes');
      await persona.choose('.set-card[data-act="reloadaddons"]', 'Recargar catálogos');
      await persona.choose('#nav [data-act="tab:home"]', 'Inicio');
      await pagina.waitForSelector('#homeBody .hint');
      assert.match(await persona.text('#homeBody .hint'), /no respondieron/);
      red.fallas.catalogoCaido = false;
      red.fallas.sinInternet = true;
      await pagina.reload();
      await pagina.waitForSelector('#homeBody .empty');
      assert.match(await persona.text('#homeBody .empty h3'), /Sin catálogos|Todavía no tienes addons/);
      red.fallas.sinInternet = false;
      await persona.choose('#homeBody [data-act="refresh"], #homeBody [data-act="reloadaddons"]', 'Reintentar');
      await pagina.reload();
      await pagina.waitForSelector('.card');
    });

    await etapa('14. Le avisan de una versión nueva', async () => {
      red.fallas.versionNueva = true;
      await pagina.reload();
      await pagina.waitForSelector('.modal');
      await persona.choose('[data-update="later"]', 'Luego');
      assert.equal(await persona.count('.modal'), 0, 'Luego cierra el aviso');
      red.fallas.versionNueva = false;
    });

    await etapa('15. Atrás cierra todo hasta salir, y al volver todo sigue ahí', async () => {
      await persona.choose('.card[data-k*="tt001"]', 'Drama Coreano');
      await pagina.waitForSelector('#detail .actions');
      if (!/Guardado/.test(await persona.text('[data-act="savelib"]'))) await persona.choose('[data-act="savelib"]', 'Guardar');
      assert.match(await persona.text('[data-act="savelib"]'), /Guardado/);
      await persona.choose('[data-act^="play:"]', 'Reproducir');
      await pagina.waitForSelector('#player .rail button');
      await simulatePlayback(pagina, 300);
      await pagina.evaluate(() => window.telonPause());
      const visto = await pagina.evaluate(() => Object.values(window.__telon.historial)[0].t);
      assert.equal(visto, 300, 'al suspenderse, el progreso queda guardado');
      await persona.choose('#prail [data-p="eps"]', 'Episodios');
      for (const queCierra of ['el panel', 'el reproductor', 'la ficha']) assert.equal(await persona.back(), true, `Atrás cierra ${queCierra}`);
      assert.equal(await persona.back(), false, 'en el Inicio sin nada abierto, Atrás sale de la app');
      await pagina.reload();
      await pagina.waitForSelector('.card');
      assert.equal(await persona.count('.pf-screen'), 0, 'entra directo con el último perfil');
      await persona.choose('#nav [data-act="tab:lib"]', 'Biblioteca');
      assert.equal(await persona.count('.grid3 .card[data-k*="tt001"]'), 1, 'Mi lista sigue igual');
    });

    assert.deepEqual(errores, [], 'la app no tuvo errores de JavaScript en todo el recorrido');
  } finally {
    await contexto.close();
  }
}

for (const [modo, quien] of [['android-tv', 'en un Android TV con el control'], ['android-phone', 'en un celular con el dedo']]) {
  test(`recorrido completo de una persona nueva ${quien}`, async (t) => {
    const navegador = await launchOrSkip(t);
    if (!navegador) return;
    const servidor = await startStaticServer();
    try {
      await runJourney(t, navegador, `http://127.0.0.1:${servidor.address().port}/index.html`, modo);
    } finally {
      await navegador.close();
      servidor.close();
    }
  });
}
