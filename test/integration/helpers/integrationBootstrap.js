const fs = require('fs');
const path = require('path');
const request = require('supertest');

/**
 * Localiza la carpeta del backend aunque Jest/IDE cambien rutas o cwd.
 * Sube desde este archivo hasta encontrar package.json con name edupath-backend y un .env.
 */
function resolveBackendRoot() {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(pkgPath) && fs.existsSync(envPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'edupath-backend') {
          return dir;
        }
      } catch (_) {
        /* seguir buscando */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '../../../');
}

function resolveBackendEnvPath() {
  const backendRoot = resolveBackendRoot();
  const candidates = [
    path.join(backendRoot, '.env'),
    path.join(backendRoot, '.ENV'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.ENV'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function applyEnvFromFile(envPath) {
  try {
    const { mergeEnvIntoProcess } = require('./mergeEnvIntoProcess');
    mergeEnvIntoProcess(envPath);
  } catch (e) {
    console.warn('[integrationBootstrap] merge .env:', e.message);
  }
}

const envFile = resolveBackendEnvPath();
if (envFile) {
  applyEnvFromFile(envFile);
}

/** Lee variables tipo flag (1, true, yes, on). */
function envFlagEnabled(name) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/** Si existe .env pero no contiene el marcador en disco, sugiere guardar el archivo desde el editor. */
function integrationEnvMissingHint(envPath) {
  const p =
    envPath || resolveBackendEnvPath() || path.resolve(__dirname, '../../../.env');
  if (!fs.existsSync(p)) return '';
  try {
    const raw = fs.readFileSync(p, 'utf8').replace(/\0/g, '');
    if (raw.includes('INTEGRATION_TEST_ESTUDIANTE_CODIGO')) return '';
    return ` El archivo en disco (${p}) no contiene INTEGRATION_TEST_*; si solo las ves en el editor, guarda .env.`;
  } catch (_) {
    return '';
  }
}

function loadCredenciales() {
  const codigoEstudiantil = process.env.INTEGRATION_TEST_ESTUDIANTE_CODIGO?.trim();
  const contraseña = process.env.INTEGRATION_TEST_ESTUDIANTE_PASSWORD?.trim();
  const ejercicioIdRaw = process.env.INTEGRATION_TEST_EJERCICIO_ID?.trim();
  const ejercicio_id = ejercicioIdRaw ? parseInt(ejercicioIdRaw, 10) : NaN;

  if (!codigoEstudiantil || !contraseña || !Number.isFinite(ejercicio_id)) {
    return null;
  }
  return { codigoEstudiantil, contraseña, ejercicio_id };
}

/**
 * Ejecutar si existen INTEGRATION_TEST_* en el entorno (tras cargar .env).
 * RUN_SKIP_DB_INTEGRATION=1 las desactiva (p. ej. en CI sin BD de prueba).
 */
function integrationDbTestsEnabled() {
  if (envFlagEnabled('RUN_SKIP_DB_INTEGRATION')) return false;
  return loadCredenciales() !== null;
}

function loadCompiladorOpcional() {
  const judge0 = process.env.JUDGE0_URL?.trim();
  const codigo = process.env.INTEGRATION_TEST_CODIGO_JAVA;
  const idRaw =
    process.env.INTEGRATION_TEST_EJERCICIO_COMPILADOR_ID?.trim() ||
    process.env.INTEGRATION_TEST_EJERCICIO_ID?.trim();
  const ejercicio_id = idRaw ? parseInt(idRaw, 10) : NaN;

  if (!judge0 || typeof codigo !== 'string' || !codigo.trim() || !Number.isFinite(ejercicio_id)) {
    return null;
  }
  return { ejercicio_id, codigo: codigo.trim() };
}

if (process.env.INTEGRATION_TEST_DEBUG === '1') {
  console.warn('[integrationBootstrap]', {
    backendRootResolved: resolveBackendRoot(),
    envFile: envFile ?? '(ningún .env/.ENV encontrado)',
    hasCodigo: !!String(process.env.INTEGRATION_TEST_ESTUDIANTE_CODIGO || '').trim(),
    hasPassword: !!String(process.env.INTEGRATION_TEST_ESTUDIANTE_PASSWORD || '').trim(),
    ejercicioId: process.env.INTEGRATION_TEST_EJERCICIO_ID,
    integrationDbTestsEnabled: integrationDbTestsEnabled(),
  });
}

/**
 * Autentica Sequelize, carga la app y obtiene sesión de estudiante vía login HTTP.
 */
async function bootstrapStudentSession() {
  const credenciales = loadCredenciales();
  if (!credenciales) {
    throw new Error(
      'Faltan INTEGRATION_TEST_ESTUDIANTE_CODIGO, INTEGRATION_TEST_ESTUDIANTE_PASSWORD o INTEGRATION_TEST_EJERCICIO_ID',
    );
  }

  process.env.NODE_ENV = 'test';

  const sequelize = require('../../../src/models').sequelize;
  await sequelize.authenticate();

  const app = require('../../../src/expressApp');

  const loginRes = await request(app).post('/estudiante/login').send({
    codigoEstudiantil: credenciales.codigoEstudiantil,
    contraseña: credenciales.contraseña,
  });

  if (loginRes.status !== 200) {
    await sequelize.close();
    throw new Error(`Login falló (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
  }

  const sesion = {
    token: loginRes.body.token,
    estudianteId: loginRes.body.estudiante.id,
    personaId: loginRes.body.estudiante.personaId,
  };

  return { app, sequelize, credenciales, sesion };
}

module.exports = {
  integrationDbTestsEnabled,
  integrationEnvMissingHint,
  loadCredenciales,
  loadCompiladorOpcional,
  bootstrapStudentSession,
};
