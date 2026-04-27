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

/**
 * Normalización para ejercicios MVC interactivos.
 * Colapsa whitespace (espacios y saltos de línea) a un único espacio.
 * Permite comparar "Hola\nMundo" con "Hola Mundo" sin fallar.
 */
const normalizarSalidaMvc = (texto) =>
  (texto || '')
    .toString()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

module.exports = {
  codificar,
  decodificar,
  normalizarSalida,
  normalizarSalidaMvc
};
