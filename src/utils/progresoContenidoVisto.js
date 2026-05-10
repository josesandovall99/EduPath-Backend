/**
 * Criterio unificado para "contenido ya visto" en estudiante_progreso.
 * Antes muchos chequeos exigían completado=true AND estado='Visualizado' a la vez;
 * en BD puede quedar sólo uno de los dos (otros endpoints, datos viejos, minúsculas).
 */
function progresoCuentaContenidoVisualizado(row) {
  if (!row) return false;
  if (row.completado === true) return true;
  const est = String(row.estado ?? '').trim().toLowerCase();
  return est === 'visualizado';
}

module.exports = { progresoCuentaContenidoVisualizado };
