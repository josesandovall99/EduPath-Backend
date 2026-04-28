const jwtLib = require('jsonwebtoken');

const { signAccessToken, verifyAccessToken } = require('../src/utils/jwt');

describe('Utilitario JWT — pruebas unitarias', () => {
  const ORIGINAL_SECRET = process.env.JWT_SECRET;
  const ORIGINAL_EXPIRES = process.env.JWT_EXPIRES_IN;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-123456789';
    process.env.JWT_EXPIRES_IN = '1h';
  });

  afterEach(() => {
    if (typeof ORIGINAL_SECRET === 'undefined') delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_SECRET;

    if (typeof ORIGINAL_EXPIRES === 'undefined') delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = ORIGINAL_EXPIRES;
  });

  test('lanza error si falta JWT_SECRET al firmar', () => {
    delete process.env.JWT_SECRET;
    expect(() => signAccessToken({})).toThrow('JWT_SECRET no esta configurado');
  });

  test('firma y verifica un token devolviendo los claims', () => {
    const token = signAccessToken({ personaId: 99, tipoUsuario: 'ESTUDIANTE' });
    const claims = verifyAccessToken(token);

    expect(claims.personaId).toBe(99);
    expect(claims.tipoUsuario).toBe('ESTUDIANTE');
    expect(claims.exp).toBeDefined();
  });

  test('verificar lanza error para token firmado con otra secret', () => {
    const otroToken = jwtLib.sign({ prueba: 1 }, 'otra-secret', { expiresIn: '1h' });
    expect(() => verifyAccessToken(otroToken)).toThrow();
  });

  test('token expira según JWT_EXPIRES_IN', async () => {
    process.env.JWT_EXPIRES_IN = '1s';
    const token = signAccessToken({ a: 1 });
    // esperar un poco más de 1s para que expire
    await new Promise((r) => setTimeout(r, 1200));
    expect(() => verifyAccessToken(token)).toThrow(/expired/i);
  });
});
