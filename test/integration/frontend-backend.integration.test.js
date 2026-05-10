
const request = require('supertest');
const { forceLoadBackendEnv } = require('./helpers/forceLoadBackendEnv');

forceLoadBackendEnv();

function normalizarOrigen(raw) {
  const s = String(raw ?? '').trim().replace(/\/$/, '');
  if (!s || !/^https?:\/\//i.test(s)) return null;
  return s;
}

/** Orígenes desde los que el frontend puede llamar a la API (alineado con Vite en este repo). */
function origenesAValidar() {
  const set = new Set();
  const add = (v) => {
    const o = normalizarOrigen(v);
    if (o) set.add(o);
  };

  add(process.env.FRONTEND_URL);
  String(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .forEach((chunk) => add(chunk.trim()));

  add('http://localhost:3000');
  add('http://127.0.0.1:3000');
  add('http://localhost:4173');
  add('http://127.0.0.1:4173');

  return [...set];
}

describe('Integración — backend ↔ frontend (CORS y superficie HTTP)', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../../src/expressApp');
  });

  const origins = origenesAValidar();

  test('hay al menos un origen de frontend configurado para validar', () => {
    expect(origins.length).toBeGreaterThan(0);
  });

  test.each(origins)(
    'OPTIONS preflight /estudiante/login permite Origin %s (como el navegador antes del POST)',
    async (origin) => {
      const res = await request(app)
        .options('/estudiante/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    },
  );

  test.each(origins)(
    'GET /debug con Origin %s responde 200 en NODE_ENV=test (respuesta usable desde el front)',
    async (origin) => {
      const res = await request(app).get('/debug').set('Origin', origin);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ estado: 'Online' });
    },
  );

  test('origen no incluido en la política CORS no obtiene respuesta exitosa', async () => {
    const res = await request(app)
      .get('/debug')
      .set('Origin', 'https://origen-no-autorizado-edupath.test');

    expect(res.status).toBe(500);
  });
});
