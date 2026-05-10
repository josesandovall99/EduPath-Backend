/**
 * Vuelca el .env de la raíz del backend en process.env ANTES de require(integrationBootstrap).
 * Usa cwd y la ruta real del archivo (helpers → ../../../ = backend).
 */
const fs = require('fs');
const path = require('path');
const { mergeEnvIntoProcess } = require('./mergeEnvIntoProcess');

function forceLoadBackendEnv() {
  const fromHelpers = path.resolve(__dirname, '../../../');
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.ENV'),
    path.join(fromHelpers, '.env'),
    path.join(fromHelpers, '.ENV'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      mergeEnvIntoProcess(p);
      return p;
    }
  }
  return null;
}

module.exports = { forceLoadBackendEnv };
