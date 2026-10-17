// This control must work even when loading the catalogue or its API fails.
(() => {
  'use strict';
  const input = document.querySelector('#password');
  const button = document.querySelector('#toggle-password');
  if (!input || !button) return;
  const label = button.querySelector('[data-password-label]');
  const symbol = button.querySelector('use');

  function setVisible(visible) {
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
    button.setAttribute('aria-pressed', String(visible));
    if (label) label.textContent = visible ? 'Ocultar' : 'Mostrar';
    if (symbol) symbol.setAttribute('href', visible ? '#i-eye-off' : '#i-eye');
  }

  setVisible(false);
  button.addEventListener('click', () => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    setVisible(input.type === 'password');
    input.focus({ preventScroll: true });
    if (start !== null && end !== null) input.setSelectionRange(start, end);
  });
  input.form?.addEventListener('reset', () => setVisible(false));
})();
