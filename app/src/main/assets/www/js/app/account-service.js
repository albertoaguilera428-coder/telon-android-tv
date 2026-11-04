/*
Telón - Casos de uso: cuenta
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Registro, inicio de sesión, verificación y cierre. Valida con las reglas del dominio,
habla con Firebase por el adaptador de infraestructura y guarda la sesión en su
repositorio. Devuelve mensajes en español listos para mostrar.
*/
(function (Telon) {
  'use strict';

  const { logIgnored } = Telon.infra.log;
  const { firebase, postFirebase } = Telon.infra.firebaseAuth;
  const { validateRegistration, validateLogin } = Telon.domain.account;
  const { sesion } = Telon.app.state;

  // ============================================================
  // MENSAJES
  // ============================================================

  const DEMASIADOS_INTENTOS = 'Demasiados intentos. Espera unos minutos antes de volver a intentar.';
  const MENSAJES_REGISTRO = { 'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Inicia sesión.', 'auth/invalid-email': 'Correo no válido.',
    'auth/weak-password': 'Contraseña muy débil.', 'EMAIL_EXISTS': 'Ese correo ya tiene cuenta. Inicia sesión.', 'INVALID_EMAIL': 'Correo no válido.',
    'WEAK_PASSWORD': 'Contraseña muy débil (mín. 6 caracteres).', 'OPERATION_NOT_ALLOWED': 'Registro deshabilitado.',
    // Firebase limita los intentos por su cuenta; lo único que nos toca es explicarlo y no insistir.
    'TOO_MANY_ATTEMPTS_TRY_LATER': DEMASIADOS_INTENTOS };
  const MENSAJES_INGRESO = { 'auth/user-not-found': 'No hay cuenta con ese correo.', 'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'EMAIL_NOT_FOUND': 'No hay cuenta con ese correo.', 'INVALID_PASSWORD': 'Contraseña incorrecta.',
    'INVALID_LOGIN_CREDENTIALS': 'Correo o contraseña incorrectos.', 'USER_DISABLED': 'Cuenta deshabilitada.',
    'TOO_MANY_ATTEMPTS_TRY_LATER': DEMASIADOS_INTENTOS };

  // Resultado uniforme para la pantalla: { ok, mensaje }.
  const ok = mensaje => ({ ok: true, mensaje });
  const failure = mensaje => ({ ok: false, mensaje });

  // ============================================================
  // CASOS DE USO
  // ============================================================

  async function register(nombre, correo, clave) {
    const problema = validateRegistration(nombre, correo, clave);
    if (problema) return failure(problema);
    try {
      const { user: usuario } = await firebase.auth().createUserWithEmailAndPassword(correo, clave);
      // Nombre y correo de verificación son extras: si fallan, la cuenta ya quedó creada igual.
      usuario.updateProfile({ displayName: nombre.trim() }).catch(error => logIgnored('No se guardó el nombre', error));
      usuario.sendEmailVerification().catch(error => logIgnored('No se envió la verificación', error));
      sesion.save({ provider: 'email', name: nombre.trim(), email: usuario.email, verified: false, idToken: usuario._idToken });
      return ok('Cuenta creada. Revisa tu correo para verificar.');
    } catch (error) {
      return failure(MENSAJES_REGISTRO[error.code] || error.message || 'Error al crear cuenta');
    }
  }

  async function login(correo, clave) {
    const problema = validateLogin(correo, clave);
    if (problema) return failure(problema);
    try {
      const { user: usuario } = await firebase.auth().signInWithEmailAndPassword(correo, clave);
      sesion.save({ provider: 'email', name: usuario.displayName || correo.split('@')[0], email: usuario.email, verified: usuario.emailVerified, idToken: usuario._idToken });
      return ok('Sesión iniciada como ' + (usuario.displayName || usuario.email));
    } catch (error) {
      return failure(MENSAJES_INGRESO[error.code] || error.message || 'Error al iniciar sesión');
    }
  }

  // Solo hay usuario en memoria si se registró o ingresó en esta misma sesión de la app.
  async function resendVerification() {
    const usuario = firebase.auth().currentUser;
    if (!usuario) return null;
    try {
      await usuario.sendEmailVerification();
      return ok('Correo de verificación enviado');
    } catch (error) {
      logIgnored('Firebase no reenvió la verificación', error);
      return failure('Espera un momento antes de reenviar');
    }
  }

  async function refreshVerification() {
    const datos = sesion.get();
    if (!datos || !datos.idToken) return null;
    try {
      const respuesta = await postFirebase('lookup', { idToken: datos.idToken });
      if (!respuesta.users || !respuesta.users[0]) return null;
      datos.verified = respuesta.users[0].emailVerified || false;
      sesion.save(datos);
      return ok(datos.verified ? '¡Tu correo está verificado!' : 'Aún no verificado. Revisa tu correo.');
    } catch (error) {
      // El token dura una hora y no lo renovamos (docs/decisiones/0002): pedimos volver a ingresar.
      logIgnored('No se pudo comprobar la verificación', error);
      return failure('No se pudo comprobar. Intenta iniciar sesión de nuevo.');
    }
  }

  async function logout() {
    await firebase.auth().signOut();
    sesion.clear();
    return ok('Sesión cerrada');
  }

  Telon.app.accountService = { register, login, resendVerification, refreshVerification, logout };
})(window.Telon = window.Telon || {});
