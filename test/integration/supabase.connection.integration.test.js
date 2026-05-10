
const { forceLoadBackendEnv } = require('./helpers/forceLoadBackendEnv');

forceLoadBackendEnv();

function tieneConfiguracionBd() {
  const url = String(process.env.DATABASE_URL ?? '').trim();
  if (url) return true;
  const host = String(process.env.DB_HOST ?? '').trim();
  const name = String(process.env.DB_NAME ?? '').trim();
  const user = String(process.env.DB_USER ?? '').trim();
  return !!(host && name && user);
}

jest.setTimeout(60_000);

describe('Integración — conexión backend ↔ Postgres (Supabase)', () => {
  let sequelize;

  beforeAll(() => {
    if (!tieneConfiguracionBd()) {
      throw new Error(
        'Falta configuración de BD: define DATABASE_URL o DB_HOST + DB_NAME + DB_USER (+ DB_PASSWORD). ' +
          'Ejecuta Jest con cwd en EduPath-Backend y un .env válido en la raíz.',
      );
    }
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Misma instancia que usa el servidor (sin cargar todos los modelos).
    sequelize = require('../../src/config/database');
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  test('authenticate() resuelve contra el servidor Postgres configurado', async () => {
    await expect(sequelize.authenticate()).resolves.toBeUndefined();
  });

  test('consulta mínima devuelve fila desde Postgres', async () => {
    const [rows] = await sequelize.query(
      'SELECT 1 AS ok, current_database() AS db',
    );
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(Number(rows[0].ok)).toBe(1);
    expect(typeof rows[0].db).toBe('string');
    expect(rows[0].db.length).toBeGreaterThan(0);
  });
});
