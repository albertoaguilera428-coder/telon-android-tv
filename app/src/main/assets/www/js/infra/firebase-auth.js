/*
Telón - Cliente de Firebase Authentication (REST)
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

En lugar del SDK de Firebase (pesado para un WebView de TV) hablamos directo con la API
REST de Identity Toolkit (ver docs/decisiones/0002). El objeto `firebase` es un Adapter:
imita solo la parte del SDK que usamos, así que cambiarlo por el SDK real no obliga a
tocar los casos de uso ni las pantallas.
*/
(function (Telon) {
  'use strict';

  const { politeFetch } = Telon.infra.http;

  // ============================================================
  // CONSTANTES
  // ============================================================

  // La clave de API web de Firebase es pública por diseño: lo que protege la cuenta son las
  // reglas y restricciones del proyecto en la consola de Firebase, no esconder esta clave.
  const CLAVE_API_FIREBASE = 'AIzaSyBuT4FxjE8LYRasc5EOjFGcdgZb3IToK7E';
  // ============================================================
  // CLIENTE REST (COMPATIBLE CON EL SDK)
  // ============================================================

  const buildFirebaseUrl = operacion => `https://identitytoolkit.googleapis.com/v1/accounts:${operacion}?key=${CLAVE_API_FIREBASE}`;

  async function postFirebase(operacion, cuerpo) {
    const respuesta = await politeFetch(buildFirebaseUrl(operacion), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
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
    currentUser: null,
    async createUserWithEmailAndPassword(correo, clave) {
      const datos = await postFirebase('signUp', { email: correo, password: clave, returnSecureToken: true });
      const usuario = buildUser({ ...datos, displayName: '', emailVerified: false }, {
        updateProfile: perfil => postFirebase('update', { idToken: datos.idToken, displayName: perfil.displayName, returnSecureToken: false })
          .then(() => { usuario.displayName = perfil.displayName; })
      });
      this.currentUser = usuario;
      return { user: usuario };
    },
    async signInWithEmailAndPassword(correo, clave) {
      const datos = await postFirebase('signInWithPassword', { email: correo, password: clave, returnSecureToken: true });
      const usuario = buildUser(datos, {});
      this.currentUser = usuario;
      return { user: usuario };
    },
    signOut() { this.currentUser = null; return Promise.resolve(); }
  };
  const firebase = { auth() { return firebaseAuth; } };

  Telon.infra.firebaseAuth = { firebase, postFirebase };
})(window.Telon = window.Telon || {});
