/*
Telón - Pruebas de la cuenta: registro, ingreso, verificación y cierre de sesión
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lo que importa aquí son los caminos de error: Firebase responde con códigos ("EMAIL_EXISTS",
"INVALID_PASSWORD"…) y la persona tiene que leer algo que entienda, nunca el código.
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('../support/app-driver');
const { route } = require('../support/fixtures');

const operacionDe = url => (url.match(/accounts:(\w+)/) || [])[1];

// Firebase falla con el código dado en la operación indicada; lo demás responde normal.
function firebaseFailing(operacion, codigo) {
  return url => (operacionDe(url) === operacion ? { json: { error: { message: codigo } } } : route(url));
}

function loadAccount(opciones = {}) {
  const app = loadApp({ hasta: 'js/app/account-service.js', ...opciones });
  return { app, cuenta: app.Telon.app.accountService, sesion: app.Telon.app.state.sesion };
}

// ============================================================
// VALIDACIÓN ANTES DE LLAMAR A FIREBASE
// ============================================================

test('ingresar pide correo y contraseña; un correo de puros espacios cuenta como vacío', () => {
  const { app } = loadAccount();
  const { validateLogin } = app.Telon.domain.account;
  assert.equal(validateLogin('ana@x.com', 'secreto1'), null);
  assert.equal(validateLogin('', 'secreto1'), 'Escribe correo y contraseña');
  assert.equal(validateLogin('   ', 'secreto1'), 'Escribe correo y contraseña');
  assert.equal(validateLogin('ana@x.com', ''), 'Escribe correo y contraseña');
  app.close();
});

test('registrarse con un correo de puros espacios pide el correo', () => {
  const { app } = loadAccount();
  const { validateRegistration } = app.Telon.domain.account;
  assert.equal(validateRegistration('Ana', '   ', 'secreto1'), 'Escribe tu correo');
  app.close();
});

test('si la validación falla no se llama a Firebase', async () => {
  const { app, cuenta } = loadAccount();
  const resultado = await cuenta.login('   ', 'secreto1');
  assert.equal(resultado.ok, false);
  assert.ok(!app.log.some(l => l.includes('identitytoolkit')), 'no hubo petición');
  app.close();
});

// ============================================================
// REGISTRO E INGRESO
// ============================================================

const ERRORES_CONOCIDOS = [
  ['signUp', 'EMAIL_EXISTS', 'register', /ya tiene cuenta/],
  ['signUp', 'TOO_MANY_ATTEMPTS_TRY_LATER', 'register', /Demasiados intentos/],
  ['signInWithPassword', 'INVALID_PASSWORD', 'login', /Contraseña incorrecta/],
  ['signInWithPassword', 'EMAIL_NOT_FOUND', 'login', /No hay cuenta con ese correo/],
  ['signInWithPassword', 'INVALID_LOGIN_CREDENTIALS', 'login', /Correo o contraseña incorrectos/]
];

for (const [operacion, codigo, accion, mensaje] of ERRORES_CONOCIDOS) {
  test(`${codigo} al ${accion === 'register' ? 'registrarse' : 'ingresar'} se explica con palabras y no deja sesión`, async () => {
    const { app, cuenta, sesion } = loadAccount({ route: firebaseFailing(operacion, codigo) });
    const resultado = accion === 'register' ? await cuenta.register('Ana', 'ana@x.com', 'secreto1') : await cuenta.login('ana@x.com', 'secreto1');
    assert.equal(resultado.ok, false);
    assert.match(resultado.mensaje, mensaje);
    assert.doesNotMatch(resultado.mensaje, new RegExp(codigo), 'el código interno no llega a la pantalla');
    assert.equal(sesion.get(), null);
    app.close();
  });
}

test('un código que no conocemos igual se muestra como un mensaje seguro', async () => {
  const { app, cuenta } = loadAccount({ route: firebaseFailing('signUp', 'ALGO_RARO_INTERNO') });
  const resultado = await cuenta.register('Ana', 'ana@x.com', 'secreto1');
  assert.equal(resultado.ok, false);
  assert.match(resultado.mensaje, /^No se pudo crear la cuenta: /);
  app.close();
});

test('al ingresar sin nombre guardado, se usa la parte del correo antes de la @', async () => {
  const sinNombre = url => (operacionDe(url) === 'signInWithPassword' ? { json: { localId: 'u', email: 'beto@x.com', idToken: 't' } } : route(url));
  const { app, cuenta, sesion } = loadAccount({ route: sinNombre });
  const resultado = await cuenta.login('beto@x.com', 'secreto1');
  assert.equal(resultado.ok, true);
  assert.equal(sesion.get().name, 'beto');
  app.close();
});

// ============================================================
// VERIFICACIÓN DEL CORREO
// ============================================================

test('reenviar la verificación sin haber ingresado en esta sesión no hace nada', async () => {
  const { app, cuenta } = loadAccount();
  assert.equal(await cuenta.resendVerification(), null);
  app.close();
});

test('si Firebase no deja reenviar la verificación, se pide esperar', async () => {
  const { app, cuenta } = loadAccount({ route: firebaseFailing('sendOobCode', 'TOO_MANY_ATTEMPTS_TRY_LATER') });
  await cuenta.register('Ana', 'ana@x.com', 'secreto1');
  const resultado = await cuenta.resendVerification();
  assert.deepEqual(plain(resultado), { ok: false, mensaje: 'Espera un momento antes de reenviar' });
  app.close();
});

test('comprobar la verificación actualiza la sesión guardada', async () => {
  const { app, cuenta, sesion } = loadAccount();
  await cuenta.register('Ana', 'ana@x.com', 'secreto1');
  assert.equal(sesion.get().verified, false);
  const resultado = await cuenta.refreshVerification();
  assert.equal(resultado.ok, true);
  assert.match(resultado.mensaje, /verificado/);
  assert.equal(sesion.get().verified, true);
  app.close();
});

test('si el token venció, comprobar la verificación pide volver a ingresar', async () => {
  const { app, cuenta, sesion } = loadAccount({ route: firebaseFailing('lookup', 'INVALID_ID_TOKEN') });
  await cuenta.register('Ana', 'ana@x.com', 'secreto1');
  const resultado = await cuenta.refreshVerification();
  assert.equal(resultado.ok, false);
  assert.match(resultado.mensaje, /iniciar sesión de nuevo/);
  assert.equal(sesion.get().verified, false, 'la sesión no cambia');
  app.close();
});

test('sin sesión guardada, o si Firebase no devuelve al usuario, no se cambia nada', async () => {
  const sinUsuarios = url => (operacionDe(url) === 'lookup' ? { json: { users: [] } } : route(url));
  const { app, cuenta } = loadAccount({ route: sinUsuarios });
  assert.equal(await cuenta.refreshVerification(), null, 'sin sesión');
  await cuenta.register('Ana', 'ana@x.com', 'secreto1');
  assert.equal(await cuenta.refreshVerification(), null, 'Firebase no conoce el token');
  app.close();
});

test('cerrar sesión borra la sesión guardada', async () => {
  const { app, cuenta, sesion } = loadAccount();
  await cuenta.login('ana@x.com', 'secreto1');
  assert.ok(sesion.get());
  const resultado = await cuenta.logout();
  assert.equal(resultado.ok, true);
  assert.equal(sesion.get(), null);
  app.close();
});
