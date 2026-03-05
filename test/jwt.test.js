const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-123456789';
process.env.JWT_EXPIRES_IN = '1h';

const { signAccessToken, verifyAccessToken } = require('../src/utils/jwt');

test('JWT signs and verifies access token claims', () => {
  const token = signAccessToken({ personaId: 99, tipoUsuario: 'ESTUDIANTE' });
  const claims = verifyAccessToken(token);

  assert.equal(claims.personaId, 99);
  assert.equal(claims.tipoUsuario, 'ESTUDIANTE');
  assert.ok(claims.exp);
});

test('JWT rejects malformed token', () => {
  assert.throws(() => verifyAccessToken('token-invalido'));
});
