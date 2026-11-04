# language: es
# Telón - Soporte de dispositivos
# Para: Telón TV
# De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
#
# Requisito del responsable del producto (2026-11-04): la app debe funcionar en
# Android TV, celulares, tablets y televisores Samsung en modo desarrollador.

Característica: Una sola app para TV, celular, tablet y Samsung
  Para ver mis series en cualquier pantalla de la casa
  Como espectador
  Quiero que Telón se adapte al dispositivo donde lo abro

  Esquema del escenario: La interfaz se adapta al tipo de dispositivo
    Dado que abro Telón en un dispositivo "<dispositivo>"
    Entonces veo la interfaz "<interfaz>"
    Y el ancho de diseño es "<viewport>"

    Ejemplos:
      | dispositivo   | interfaz | viewport                                                |
      | android-tv    | tv       | width=1920                                              |
      | android-phone | táctil   | width=device-width, initial-scale=1, viewport-fit=cover |
      | tizen         | tv       | width=1920                                              |

  Escenario: En Samsung el control remoto navega la app
    Dado que abro Telón en un dispositivo "tizen"
    Y ya tengo un perfil creado
    Cuando presiono la flecha derecha del control de Samsung
    Entonces el foco queda en un elemento de la pantalla

  Escenario: En Samsung solo se ofrecen fuentes que el televisor puede reproducir
    Dado que abro Telón en un dispositivo "tizen"
    Y ya tengo un perfil creado
    Cuando reproduzco el primer episodio de "Drama Coreano"
    Entonces se reproduce el video "https://cdn/v.m3u8" en el reproductor nativo
    Y no se abre ningún reproductor embebido

  Escenario: En el celular el reproductor gira la pantalla para series
    Dado que abro Telón en un dispositivo "android-phone"
    Y ya tengo un perfil creado
    Cuando reproduzco el primer episodio de "Drama Coreano"
    Entonces la app pide orientación "landscape"
