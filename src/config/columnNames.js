/**
 * Columna física de la FK hacia asignaturas. Por defecto `asignatura_id`.
 * Si una tabla aún usa `area_id`, puedes definir:
 *   EDUPATH_ASIGNATURA_FK_DB_COLUMN=area_id
 * (aplica a chatbots y miniproyecto), o por tabla:
 *   CHATBOTS_ASIGNATURA_FK_DB_COLUMN=area_id
 *   MINIPROYECTO_ASIGNATURA_FK_DB_COLUMN=asignatura_id
 */
function col(...keys) {
  for (const key of keys) {
    const v = key && process.env[key];
    if (v && String(v).trim()) return String(v).trim();
  }
  return 'asignatura_id';
}

module.exports = {
  chatbotAsignaturaFkColumn: col(
    'CHATBOTS_ASIGNATURA_FK_DB_COLUMN',
    'EDUPATH_ASIGNATURA_FK_DB_COLUMN'
  ),
  miniproyectoAsignaturaFkColumn: col(
    'MINIPROYECTO_ASIGNATURA_FK_DB_COLUMN',
    'EDUPATH_ASIGNATURA_FK_DB_COLUMN'
  ),
};
