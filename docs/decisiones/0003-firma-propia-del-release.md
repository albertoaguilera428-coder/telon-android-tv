# 0003 · El release se firma con una clave propia, no con la de debug

**Fecha:** 2026-11-04 · **Estado:** aceptada

## Contexto

El APK de release se firmaba con `~/.android/debug.keystore`, cuya contraseña es
pública (`android`). Cualquiera podía firmar un APK "actualización" de Telón y Android
lo aceptaría encima del original.

## Alternativas consideradas

1. Seguir con la clave de debug: cero fricción, cero protección.
2. Clave propia leída de `keystore.properties` (fuera de git).
3. Play App Signing: solo si la app se publica en Google Play.

## Decisión

Opción 2. Sin `keystore.properties` el build genera `app-release-unsigned.apk` en
lugar de caer en la clave de debug.

## Consecuencias

- **Difícil de revertir:** Android no permite actualizar una app con otra firma. Quien
  tenga instalada la versión firmada con la clave de debug debe desinstalarla una vez
  (puede perder el historial y la lista guardados en el dispositivo, salvo que la copia
  de seguridad automática de Android los restaure).
- La clave y sus contraseñas se guardan fuera del repositorio, con respaldo: si se
  pierde, ninguna actualización futura podrá instalarse encima.
