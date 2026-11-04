/*
Telón - Acciones de cuenta en Ajustes
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Lee lo que escribió el usuario, avisa que está trabajando y muestra el resultado. Las
reglas y la conversación con Firebase viven en app/account-service.js.
*/
'use strict';

import { validateRegistration, validateLogin } from '../domain/account.js';
import { sesion } from '../app/state.js';
import * as account from '../app/account-service.js';
import { toast } from './components.js';
import { render } from './screens.js';

const inputValue = id => (document.getElementById(id) || {}).value || '';

// null significa que no había nada que hacer (por ejemplo, sin sesión): no se muestra aviso.
function showResult(resultado, repintar) {
  if (!resultado) return;
  toast(resultado.mensaje);
  if (repintar && resultado.ok) render();
}

async function registerAccount() {
  const nombre = inputValue('authname'), correo = inputValue('authemail'), clave = inputValue('authpass');
  // Validamos aquí también para no mostrar "Creando cuenta…" cuando falta un dato.
  const problema = validateRegistration(nombre, correo, clave);
  if (problema) { toast(problema); return; }
  toast('Creando cuenta…');
  showResult(await account.register(nombre, correo, clave), true);
}

async function loginWithEmail() {
  const correo = inputValue('authemail'), clave = inputValue('authpass');
  const problema = validateLogin(correo, clave);
  if (problema) { toast(problema); return; }
  toast('Iniciando sesión…');
  showResult(await account.login(correo, clave), true);
}

async function resendVerification() {
  showResult(await account.resendVerification(), false);
}

async function checkVerification() {
  const datos = sesion.get();
  if (!datos || !datos.idToken) return;
  toast('Comprobando…');
  showResult(await account.refreshVerification(), true);
}

async function logout() {
  showResult(await account.logout(), true);
}

export { registerAccount, loginWithEmail, resendVerification, checkVerification, logout };
