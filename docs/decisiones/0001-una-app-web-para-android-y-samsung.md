# 0001 · Una sola app web para Android y Samsung, en scripts clásicos

**Fecha:** 2026-11-04 · **Estado:** aceptada; la parte de "scripts clásicos" la reemplaza [0007](0007-modulos-es-y-empaquetado.md)

## Contexto

Telón tiene que funcionar en celulares, tablets y Android TV (APK) y en televisores
Samsung, que usan Tizen y no instalan APKs. Toda la interfaz ya era una página web
dentro de un WebView. El código vivía en un solo `app.js` de unas 1.350 líneas.

## Alternativas consideradas

1. **Una app nativa por plataforma.** Duplica toda la lógica y hay que mantener dos o
   tres versiones de cada cambio.
2. **Módulos ES (`<script type="module">`).** Android carga la página desde `file://`,
   donde los módulos chocan con CORS, y los Samsung anteriores a Tizen 5.0 no los
   soportan.
3. **Un bundler (webpack, Rollup).** Agrega una compilación obligatoria también en
   Android, solo para resolver el orden de carga, que se puede escribir a mano.
4. **Scripts clásicos que comparten `window.Telon`, con el orden fijo en `index.html`.**

## Decisión

Opción 4. Un adaptador (`js/infra/platform.js`) aísla lo que cambia entre sistemas: puente
de Android, teclas de Tizen y viewport. Para Samsung, `scripts/build-tizen.mjs` rebaja
la sintaxis con esbuild (objetivo Chromium 85, Tizen 6.5) sin empaquetar los archivos.

## Consecuencias

- El mismo código y las mismas pruebas sirven para las dos plataformas.
- El orden de los `<script>` importa: un módulo solo puede usar a los anteriores. Si
  aparece un ciclo, el diseño de los límites está mal y hay que revisarlo.
- Samsung de 2020 o anteriores (Tizen < 6.5) quedan fuera (actualizado el 2026-11-04 con el
  rediseño, que usa `gap` en flexbox). Volver a incluirlos exige respaldos con márgenes.
- Si algún día la app crece lo suficiente como para que mantener el orden a mano
  duela, se revisa la opción 3.
