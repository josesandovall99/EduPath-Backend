/**
 * Integración HTTP (Supertest): misma app que en localhost, sin abrir puerto.
 */
const request = require('supertest');

describe('API smoke (integración)', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    app = require('../../src/expressApp');
  });

  test('GET /debug responde en entorno no producción', async () => {
    const res = await request(app).get('/debug').expect(200);
    expect(res.body).toMatchObject({
      mensaje: expect.any(String),
      estado: 'Online',
    });
  });

  test('ruta inexistente devuelve 404', async () => {
    await request(app).get('/ruta-que-no-existe-edupath-test').expect(404);
  });

  test('OPTIONS /estudiante/login contempla CORS para origin local', async () => {
    const res = await request(app)
      .options('/estudiante/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('origin no permitido provoca error de CORS', async () => {
    const res = await request(app)
      .get('/debug')
      .set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(500);
  });
});
