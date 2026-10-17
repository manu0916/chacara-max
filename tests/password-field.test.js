import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('password control works without catalogue/API, preserves value and cursor, and resets hidden', () => {
  const listeners = {};
  const attributes = {};
  const label = { textContent: '' };
  const symbol = { setAttribute: (key, value) => { attributes[key] = value; } };
  const input = {
    type: 'password', value: 'Dummy-test-123', selectionStart: 4, selectionEnd: 8,
    form: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    focus() {}, setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
  };
  const button = {
    querySelector: selector => selector === 'use' ? symbol : label,
    setAttribute: (key, value) => { attributes[key] = value; },
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  runInNewContext(readFileSync(new URL('../public/password-field.js', import.meta.url), 'utf8'), {
    document: { querySelector: selector => selector === '#password' ? input : button },
  });
  assert.equal(input.type, 'password');
  listeners.click();
  assert.equal(input.type, 'text');
  assert.equal(input.value, 'Dummy-test-123');
  assert.equal(input.selectionStart, 4);
  assert.equal(input.selectionEnd, 8);
  assert.equal(attributes['aria-label'], 'Ocultar senha');
  assert.equal(attributes['aria-pressed'], 'true');
  assert.equal(attributes.href, '#i-eye-off');
  assert.equal(label.textContent, 'Ocultar');
  listeners.click();
  assert.equal(input.type, 'password');
  assert.equal(attributes['aria-pressed'], 'false');
  assert.equal(label.textContent, 'Mostrar');
  listeners.click();
  listeners.reset();
  assert.equal(input.type, 'password');
  assert.equal(input.value, 'Dummy-test-123');
});
