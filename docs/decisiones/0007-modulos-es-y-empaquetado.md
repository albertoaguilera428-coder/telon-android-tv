# 0007 · Módulos ES en el código y un solo archivo en lo que se instala

**Fecha:** 2026-11-04 · **Estado:** aceptada (reemplaza la parte de "scripts clásicos" de 0001)

## Contexto

La decisión 0001 eligió scripts clásicos que comparten `window.Telon`, con el orden fijo
en `index.html`, y dejó escrito que se revisaría si mantener el orden a mano empezaba a
doler. Con 42 módulos dolía: cada archivo nuevo había que ubicarlo a mano en la lista,
y las dependencias de cada módulo no se veían en el propio módulo.

Los módulos ES siguen sin poder cargarse desde `file://`, que es como el WebView de
Android y el televisor Samsung abren la app.

## Alternativas consideradas

1. Seguir con scripts clásicos: sin cambios, pero el problema crece con cada módulo.
2. Servir la app desde un origen `https` local de Android (`WebViewAssetLoader`): los
   módulos funcionan sin empaquetar, pero lo guardado (perfiles, lista, historial) está
   atado al origen `file://` y habría que migrarlo en cada aparato; si la migración falla,
   el usuario pierde todo. Samsung igual necesitaría empaquetar.
3. Módulos ES en el código y esbuild para juntarlos en un solo `telon.js` al compilar.

## Decisión

Opción 3. El código vive en `web/` con `import`/`export`. `scripts/empaquetar-web.mjs`
arma la app instalable (un `telon.js` sin minificar, rebajado a Chromium 85); Gradle lo
corre antes de armar el APK (tarea `empaquetarWeb`) y `build-tizen.mjs` lo usa para el
`.wgt`. En desarrollo `web/index.html` carga `js/main.js` como módulo.

## Consecuencias

- Cada módulo declara lo que usa. `test/unit/arquitectura.test.js` revisa las capas por
  los `import`, que no haya ciclos y que todo se alcance desde `main.js`.
- Compilar el APK necesita Node y haber corrido `npm ci` (ya hacía falta para las
  pruebas). El paquete no se guarda en git: se genera en cada build.
- Lo que se instala es un solo archivo; las pruebas visuales prueban ese paquete.
- jsdom no ejecuta módulos: `test/support/app-driver.js` carga cada módulo como función,
  cambiando sus `import` y `export` sin mover ninguna posición del archivo, para que la
  cobertura y los errores sigan apuntando a la línea real. Por eso los `import` van en
  una sola línea y no se usa `export default` (lo revisa la prueba de arquitectura).
- Cada módulo conserva `'use strict'`: en un módulo ES sobra, pero el cargador de las
  pruebas los ejecuta como funciones y así se comportan igual que en el navegador.
- No cambia nada para los usuarios: la app sigue cargando desde `file://`, con los mismos
  datos guardados. Quitar `setAllowFileAccessFromFileURLs` (opción 2) queda como mejora
  aparte, con su migración de datos.
