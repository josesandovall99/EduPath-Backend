const crypto = require('crypto');

function generarPassword(longitud = 10) {
  return crypto.randomBytes(longitud)
    .toString('base64')
    .slice(0, longitud);
}

function generarCodigoAcceso() {
  return crypto.randomUUID(); 
}

module.exports = {
  generarPassword,
  generarCodigoAcceso
};
