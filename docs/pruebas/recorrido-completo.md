# Recorrido completo: una persona que abre Telón por primera vez

Este recorrido sigue a una persona nueva desde que instala la app hasta que usó todas sus
funciones. Sirve para dos cosas:

- **Prueba manual en el aparato:** se sigue paso a paso y se marca lo que no se cumple.
- **Prueba automática:** cada etapa tiene su recorrido en `test/e2e/` (en Chromium, con el
  control remoto simulado con teclas físicas en TV y con toques en el celular).

Cada paso dice qué hace la persona y qué tiene que pasar. Las marcas indican dónde aplica:
**[TV]** Android TV y Samsung con control remoto, **[Celular]** celular o tablet táctil,
**[Samsung]** solo televisores Samsung. Sin marca, aplica en todos.

Con el control: ↑ ↓ ← → son las flechas, **OK** es el botón central y **Atrás** el de volver.

---

## 1. Instalar y abrir por primera vez

1. Instala la app (APK en Android, `.wgt` firmado en Samsung) y la abre.
   → Aparece la pantalla **«¿Quién está viendo?»** con un solo botón: **Añadir perfil**. No
   pide registrarse: la cuenta es opcional y está en Ajustes.
2. **[TV]** Aprieta cualquier flecha.
   → El foco (anillo dorado) queda en **Añadir perfil**.
3. Elige **Añadir perfil** y escribe un nombre (por ejemplo, «Ana»).
   → Aparece la tarjeta de Ana con su inicial y un color. **[TV]** El foco sigue en la pantalla.
4. Elige el perfil de Ana.
   → Entra al **Inicio**. Mientras carga se ven siluetas grises que brillan (no una pantalla
   vacía) y aparece el aviso «Addons recargados».

## 2. Primer vistazo al Inicio

5. Espera a que cargue.
   → Se ve, de arriba abajo: la barra con **Inicio, Biblioteca, Ajustes** (en TV también
   **Buscar**), los filtros (**Todo, Series, Películas**, países y géneros), un **destacado**
   grande con «Ver ahora» y las secciones de cada catálogo con sus pósters.
6. **[TV]** Baja con ↓ desde la barra.
   → El foco pasa a los filtros, luego al destacado y luego a las tarjetas. Nunca queda
   escondido detrás de la barra.
7. **[TV]** Recorre una fila con → hasta el final.
   → Al llegar a la última tarjeta, → no hace nada (no salta a otra fila ni a la barra).
8. **[TV]** Desde una tarjeta, sube con ↑ hasta la barra.
   → Llega a la pestaña en la que está (**Inicio**), no a otra.
9. **[Celular]** Desliza las filas de lado y la página hacia abajo.
   → Todo se desplaza sin saltos; la barra inferior queda fija.

## 3. Filtrar

10. Elige el filtro de un país (por ejemplo, **Corea**).
    → Solo quedan títulos de ese país; el filtro queda marcado en dorado.
11. Elige un género y luego **Películas**.
    → Los filtros se combinan; elegir de nuevo uno marcado lo quita.
12. Elige **Todo**.
    → Vuelve a verse todo el catálogo.

## 4. Buscar

13. Abre la búsqueda (**[TV]** «Buscar» en la barra; **[Celular]** la lupa arriba).
    → Aparece el campo de búsqueda, visible y con el foco. **[TV]** OK abre el teclado en pantalla.
14. Escribe parte de un título (por ejemplo, «show»).
    → Tras una pausa breve se ve «Buscando» y luego los resultados por catálogo. Si no hay
    nada, un aviso «Sin resultados» con lo que se buscó.
15. **[TV]** Baja con ↓ desde el campo.
    → El foco pasa a los resultados.
16. Cierra la búsqueda con **Atrás**.
    → Vuelve el Inicio normal, sin el campo.

## 5. Ver una serie

17. Elige una tarjeta (o «Ver ahora» en el destacado).
    → Se abre la **ficha**: imagen de fondo, póster (en tablet y TV), título, país y géneros,
    descripción, **Reproducir** y **Guardar**, y los **episodios** por temporada.
    **[TV]** El foco ya está en **Reproducir**.
18. **[TV]** Recorre la ficha con las flechas.
    → El foco nunca se va a lo que quedó detrás de la ficha.
19. Cambia de temporada.
    → Cambian los números de episodio; la temporada queda marcada en dorado.
20. Elige **Guardar**.
    → Cambia a «Guardado» y aparece el aviso «Guardado en tu lista».
21. Cierra la ficha con **Atrás** (o la flecha de volver).
    → Vuelve al Inicio. **[TV]** El foco vuelve a la tarjeta que abrió la ficha.

## 6. Reproducir

22. Abre la ficha otra vez y elige **Reproducir** (o un episodio).
    → Se abre el reproductor: «Cargando capítulo…» con el póster, luego el video. Arriba, la
    fuente en uso; a la derecha, la barra con **Guardar, Episodios, Fuentes, Subs, Sonido,
    Velocidad**; abajo, el título y el episodio. Los controles se ocultan solos a los
    segundos de empezar.
23. Pausa y reanuda (**[TV]** OK o la tecla play/pausa del control; **[Celular]** un toque
    muestra los controles y otro pausa).
    → Aparece el botón de play grande al pausar y se ven los controles.
24. **[TV]** Con los controles ocultos, aprieta → y ←.
    → Adelanta y retrocede 10 segundos. Los controles aparecen para mostrar dónde quedó.
25. **[TV]** Aprieta ↓.
    → Aparecen los controles con el foco en el primer botón de la barra lateral. Mientras
    hay foco, no se ocultan solos.
26. Elige **Sonido**.
    → Se silencia y el botón dice «Mute»; otra vez, vuelve el sonido. **[TV]** El foco se
    queda en el mismo botón.
27. Elige **Velocidad** varias veces.
    → Cambia 1x → 1.5x → 1.8x → 2x y vuelve a 1x; el botón muestra la velocidad.
28. Elige **Subs**.
    → Se abre el panel de subtítulos. **[TV]** El foco entra al panel, en el interruptor.
29. En el panel: apaga y prende los subtítulos, súbelos/bájalos y cambia el tamaño.
    → Cada cambio se aplica y aparece un aviso breve en el centro. **[TV]** El foco no sale
    del panel.
30. Cierra el panel con **Atrás**.
    → Vuelve al video. **[TV]** El foco vuelve a **Subs**.
31. Elige **Episodios** y otro episodio.
    → Carga el episodio elegido; el panel se cierra. **[TV]** El foco entra al episodio que
    se estaba viendo y, al cerrar, vuelve a **Episodios**.
32. Elige **Fuentes** y otra fuente.
    → La fuente cambia y el video sigue desde el mismo segundo.
33. Elige **Guardar** en el reproductor.
    → Queda marcado; la serie aparece en Mi lista.
34. **[TV]** Usa siguiente/anterior del control. **[Celular]** Desliza el video hacia arriba
    o hacia abajo.
    → Pasa al episodio siguiente o anterior. En el primero, avisa «Es el primer episodio».
35. Deja que termine un episodio.
    → Muestra «Cargando siguiente capítulo…» y sigue con el siguiente. En el último, queda
    en pausa.
36. Cierra el reproductor con **Atrás** (o la flecha de volver).
    → Vuelve a la ficha, que ahora dice **Continuar** con el episodio en que quedó.

## 7. Seguir viendo después

37. Vuelve al Inicio.
    → Aparece la fila **Continuar viendo** con la serie y una barra de progreso.
38. Elige la serie desde Continuar viendo.
    → Abre el reproductor en el episodio y el segundo donde quedó.

## 8. Biblioteca

39. Entra a **Biblioteca**.
    → En **Mi lista** están las series guardadas (la última primero).
40. Cambia a **Historial**.
    → Están las series vistas con su episodio y progreso; elegir una la retoma.
41. Sin nada guardado o visto, cada pestaña muestra un aviso que explica cómo llenarla.

## 9. Cuenta (opcional)

42. Entra a **Ajustes** y crea una cuenta con nombre, correo y contraseña (mínimo 6).
    → «Cuenta creada. Revisa tu correo para verificar.» Aparece la cuenta con «Sin verificar»
    y las opciones **Reenviar verificación** y **Ya verifiqué mi correo**.
43. Prueba los errores: correo vacío, contraseña corta, un correo que ya tiene cuenta.
    → Mensajes claros en español; nunca un código interno.
44. Verifica el correo y elige **Ya verifiqué mi correo**.
    → «¡Tu correo está verificado!» y desaparece «Sin verificar».
45. **Cerrar sesión** y vuelve a **Iniciar sesión** con el mismo correo.
    → Entra de nuevo; con una contraseña equivocada, «Contraseña incorrecta».

## 10. Ajustes

46. **Calidad preferida:** elígela varias veces.
    → Cambia Auto → 1080p → 720p → 480p → Auto; al reproducir se prefieren las fuentes de
    esa calidad.
47. **Subtítulos automáticos** y **Subtítulos en dramas cortos:** apaga y prende.
    → El interruptor cambia y se respeta al abrir el próximo video.
48. **Recargar catálogos.**
    → «Recargando addons…», luego «Addons recargados» y el Inicio con contenido nuevo.
49. **Borrar historial** y **Vaciar mi lista.**
    → Piden confirmación; al aceptar, los contadores quedan en 0 y Continuar viendo desaparece.
50. **[TV]** Recorre Ajustes completo con ↓.
    → El foco pasa por todas las opciones, de la primera a la última.

## 11. Perfiles

51. En Ajustes, elige **Cambiar perfil**.
    → Vuelve «¿Quién está viendo?».
52. Crea un segundo perfil y entra con él.
    → Empieza con Mi lista e historial vacíos: cada perfil tiene lo suyo. Al volver al
    primero, su lista sigue igual.
53. **Cambiar foto:** con un enlace a una imagen y, en el celular, desde la galería.
    → La foto aparece en la tarjeta del perfil y en el avatar de arriba.
54. **Administrar:** borra el segundo perfil escribiendo su nombre.
    → Desaparece; con un nombre que no existe, «Perfil no encontrado».

## 12. Addons

55. Entra a la pantalla de **Addons**.
    → Se ven los addons instalados con sus recursos, un interruptor para activarlos y un
    botón para quitarlos. *(Hallazgo: hoy solo se llega aquí si no hay ningún catálogo;
    ver «Pendientes» abajo.)*
56. Instala un addon pegando su enlace (`https://…/manifest.json` o `stremio://…`).
    → «Instalado: <nombre>» y aparece en la lista. Con un enlace que no responde, un mensaje
    que explica qué revisar.
57. Desactiva un addon y vuelve al Inicio.
    → Sus catálogos ya no aparecen.
58. Quita un addon: el primer toque pide confirmar («Quitar»), el segundo lo borra.

## 13. Cuando algo falla

59. Una fuente que no carga.
    → Prueba sola la siguiente («Probando otra fuente…»). Si fallan todas, «No se pudo
    reproducir este episodio» con **Reintentar** y **Fuentes**. **[TV]** El foco va a Reintentar.
60. Un addon que no responde.
    → El Inicio carga los demás y avisa cuántos catálogos no respondieron.
61. Sin internet al abrir.
    → El Inicio muestra el aviso «Sin catálogos» con **Reintentar** y **Ver addons**.

## 14. Actualizaciones [Android]

62. Al abrir, si hay una versión nueva publicada.
    → Aparece «Nueva versión disponible» con **Actualizar** y **Luego**. **[Samsung]** No
    aparece: el `.wgt` se reinstala a mano.

## 15. Salir y volver

63. Con **Atrás** desde el Inicio (sin nada abierto).
    → Sale de la app. Cada Atrás anterior cierra lo que está más arriba: panel, reproductor,
    ficha, búsqueda, otra pestaña.
64. Abre la app de nuevo.
    → Entra directo con el último perfil; Mi lista, historial, ajustes y addons siguen igual.
65. Mientras ve un episodio, la TV se suspende o se cambia de app.
    → Al volver, el progreso quedó guardado.

---

## Cobertura: cada función y dónde se prueba

| Función | Pasos |
|---|---|
| Perfiles: crear, elegir, cambiar, foto, borrar | 1–4, 51–54 |
| Inicio: destacado, secciones, Continuar viendo | 5–9, 37–38 |
| Filtros por tipo, país y género | 10–12 |
| Búsqueda | 13–16 |
| Ficha: temporadas, episodios, guardar | 17–21 |
| Reproductor: pausa, adelantar, sonido, velocidad, subtítulos, episodios, fuentes, guardar | 22–36 |
| Continuar donde quedó | 36–38, 40 |
| Biblioteca: Mi lista e Historial | 39–41 |
| Cuenta: registro, errores, verificación, sesión | 42–45 |
| Ajustes: calidad, subtítulos, recargar, borrar datos | 46–50 |
| Addons: instalar, activar, quitar | 55–58 |
| Errores: fuente, addon, sin internet | 59–61 |
| Actualización | 62 |
| Atrás, salir y persistencia | 63–65 |
| Control remoto en todas las pantallas | 2, 6–8, 15, 18, 21, 24–31, 50 |

## Pendientes encontrados al hacer el recorrido

- **Addons solo se alcanzaba sin catálogos.** Resuelto: opción **Addons** en Ajustes.
- **Mi lista y el historial eran compartidos por todos los perfiles.** Resuelto: cada perfil
  tiene los suyos. Lo que ya estaba guardado se copió a cada perfil existente la primera vez
  que arrancó la versión nueva, así que nadie perdió nada.
