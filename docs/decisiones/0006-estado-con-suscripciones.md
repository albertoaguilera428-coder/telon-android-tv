# 0006 · El estado cambia en un solo lugar y avisa a quien repinta

**Fecha:** 2026-11-04 · **Estado:** aceptada

## Contexto

Cada acción cambiaba `estado.x = …` y después llamaba a mano a `render()`, `homeBody()` o
`renderDetail()`. Había más de 40 llamadas repartidas en siete archivos. Olvidar una dejaba
la pantalla vieja y poner una de más tenía costo: en TV `render()` devuelve el foco a la
pestaña activa, y con la ficha abierta lo mandaría detrás de ella. Además `homeBody()`
escribía en el estado mientras pintaba.

## Alternativas consideradas

1. Seguir con llamadas a mano: sin cambios, pero el problema crece con cada pantalla.
2. Una biblioteca (Redux, MobX, signals): resuelve el problema, pero suma una dependencia y
   un paso de compilación a una app que hoy corre tal cual en Chromium 85.
3. Un estado propio con `updateState(cambios)` y `subscribe(oyente)`: unas 20 líneas.

## Decisión

Opción 3. `app/state.js` expone el estado de solo lectura (escribir lanza un error) y
`updateState` avisa una vez por llamada con las claves que de verdad cambiaron. `main.js`
tiene la única suscripción: una tabla que dice qué repinta cada clave (pantalla, cuerpo del
inicio o ficha). Pintar nunca cambia el estado.

## Consecuencias

- Cambiar el estado ya repinta lo correcto; quien agrega una pantalla agrega sus claves a
  la tabla y no reparte llamadas.
- `test/unit/repintado.test.js` cuida lo que no debe repintarse: la pantalla de abajo con la
  ficha abierta y cualquier cosa mientras se reproduce.
- Perfiles, preferencias y cuenta siguen en repositorios (localStorage) y se repintan a
  mano después de cambiarlos: son pocos lugares y moverlos al estado no aportaba.
- El reproductor se pinta solo (`ui/player-view.js`): su objeto cambia por dentro muchas
  veces por segundo y no conviene avisar a nadie en cada cambio.
