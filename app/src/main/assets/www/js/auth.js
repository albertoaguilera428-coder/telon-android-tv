/*
Telón - Cuenta de usuario (Firebase Authentication por REST)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

En lugar del SDK de Firebase (pesado para un WebView de TV) hablamos directo con la
API REST de Identity Toolkit. El objeto `firebase` imita solo la parte del SDK que
usamos, así que cambiarlo algún día por el SDK real no obliga a tocar las pantallas.
*/
(function (Telon) {
  'use strict';

  const { store } = Telon.util;
  const { toast } = Telon.ui.components;
  const { render } = Telon.ui.screens;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // La clave de API web de Firebase es pública por diseño: lo que protege la cuenta son las
  // reglas y restricciones del proyecto en la consola de Firebase, no esconder esta clave.
  const CLAVE_API_FIREBASE = 'AIzaSyBuT4FxjE8LYRasc5EOjFGcdgZb3IToK7E';
  const LARGO_MINIMO_CLAVE = 6;
  const MENSAJES_REGISTRO = { 'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Inicia sesión.', 'auth/invalid-email': 'Correo no válido.',
    'auth/weak-password': 'Contraseña muy débil.', 'EMAIL_EXISTS': 'Ese correo ya tiene cuenta. Inicia sesión.', 'INVALID_EMAIL': 'Correo no válido.',
    'WEAK_PASSWORD': 'Contraseña muy débil (mín. 6 caracteres).', 'OPERATION_NOT_ALLOWED': 'Registro deshabilitado.' };
  const MENSAJES_INGRESO = { 'auth/user-not-found': 'No hay cuenta con ese correo.', 'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'EMAIL_NOT_FOUND': 'No hay cuenta con ese correo.', 'INVALID_PASSWORD': 'Contraseña incorrecta.',
    'INVALID_LOGIN_CREDENTIALS': 'Correo o contraseña incorrectos.', 'USER_DISABLED': 'Cuenta deshabilitada.' };

  // ============================================================
  // CLIENTE REST (COMPATIBLE CON EL SDK)
  // ============================================================

  const buildFirebaseUrl = operacion => `https://identitytoolkit.googleapis.com/v1/accounts:${operacion}?key=${CLAVE_API_FIREBASE}`;

  async function postFirebase(operacion, cuerpo) {
    const respuesta = await fetch(buildFirebaseUrl(operacion), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const datos = await respuesta.json();
    // Mismo formato de error que el SDK ({ code }) para reutilizar las tablas de mensajes.
    if (datos.error) throw { code: datos.error.message };
    return datos;
  }

  function buildUser(datos, extras) {
    return Object.assign({ uid: datos.localId, email: datos.email, displayName: datos.displayName || '', emailVerified: datos.emailVerified || false,
      _idToken: datos.idToken, _refreshToken: datos.refreshToken,
      sendEmailVerification: () => postFirebase('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: datos.idToken }) }, extras);
  }

  const firebaseAuth = {
    _oyentes: [],
    currentUser: null,
    onAuthStateChanged(oyente) { this._oyentes.push(oyente); oyente(this.currentUser); },
    _notify() { this._oyentes.forEach(oyente => oyente(this.currentUser)); },
    async createUserWithEmailAndPassword(correo, clave) {
      const datos = await postFirebase('signUp', { email: correo, password: clave, returnSecureToken: true });
      const usuario = buildUser({ ...datos, displayName: '', emailVerified: false }, {
        updateProfile: perfil => postFirebase('update', { idToken: datos.idToken, displayName: perfil.displayName, returnSecureToken: false })
          .then(() => { usuario.displayName = perfil.displayName; })
      });
      this.currentUser = usuario;
      this._notify();
      return { user: usuario };
    },
    async signInWithEmailAndPassword(correo, clave) {
      const datos = await postFirebase('signInWithPassword', { email: correo, password: clave, returnSecureToken: true });
      const usuario = buildUser(datos, {});
      this.currentUser = usuario;
      this._notify();
      return { user: usuario };
    },
    signOut() { this.currentUser = null; this._notify(); return Promise.resolve(); }
  };
  const firebase = { auth() { return firebaseAuth; } };

  // ============================================================
  // ACCIONES DE LA PANTALLA DE AJUSTES
  // ============================================================

  const inputValue = id => (document.getElementById(id) || {}).value || '';

  // Validamos antes de llamar a Firebase para dar el mensaje en español y ahorrar la petición.
  function validateRegistration(nombre, correo, clave) {
    if (!nombre.trim()) return 'Escribe tu nombre';
    if (!correo.trim()) return 'Escribe tu correo';
    if (clave.length < LARGO_MINIMO_CLAVE) return 'La contraseña debe tener al menos 6 caracteres';
    return null;
  }

  function registerAccount() {
    const nombre = inputValue('authname'), correo = inputValue('authemail'), clave = inputValue('authpass');
    const problema = validateRegistration(nombre, correo, clave);
    if (problema) { toast(problema); return; }
    toast('Creando cuenta…');
    firebase.auth().createUserWithEmailAndPassword(correo, clave).then(credencial => {
      // Nombre y correo de verificación son extras: si fallan, la cuenta ya quedó creada igual.
      credencial.user.updateProfile({ displayName: nombre.trim() }).catch(error => console.warn('[Telón] No se guardó el nombre', error));
      credencial.user.sendEmailVerification().catch(error => console.warn('[Telón] No se envió la verificación', error));
      store.set('loginProvider', { provider: 'email', name: nombre.trim(), email: credencial.user.email, verified: false, idToken: credencial.user._idToken });
      toast('Cuenta creada. Revisa tu correo para verificar.');
      render();
    }).catch(error => toast(MENSAJES_REGISTRO[error.code] || error.message || 'Error al crear cuenta'));
  }

  function loginWithEmail() {
    const correo = inputValue('authemail'), clave = inputValue('authpass');
    if (!correo.trim() || !clave) { toast('Escribe correo y contraseña'); return; }
    toast('Iniciando sesión…');
    firebase.auth().signInWithEmailAndPassword(correo, clave).then(credencial => {
      const usuario = credencial.user;
      store.set('loginProvider', { provider: 'email', name: usuario.displayName || correo.split('@')[0], email: usuario.email, verified: usuario.emailVerified, idToken: usuario._idToken });
      toast('Sesión iniciada como ' + (usuario.displayName || usuario.email));
      render();
    }).catch(error => toast(MENSAJES_INGRESO[error.code] || error.message || 'Error al iniciar sesión'));
  }

  function resendVerification() {
    const usuario = firebase.auth().currentUser;
    if (!usuario) return;
    usuario.sendEmailVerification()
      .then(() => toast('Correo de verificación enviado'))
      .catch(() => toast('Espera un momento antes de reenviar'));
  }

  function checkVerification() {
    const sesion = store.get('loginProvider', null);
    if (!sesion || !sesion.idToken) return;
    toast('Comprobando…');
    postFirebase('lookup', { idToken: sesion.idToken }).then(datos => {
      if (!datos.users || !datos.users[0]) return;
      sesion.verified = datos.users[0].emailVerified || false;
      store.set('loginProvider', sesion);
      toast(sesion.verified ? '¡Tu correo está verificado!' : 'Aún no verificado. Revisa tu correo.');
      render();
    }).catch(() => toast('No se pudo comprobar. Intenta iniciar sesión de nuevo.'));
  }

  function logout() {
    firebase.auth().signOut();
    store.set('loginProvider', null);
    toast('Sesión cerrada');
    render();
  }

  Telon.auth = { firebase, postFirebase, validateRegistration, registerAccount, loginWithEmail, resendVerification, checkVerification, logout };
})(window.Telon = window.Telon || {});
