# language: es
# Telón - Botón atrás
# Para: Telón TV
# De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
#
# Escenarios derivados del comportamiento actual de la app (caracterización).
# Pendientes de validar con el responsable del producto antes de tomarlos como regla.

Característica: El botón atrás cierra primero lo que está encima
  Para no salir de la app por accidente
  Como espectador con control remoto
  Quiero que atrás cierre una capa a la vez

  Antecedentes:
    Dado que abro Telón en un dispositivo "android-tv"
    Y ya tengo un perfil creado

  Escenario: Desde el reproductor vuelvo a la ficha y luego al inicio
    Cuando reproduzco el primer episodio de "Drama Coreano"
    Y presiono atrás
    Entonces el reproductor está cerrado
    Y la ficha sigue abierta
    Cuando presiono atrás
    Entonces la ficha está cerrada
    Y la app indica que todavía no hay que salir

  Escenario: En el inicio, atrás le deja la salida al sistema
    Cuando presiono atrás
    Entonces la app indica que hay que salir
