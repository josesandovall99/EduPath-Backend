const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidEmail,
  isStrongPassword,
  sanitizePlainText,
  sanitizeRichText,
  removePersonaSensitiveFields,
} = require('../src/utils/inputSecurity');

test('isValidEmail validates expected addresses', () => {
  assert.equal(isValidEmail('estudiante@udes.edu.co'), true);
  assert.equal(isValidEmail('correo-invalido'), false);
  assert.equal(isValidEmail(''), false);
});

test('isStrongPassword enforces complexity', () => {
  assert.equal(isStrongPassword('Abcdefg1'), true);
  assert.equal(isStrongPassword('abcdefg1'), false);
  assert.equal(isStrongPassword('ABCDEFG1'), false);
  assert.equal(isStrongPassword('Abcdefgh'), false);
  assert.equal(isStrongPassword('Ab1'), false);
});

test('sanitizePlainText strips angle brackets', () => {
  const clean = sanitizePlainText(' <b>Hola</b> ');
  assert.equal(clean, 'bHola/b');
});

test('sanitizeRichText removes scripts and inline handlers', () => {
  const dirty = '<div onclick="alert(1)">Hola<script>alert(2)</script><a href="javascript:alert(3)">x</a></div>';
  const clean = sanitizeRichText(dirty);

  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.toLowerCase().includes('onclick='), false);
  assert.equal(clean.toLowerCase().includes('javascript:'), false);
});

test('removePersonaSensitiveFields strips secret fields', () => {
  const persona = {
    id: 1,
    nombre: 'Ana',
    contraseña: 'hash',
    resetPasswordTokenHash: 'token-hash',
    resetPasswordExpiresAt: '2026-01-01',
  };

  const cleaned = removePersonaSensitiveFields(persona);
  assert.equal(cleaned.id, 1);
  assert.equal(cleaned.nombre, 'Ana');
  assert.equal('contraseña' in cleaned, false);
  assert.equal('resetPasswordTokenHash' in cleaned, false);
  assert.equal('resetPasswordExpiresAt' in cleaned, false);
});
