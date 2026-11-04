# 0005 · Arquitectura en capas dentro del mismo monolito web

**Fecha:** 2026-11-04 · **Estado:** aceptada

## Contexto

Con los 17 módulos de la decisión 0001 las pantallas todavía llamaban directo a la red
y a localStorage. Por ejemplo, la ficha descargaba su metadata y Ajustes leía el
almacenamiento. Las reglas de negocio (filtros, progreso, países) estaban mezcladas con
el HTML, así que no se podían probar sin levantar la interfaz.

## Alternativas consideradas

1. Seguir con módulos por pantalla: simple, pero cada pantalla conoce todos los detalles.
2. Separar en servicios o procesos: no hay necesidad. Es una sola app en un dispositivo
   (guía, sección 8).
3. Capas lógicas dentro de la misma página: dominio, aplicación, infraestructura y
   presentación.

## Decisión

Opción 3, con las dependencias de la tabla del README, hechas cumplir por
`test/unit/arquitectura.test.js`. Las pantallas piden datos a los servicios de `app/`
y guardan a través de los repositorios de `app/state.js`.

## Consecuencias

- Las reglas del dominio se prueban sin DOM ni red. La interfaz puede cambiar sin tocar
  las reglas, y viceversa.
- Hay más archivos (31) y el orden de carga en `index.html` importa más. La prueba de
  arquitectura detecta si alguien carga un módulo antes que su dependencia.
- La plataforma y el registro de errores son la excepción: la presentación los usa
  directamente (orientación de pantalla, avisos en consola), porque envolverlos en un
  servicio solo agregaría una capa que reenvía llamadas.
