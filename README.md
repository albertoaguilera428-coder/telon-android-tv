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

Monolito en capas (ver [0005](docs/decisiones/0005-arquitectura-en-capas.md)):

```
app/src/main/
├── java/app/telon/tv/   MainActivity (WebView + puente TelonBridge) y PlaybackRules
└── assets/www/
    ├── index.html       esqueleto y orden de carga
    └── js/
        ├── infra/       plataforma, http (429, tope y tiempos), errores, almacenamiento,
        │                caché, protocolo de addons, Narto, SoloLatino, Firebase
        ├── domain/      reglas puras: países, episodios, catálogo, progreso, cuenta,
        │                orden de fuentes y sesión de reproducción
        ├── app/         estado y repositorios; casos de uso de catálogo, reproducción,
        │                cuenta y actualización
        ├── ui/          pantallas, reproductor, control remoto, componentes
        └── main.js      tabla de acciones y arranque
```

| Capa | Puede usar | No puede usar |
|---|---|---|
| dominio | otras reglas del dominio | DOM, red, almacenamiento, reloj |
| infraestructura | otra infraestructura | dominio, aplicación, pantallas |
| aplicación | dominio, infraestructura | DOM, pantallas |
| presentación | aplicación, dominio; de infraestructura solo plataforma, registro y tipos de error | red, almacenamiento |

`test/unit/arquitectura.test.js` hace cumplir esta tabla y el orden de carga. Son scripts
clásicos que comparten `window.Telon`; el orden está en `index.html`.

**Patrones en uso** (solo donde resuelven algo):

- *Adapter* con polimorfismo: `infra/platform.js` arma un adaptador por sistema (Android,
  Samsung, navegador) con el mismo contrato; nadie pregunta en cuál está.
  `infra/firebase-auth.js` imita el SDK.
- *Repository*: perfiles, preferencias, sesión, lista e historial en `app/state.js`.
- *Command*: tablas `data-act` y `data-p` (`main.js`, `ui/player.js`) en lugar de cadenas de `if`.
- *Registro de addons virtuales*: cada sitio se registra en `infra/addon-client.js` y responde
  como un addon (abierto a agregar sitios sin tocar el cliente).
- *Facade*: los servicios de `app/` esconden protocolo, sitios y almacenamiento a las pantallas.

No se usan Singleton (las dependencias se toman explícitas del espacio de nombres), State
(el reproductor tiene tres estados simples) ni Observer (no hay suscriptores múltiples).

Las decisiones difíciles de revertir están en [docs/decisiones/](docs/decisiones/):
[0001](docs/decisiones/0001-una-app-web-para-android-y-samsung.md) una app web para Android
y Samsung, [0002](docs/decisiones/0002-firebase-por-rest.md) Firebase por REST,
[0003](docs/decisiones/0003-firma-propia-del-release.md) firma propia del release,
[0004](docs/decisiones/0004-sin-kafka-ni-broker-de-eventos.md) sin Kafka ni broker de eventos,
[0005](docs/decisiones/0005-arquitectura-en-capas.md) arquitectura en capas.

**Cómo está escrito el código** (guía, secciones 21 a 24):

- *Objetos donde hay reglas que proteger:* la sesión de reproducción
  (`domain/playback-session.js`) solo cambia por sus métodos, que cuidan los límites. Los
  datos se leen pero no se asignan desde afuera. La herencia se usa solo en los tipos de
  error (`infra/errors.js`), donde "es un Error" es cierto.
- *Funciones puras en el dominio:* reciben datos y devuelven datos, sin DOM, red ni reloj
  (la hora llega como parámetro). El estado compartido se actualiza creando copias (lista,
  historial, filtros, addons), nunca cambiando el objeto que otro puede estar leyendo.
  `test/unit/funcional.test.js` lo comprueba con datos congelados.
- *Errores:* tipados y con su causa (`HttpError`, `TimeoutError`, `RateLimitError`…); al
  usuario solo le llegan mensajes pensados para él (`userMessageFor`), nunca textos internos.
  Lo que nadie atrapa termina en una frontera global en `main.js` que lo registra y avisa.
- *Closures:* los temporizadores del reproductor se registran y se liberan al cerrarlo; el
  índice de tarjetas se vacía en cada pintado.

**Límites de consumo y concurrencia:** Telón no expone ninguna API; consume la de addons,
sitios y Firebase, siempre a través de `infra/http.js`:

- Si un servidor responde `429` se respeta su `Retry-After` (30 s si no lo indica, 10 min
  como máximo) y no se le pide nada más hasta entonces. No hay reintentos automáticos.
- Como máximo 8 peticiones simultáneas; el resto espera en una cola de hasta 100 y, si se
  llena, se rechaza. Medido con los addons de ejemplo, el arranque llega a 7 y una búsqueda
  a 5, así que en el caso normal no hay espera.
- Toda petición se corta a los 15 s (60 s para fuentes de video).
- Las cachés de los sitios tienen tope (100 entradas, 10 min) y descartan lo menos usado.
- Cargas que se pisan (inicio, búsqueda, recarga de addons, ficha, reproductor) se
  descartan con un número de secuencia o token: siempre gana la última.
- La búsqueda espera 350 ms a que se deje de escribir antes de consultar.

**Caché** (guía, sección 25): `infra/cache.js`, usada por SoloLatino y Narto con el patrón
cache-aside (se consulta, y si falta se descarga y se guarda).

- *Fuente de verdad:* los sitios y addons. La caché solo evita repetir descargas; lista,
  historial y perfiles **no** son caché, son datos del usuario en el dispositivo.
- *Frescura:* 10 minutos, porque los catálogos cambian poco. "Recargar addons" vacía las cachés
  (invalidación explícita) y trae contenido nuevo.
- *Claves:* incluyen todo lo que cambia el resultado (por ejemplo, tipo y slug en una ficha:
  `/pelicula/x` y `/serie/x` son páginas distintas).
- *Estampida:* una sola carga por clave. Una búsqueda pedía la misma página 4 veces (una por
  catálogo de SoloLatino); ahora la pide 1 vez y los cuatro reciben el resultado.
- *Errores:* no se guardan; el siguiente pedido vuelve a intentar.
- *Tamaño:* 100 entradas por sitio; al llenarse se descarta lo usado hace más tiempo (LRU).
- *Valores congelados:* todos reciben el mismo objeto y nadie puede modificarlo para los demás.
- *Métricas:* `Telon.infra.sololatino.cacheStats()` y `Telon.infra.narto.cacheStats()`
  (aciertos, fallos, descartes, cargas compartidas) desde `chrome://inspect`.

No se usan, a propósito:

- *Jitter en el vencimiento:* cada dispositivo vence a su propio ritmo, desde que abrió la
  app; no hay un servidor que reciba todas las recargas juntas.
- *stale-while-revalidate:* el contenido no es tan urgente como para justificarlo.
- *Caché persistente:* guardar páginas en localStorage lo llenaba (ver la corrección del punto 18).

Lo que viene de addons Stremio queda en la caché HTTP del WebView según los
`Cache-Control` que envía cada addon. `version.json` se pide con `?t=` para no recibir una
versión vieja. No hay cachés compartidas entre usuarios ni CDN, y nada personal pasa por
una caché.

**Rendimiento:** todo lo que depende de la cantidad de contenido es lineal (pintar el
inicio, filtrar y mover el foco con el control, que recorre los elementos enfocables);
no hay recorridos cuadráticos. Medido con `node scripts/medir-rendimiento.mjs` en
Chromium headless (AMD EPYC, 2 núcleos):

| Carga | Pintar inicio | Filtrar | Mover foco (por tecla) |
|---|---|---|---|
| 200 tarjetas | 2,2 ms | 1,7 ms | 0,9 ms |
| 2.000 tarjetas | 20 ms | 17 ms | 6,6 ms (p95 17 ms) |

Un televisor es de 5 a 10 veces más lento: con la carga normal (200–400 tarjetas) sobra
margen. Si los catálogos crecen a miles de tarjetas o se nota demora en el control, lo
primero es limitar `moveTvFocus` a los elementos cercanos a la pantalla. Antes de
optimizar, medir con este mismo script.

**No renombrar sin migración:** las claves de `localStorage` y los campos guardados de
historial, lista y perfiles (ahí están los datos de los usuarios), los campos del
protocolo Stremio y los nombres del puente (`TelonBridge`, `window._tvKey`,
`window.telonBack`).

## Seguridad

El riesgo principal es el contenido de los addons, que son de terceros: títulos, pósters
o géneros armados para inyectar código (XSS). Defensas:

- Todo texto pasa por `escapeHTML` y toda URL por `safeUrl` o `cssUrl` (`js/ui/dom.js`):
  solo `http(s)`, `data:image` o `blob`, y dentro de `url()` va codificada.
- No hay manejadores inline (`onerror="…"`). Las imágenes rotas usan `data-fallback`.
- Content Security Policy en `index.html`: solo scripts propios, sin JavaScript inline ni `eval`.
- `test/e2e/seguridad.test.js` recorre todas las pantallas con un addon malicioso.
- El puente de Android solo lo ve la página principal; el WebView de los embeds no lo
  tiene. Los enlaces externos solo pueden ser `http(s)`.

| Riesgo (OWASP 2025) | En Telón |
|---|---|
| SQL injection | No aplica: no hay base de datos; localStorage se usa con claves fijas. |
| CSRF | No aplica: no hay servidor propio. Firebase recibe el token en el cuerpo, no por cookie. |
| Control de acceso / IDOR | Las cuentas las controla Firebase. Los perfiles del dispositivo no son un límite de seguridad: no tienen PIN (el campo `pin` existe vacío). Agregarlo es decisión del producto. |
| Autenticación | Firebase guarda y protege las contraseñas y limita los intentos. La app nunca registra tokens en la consola. Cerrar sesión borra el token del dispositivo, pero Firebase no permite revocarlo desde la app: sigue válido hasta su vencimiento (1 h). |

**Datos y cifrado:**

- No se guardan contraseñas ni hay cifrado propio.
- Las fotos de perfil se guardan como Base64 (`data:`), que es una codificación, no una
  protección. Se reducen a 256 px para que entren en el almacenamiento.
- Firebase y los addons predeterminados van por HTTPS. HTTP queda permitido solo porque
  hay addons en la red local (`http://192.168.…`).
- La validación de certificados nunca se desactiva; el lint estricto de Android lo vigila.
- Pendiente conocido: con `allowBackup` la copia de seguridad de Android incluye el
  almacenamiento de la app (y con él, el token de sesión).

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

## Cómo contribuir

- **Ramas** cortas desde `master`, una por tarea (`mejora/…`, `corrige/…`); se borran al integrarse.
- **Commits** coherentes y en imperativo: `Agrega límite de solicitudes por cliente`.
  Formato, refactor y funcionalidad van en commits separados. Nunca secretos ni
  `keystore.properties`.
- **Pull requests** con la plantilla de `.github/`: problema, solución, pruebas, riesgos
  y qué documento deja de ser verdad. El CI tiene que pasar.
- **Merge** con merge commit, para conservar los commits de la rama. Se puede hacer
  **rebase** solo sobre una rama propia que nadie más usa; nunca sobre `master` ni sobre
  una rama compartida.
- **Conflictos:** se resuelven entendiendo ambos lados y luego se corre `npm test`.

Responsable del código y la documentación: Albert Alvear (ver `.github/CODEOWNERS`).
