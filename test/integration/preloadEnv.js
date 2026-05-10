/**
 * Carga variables del .env del backend en process.env.
 * cwd primero; luego carpetas padre desde este archivo.
 */
const path = require('path');
const fs = require('fs');
const { mergeEnvIntoProcess } = require('./helpers/mergeEnvIntoProcess');

function isBackendRoot(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.name === 'edupath-backend';
  } catch (_) {
    return false;
  }
}

function collectBackendRootCandidates() {
  const out = [];
  const cwd = process.cwd();
  if (cwd) out.push(path.normalize(cwd));

  let dir = path.normalize(__dirname);
  for (let i = 0; i < 8; i++) {
    out.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [...new Set(out)];
}

function loadBackendEnv() {
  const roots = collectBackendRootCandidates();
  const tried = [];

  // 1) cwd + .env (lo más fiable cuando ejecutas desde EduPath-Backend)
  for (const name of ['.env', '.ENV']) {
    const p = path.join(process.cwd(), name);
    tried.push(p);
    if (fs.existsSync(p)) {
      try {
        mergeEnvIntoProcess(p);
        return { loaded: true, path: p, mode: 'cwd' };
      } catch (e) {
        console.warn('[preloadEnv] error leyendo', p, e.message);
      }
    }
  }

  for (const root of roots) {
    for (const name of ['.env', '.ENV']) {
      const p = path.join(root, name);
      tried.push(p);
      if (!fs.existsSync(p)) continue;
      if (!isBackendRoot(root)) continue;
      try {
        mergeEnvIntoProcess(p);
        return { loaded: true, path: p, mode: 'strict' };
      } catch (e) {
        console.warn('[preloadEnv] error leyendo', p, e.message);
      }
    }
  }

  for (const root of roots) {
    for (const name of ['.env', '.ENV']) {
      const p = path.join(root, name);
      if (!fs.existsSync(p)) continue;
      try {
        mergeEnvIntoProcess(p);
        return { loaded: true, path: p, mode: 'loose' };
      } catch (e) {
        console.warn('[preloadEnv] error leyendo', p, e.message);
      }
    }
  }

  return { loaded: false, tried };
}

const loadResult = loadBackendEnv();

/** Segunda pasada explícita desde cwd (por si el orden anterior falló). */
function reloadEnvFromCwd() {
  for (const name of ['.env', '.ENV']) {
    const p = path.join(process.cwd(), name);
    if (fs.existsSync(p)) {
      mergeEnvIntoProcess(p);
      return p;
    }
  }
  return null;
}
reloadEnvFromCwd();

if (process.env.INTEGRATION_TEST_DEBUG === '1') {
  console.warn('[preloadEnv]', {
    cwd: process.cwd(),
    loaded: loadResult.loaded,
    envPath: loadResult.path ?? null,
    mode: loadResult.mode ?? null,
    hasCodigo: !!String(process.env.INTEGRATION_TEST_ESTUDIANTE_CODIGO || '').trim(),
    codigoSample: process.env.INTEGRATION_TEST_ESTUDIANTE_CODIGO
      ? `${String(process.env.INTEGRATION_TEST_ESTUDIANTE_CODIGO).slice(0, 3)}…`
      : null,
  });
}

module.exports = { loadBackendEnv, loadResult, reloadEnvFromCwd };
