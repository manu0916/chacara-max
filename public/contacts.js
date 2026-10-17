(() => {
  'use strict';
  function normalizePhone(value) {
    const input=String(value ?? '').trim();
    if(!input)return '';
    if(!/^\+?[\d\s().-]+$/.test(input))throw new Error('Digite um telefone válido com DDD. Exemplo: (11) 99999-9999.');
    let digits=input.replace(/\D/g,'');
    if(digits.startsWith('00'))digits=digits.slice(2);
    if(!input.startsWith('+') && !input.startsWith('00') && /^\d{10,11}$/.test(digits))digits='55'+digits;
    if(!/^[1-9]\d{9,14}$/.test(digits))throw new Error('Digite um telefone válido com DDD. Exemplo: (11) 99999-9999.');
    return digits;
  }
  function formatPhone(value) {
    if(/^55\d{10,11}$/.test(value))return `+55 (${value.slice(2,4)}) ${value.slice(4,-4)}-${value.slice(-4)}`;
    return value?`+${value}`:'';
  }
  globalThis.CONTACT_UTILS=Object.freeze({normalizePhone,formatPhone});
})();
