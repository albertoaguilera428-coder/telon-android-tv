/*
Telón - Pasos de los escenarios de aceptación
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Cada paso usa el mismo conductor jsdom que las pruebas de flujo (test/support/app-driver.js).
*/
'use strict';

const assert = require('node:assert/strict');
const { Given, When, Then, After } = require('@cucumber/cucumber');
const { loadApp } = require('../../test/support/app-driver');

// ============================================================
// CONTEXTO
// ============================================================

After(function () {
  if (this.app) this.app.close();
});

Given('que abro Telón en un dispositivo {string}', async function (dispositivo) {
  this.app = loadApp({ modo: dispositivo });
  await this.app.settle(2);
});

Given('ya tengo un perfil creado', async function () {
  this.app.prompts.push('Ana');
  this.app.click('[data-act="addprofile"]');
  this.app.click('[data-act^="pickprofile:"]');
  await this.app.settle(2);
});

// ============================================================
// ACCIONES
// ============================================================

When('presiono la flecha derecha del control de Samsung', async function () {
  this.app.document.dispatchEvent(new this.app.window.KeyboardEvent('keydown', { keyCode: 39 }));
  await this.app.settle();
});

When('reproduzco el primer episodio de {string}', async function (nombre) {
  this.app.log.length = 0;
  const tarjeta = [...this.app.document.querySelectorAll('.card')].find(c => c.textContent.includes(nombre));
  assert.ok(tarjeta, 'No encontré la tarjeta de ' + nombre);
  tarjeta.click();
  await this.app.settle(2);
  this.app.click('[data-act="play:0"]');
  await this.app.settle(3);
});

When('presiono atrás', async function () {
  this.respuestaAtras = this.app.window.telonBack();
  await this.app.settle();
});

When('veo {int} segundos de un episodio de {int} segundos', function (segundos, duracion) {
  const video = this.app.document.querySelector('#player video');
  Object.defineProperty(video, 'currentTime', { value: segundos, configurable: true, writable: true });
  Object.defineProperty(video, 'duration', { value: duracion, configurable: true });
});

When('cierro el reproductor y la ficha', async function () {
  this.app.click('[data-p="back"]');
  this.app.window.telonBack();
  await this.app.settle();
});

// ============================================================
// VERIFICACIONES
// ============================================================

Then('veo la interfaz {string}', function (interfaz) {
  assert.equal(this.app.document.body.classList.contains('tv'), interfaz === 'tv');
});

Then('el ancho de diseño es {string}', function (viewport) {
  assert.equal(this.app.document.querySelector('meta[name="viewport"]').getAttribute('content'), viewport);
});

Then('el foco queda en un elemento de la pantalla', function () {
  const enfocado = this.app.document.activeElement;
  assert.ok(enfocado && enfocado !== this.app.document.body);
});

Then('se reproduce el video {string} en el reproductor nativo', function (url) {
  assert.equal(this.app.document.querySelector('#player video').getAttribute('src'), url);
});

Then('no se abre ningún reproductor embebido', function () {
  assert.ok(!this.app.log.some(linea => linea.includes('openEmbed')));
});

Then('la app pide orientación {string}', function (orientacion) {
  assert.ok(this.app.log.includes('bridge setOrientation ' + JSON.stringify([orientacion])));
});

Then('el reproductor está cerrado', function () {
  assert.equal(this.app.document.querySelector('#player').hidden, true);
});

Then('la ficha sigue abierta', function () {
  assert.equal(this.app.document.querySelector('#detail').hidden, false);
});

Then('la ficha está cerrada', function () {
  assert.equal(this.app.document.querySelector('#detail').hidden, true);
});

Then('la app indica que todavía no hay que salir', function () {
  assert.equal(this.respuestaAtras, true);
});

Then('la app indica que hay que salir', function () {
  assert.equal(this.respuestaAtras, false);
});

Then('el inicio muestra {string} en {string} con {int} por ciento de avance', function (nombre, seccion, porcentaje) {
  const bloque = [...this.app.document.querySelectorAll('.section')].find(s => s.querySelector('h2') && s.querySelector('h2').textContent === seccion);
  assert.ok(bloque, 'No aparece la sección ' + seccion);
  const tarjeta = [...bloque.querySelectorAll('.card')].find(c => c.textContent.includes(nombre));
  assert.ok(tarjeta, 'No aparece ' + nombre);
  assert.equal(tarjeta.querySelector('.prog i').style.width, porcentaje + '%');
});

Then('el inicio no muestra {string}', function (seccion) {
  const titulos = [...this.app.document.querySelectorAll('.section h2')].map(h => h.textContent);
  assert.ok(!titulos.includes(seccion));
});
