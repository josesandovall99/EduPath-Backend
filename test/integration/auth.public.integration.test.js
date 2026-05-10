const request = require('supertest');

describe('Auth público (integración HTTP)', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    app = require('../../src/expressApp');
  });

  test('POST /estudiante/login sin datos obligatorios -> 400', async () => {
    const res = await request(app)
      .post('/estudiante/login')
      .send({ codigoEstudiantil: '', contraseña: '' })
      .expect(400);

    expect(res.body).toMatchObject({ mensaje: expect.any(String) });
  });

  test('POST /docente/login sin datos obligatorios -> 400', async () => {
    const res = await request(app)
      .post('/docente/login')
      .send({ codigoAcceso: '', contraseña: '' })
      .expect(400);

    expect(res.body.mensaje).toMatch(/obligatorios/i);
  });
});
