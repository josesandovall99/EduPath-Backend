/**
 * Jest setupFiles: corre ANTES de cualquier suite (incluido require del test).
 * Carga el .env del backend por ruta fija (no depende solo de process.cwd).
 */
const path = require('path');
const fs = require('fs');
const { mergeEnvIntoProcess } = require('./helpers/mergeEnvIntoProcess');

// Este archivo está en test/integration → ../../ = raíz del backend
const backendRoot = path.resolve(__dirname, '..', '..');
const candidates = [
  path.join(backendRoot, '.env'),
  path.join(backendRoot, '.ENV'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.ENV'),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    try {
      mergeEnvIntoProcess(p);
      if (String(process.env.INTEGRATION_TEST_DEBUG || '').trim() === '1') {
        console.warn('[jest-setup-load-env] OK', p);
      }
    } catch (e) {
      console.warn('[jest-setup-load-env] Error:', p, e.message);
    }
    break;
  }
}
