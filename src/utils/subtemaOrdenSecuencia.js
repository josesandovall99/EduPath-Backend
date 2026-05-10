const { Subtema, SecuenciaSubtema } = require('../models');

/**
 * Orden lineal de subtemas igual que GET /secuencias-subtema/tema/:temaId/ordenados.
 * Garantiza que desbloqueo secuencial y la UI estudiante usan la misma cadena de predecesión.
 *
 * @param {number|string} temaId
 * @returns {Promise<import('sequelize').Model[]>}
 */
async function obtenerSubtemasOrdenadosPorSecuenciaParaTema(temaId) {
  const id = typeof temaId === 'string' ? Number.parseInt(temaId, 10) : temaId;

  const subtemas = await Subtema.findAll({
    where: { tema_id: id, estado: true },
  });

  if (subtemas.length === 0) return [];

  const subtemaIds = subtemas.map((s) => s.id);
  const secuencias = await SecuenciaSubtema.findAll({
    where: { estado: true, subtema_origen_id: subtemaIds },
  });

  const secuenciaMap = new Map();
  secuencias.forEach((sec) => {
    if (!secuenciaMap.has(sec.subtema_origen_id)) {
      secuenciaMap.set(sec.subtema_origen_id, []);
    }
    secuenciaMap.get(sec.subtema_origen_id).push(sec.subtema_destino_id);
  });

  const subtemasDestinoIds = new Set();
  secuencias.forEach((s) => subtemasDestinoIds.add(s.subtema_destino_id));

  const subtemasIniciales = subtemas.filter((s) => !subtemasDestinoIds.has(s.id));

  /** @type {import('sequelize').Model[]} */
  const ordenado = [];
  const visitados = new Set();

  const agregarSecuencia = (subtemaId) => {
    if (visitados.has(subtemaId)) return;

    const subtema = subtemas.find((s) => s.id === subtemaId);
    if (subtema) {
      ordenado.push(subtema);
      visitados.add(subtemaId);

      const destinos = secuenciaMap.get(subtemaId);
      if (destinos?.length > 0) agregarSecuencia(destinos[0]);
    }
  };

  subtemasIniciales.forEach((s) => agregarSecuencia(s.id));

  const ids = new Set(ordenado.map((s) => s.id));
  subtemas.forEach((s) => {
    if (!ids.has(s.id)) ordenado.push(s);
  });

  return ordenado;
}

module.exports = { obtenerSubtemasOrdenadosPorSecuenciaParaTema };
