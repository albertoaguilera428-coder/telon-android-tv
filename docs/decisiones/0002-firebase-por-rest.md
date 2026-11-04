# 0002 · Cuentas con la API REST de Firebase, sin el SDK

**Fecha:** 2026-11-04 · **Estado:** aceptada (decisión previa al refactor, registrada ahora)

## Contexto

La app necesita registro, inicio de sesión y verificación de correo. El SDK web de
Firebase Authentication pesa varios cientos de KB y carga más código del que usamos,
algo que se nota en un WebView de televisor.

## Alternativas consideradas

1. **SDK oficial de Firebase:** completo, renueva tokens solo, pero pesado.
2. **API REST de Identity Toolkit** con un objeto que imita la parte del SDK que usamos.

## Decisión

Opción 2 (`js/infra/firebase-auth.js`, con los casos de uso en `js/app/account-service.js`).
El objeto `firebase` expone los mismos nombres que el SDK
(`createUserWithEmailAndPassword`, `currentUser`, …).

## Consecuencias

- Cambiar al SDK real no obliga a tocar las pantallas.
- **Pendiente conocido:** no renovamos el `idToken` (dura una hora); la sesión guardada
  sirve para mostrar la cuenta, pero una llamada que necesite token fresco fallará.
  Si se agregan funciones que lo requieran, hay que implementar la renovación o pasar al SDK.
- La clave de API web es pública por diseño; la seguridad depende de las reglas y
  restricciones del proyecto en la consola de Firebase.
