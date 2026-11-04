# Telón TV

App para ver series y películas desde addons con protocolo Stremio. Un solo código web
corre en **Android** (celular, tablet y Android TV, dentro de un WebView) y en
**televisores Samsung** (app Tizen `.wgt`).

## Requisitos

- Node.js 20 o superior (pruebas, lint y empaquetado para Samsung).
- JDK 21 y Android SDK 34 para el APK. Gradle 8.9 no corre con JDK 25.
- Para Samsung: Tizen Studio con *TV Extensions* y *Samsung Certificate Extension*.

```bash
npm ci
npx playwright-core install chromium   # solo para las pruebas de interfaz
echo "sdk.dir=$HOME/Android/Sdk" > local.properties
```

## Ejecutar

| Qué | Comando | Resultado |
|---|---|---|
| APK de desarrollo | `./gradlew assembleDebug` | `app/build/outputs/apk/debug/app-debug.apk` |
| APK de release | `./gradlew assembleRelease` | firmado si existe `keystore.properties` (ver abajo) |
| Paquete Samsung | `npm run build:tizen` | `build/tizen/` y `build/Telon-sin-firmar.wgt` |

Para probar la interfaz en el navegador alcanza con servir
`app/src/main/assets/www/` con cualquier servidor estático. Sin puente de Android se
abre la interfaz táctil.

## Pruebas

```bash
npm test                 # lint + unitarias + aceptación + flujo/interfaz
npm run coverage         # cobertura (señal para encontrar huecos, no una meta)
npm run mutation         # Stryker sobre la lógica de mayor riesgo (tarda ~15 min)
./gradlew lintDebug testDebugUnitTest
```

- `test/unit/`: lógica pura, con propiedades (fast-check) donde hay invariantes.
- `features/`: escenarios Gherkin. Los marcados como "derivados del comportamiento
  actual" están pendientes de validar con el responsable del producto.
- `test/e2e/flujo.test.js`: recorre la app completa y compara cada paso con
  `test/e2e/golden/`. Si un cambio de interfaz es intencional, se regenera con
  `UPDATE_GOLDEN=1 npm run test:e2e` y el diff se revisa en el PR.
- `test/e2e/visual.test.js`: Chromium en tamaños de celular, tablet, Android TV y
  Samsung; deja capturas en `build/capturas/`.

El pipeline (`.github/workflows/`) corre todo esto, más CodeQL y `npm audit`. La
mutación corre una vez por semana.

## Arquitectura

```
app/src/main/
├── java/app/telon/tv/   MainActivity (WebView + puente TelonBridge) y PlaybackRules
└── assets/www/
    ├── index.html       esqueleto y orden de carga de los módulos
    └── js/
        ├── platform.js      Android / Samsung / navegador (el único que sabe dónde corre)
        ├── util.js, icons.js, polyfills.js
        ├── addon-client.js  protocolo Stremio y registro de addons virtuales
        ├── addons/          Narto Drama y SoloLatino (sitios sin servidor Stremio)
        ├── state.js         estado de la interfaz y datos guardados
        ├── ui/              componentes, inicio, pantallas, ficha, reproductor, control remoto
        ├── auth.js, update.js
        └── main.js          tabla de acciones y arranque
```

Son scripts clásicos que comparten `window.Telon`. Cada uno usa solo a los que se
cargaron antes; el orden está en `index.html`. La razón está en
[docs/decisiones/0001](docs/decisiones/0001-una-app-web-para-android-y-samsung.md).

**No renombrar sin migración:** las claves de `localStorage` y los campos guardados de
historial, lista y perfiles (ahí están los datos de los usuarios), los campos del
protocolo Stremio y los nombres del puente (`TelonBridge`, `window._tvKey`,
`window.telonBack`).

## Firma del APK de release

El release ya no se firma con la clave de debug, que es pública. Crea
`keystore.properties` en la raíz del proyecto. Está en `.gitignore`: nunca lo subas.

```properties
storeFile=telon-release.jks
storePassword=…
keyAlias=telon
keyPassword=…
```

> Quien tenga instalada una versión firmada con la clave de debug tendrá que
> desinstalarla antes de instalar la firmada con la clave nueva: Android no acepta
> una actualización con otra firma.

## Samsung (Tizen)

Requisitos del televisor y del equipo:

1. **TV Samsung de 2020 en adelante (Tizen 5.5 o superior)**, en la misma red que el
   computador.
2. **Modo desarrollador**: en la TV, abre *Apps*, marca `1 2 3 4 5` con el control,
   activa *Developer mode*, escribe la IP del computador y reinicia la TV.
3. En Tizen Studio, en *Device Manager*, agrega la TV por IP (puerto 26101).
4. En *Certificate Manager* crea un perfil **Samsung** con la TV ya conectada: así el
   DUID del televisor queda dentro del certificado de distribuidor. Necesitas una
   cuenta de Samsung. Los certificados vencen; si la instalación falla con
   "certificate expired", renuévalos.

Empaquetar, firmar e instalar:

```bash
TIZEN_PROFILE=MiPerfil npm run build:tizen
tizen install -n build/Telon.wgt -t <nombre-de-la-tv>
```

Diferencias con Android: el control remoto se traduce en `platform.js`. Las fuentes
"embed" de SoloLatino no se ofrecen, porque solo MainActivity puede capturar su video;
se usan las fuentes directas. Las actualizaciones se hacen reinstalando el `.wgt`.
