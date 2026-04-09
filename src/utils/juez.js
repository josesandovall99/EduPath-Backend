const codificar = (texto) => Buffer.from(texto || '').toString('base64');

const decodificar = (base64) => {
  if (!base64) return '';
  try {
    return Buffer.from(base64, 'base64').toString('utf-8').trim();
  } catch (error) {
    return base64;
  }
};

const normalizarSalida = (texto) =>
  (texto || '')
    .toString()
    .replace(/[\n\r]/g, '')
    .trim();

module.exports = {
  codificar,
  decodificar,
  normalizarSalida
};
