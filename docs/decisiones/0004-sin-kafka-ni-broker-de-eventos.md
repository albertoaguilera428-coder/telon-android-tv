# 0004 · Sin Kafka ni broker de eventos

**Fecha:** 2026-11-04 · **Estado:** aceptada

## Contexto

La guía de estilo (sección 13) pide usar Kafka solo cuando haga falta un registro
distribuido de eventos: alto volumen, retención, reproducción o consumidores
independientes. Revisamos si Telón tiene alguno de esos casos.

## Evaluación

- Telón es una app cliente: no tiene backend propio, ni productores o consumidores de
  eventos entre servicios.
- La comunicación interna es entre módulos de una misma página: alcanza con llamadas
  directas a funciones.
- Los datos del usuario (historial, lista) viven en el dispositivo; no se sincronizan.

## Decisión

No se agrega Kafka, ni otro broker o cola de mensajes. Tampoco un bus de eventos en
memoria: no hay suscriptores múltiples que lo justifiquen.

## Cuándo revisarlo

Si aparece un backend que, por ejemplo, sincronice historial entre dispositivos, o
procese eventos de reproducción de muchos usuarios para estadísticas, se evalúa
primero una cola administrada simple y solo después Kafka, según el volumen real.
