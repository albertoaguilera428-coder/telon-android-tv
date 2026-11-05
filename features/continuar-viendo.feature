# language: es
# Telón - Continuar viendo
# Para: Telón TV
# De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático
#
# Escenarios derivados del comportamiento actual de la app (caracterización).
# Pendientes de validar con el responsable del producto antes de tomarlos como regla.

Característica: Retomar lo que estaba viendo
  Para no buscar de nuevo por dónde iba
  Como espectador
  Quiero que la app recuerde mi progreso

  Escenario: Lo que vi aparece en "Continuar viendo"
    Dado que abro Telón en un dispositivo "android-tv"
    Y ya tengo un perfil creado
    Cuando reproduzco el primer episodio de "Drama Coreano"
    Y veo 120 segundos de un episodio de 1500 segundos
    Y cierro el reproductor y la ficha
    Entonces el inicio muestra "Drama Coreano" en "Continuar viendo" con 8 por ciento de avance

  Escenario: Un episodio terminado no deja progreso pendiente
    Dado que abro Telón en un dispositivo "android-tv"
    Y ya tengo un perfil creado
    Cuando reproduzco el primer episodio de "Drama Coreano"
    Y veo 1499 segundos de un episodio de 1500 segundos
    Y cierro el reproductor y la ficha
    Entonces el inicio no muestra "Continuar viendo"
