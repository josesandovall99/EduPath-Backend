/**
 * Middleware para autorizar gestión por ADMINISTRADOR o DOCENTE
 * - ADMINISTRADOR: acceso completo
 * - DOCENTE: solo sus áreas asignadas
 * 
 * Uso: aplicar a rutas que requieran validación de area
 * 
 * Espera que req tenga:
 * - req.docenteAreaIds (del middleware autenticacionUsuario)
 * - req.body.area_id OR req.params.areaId OR req.query.areaId (el area a validar)
 */
const createAutorizacionDocente = (allowMissingDocente = false) => async (req, res, next) => {
  try {
    // ADMINISTRADOR puede gestionar sin restricción de área
    if (req.tipoUsuario === "ADMINISTRADOR") {
      return next();
    }

    // Si viene autenticado pero no es docente/admin, negar
    if (req.tipoUsuario && req.tipoUsuario !== "DOCENTE") {
      return res.status(403).json({
        mensaje: "Acceso denegado: se requiere ser administrador o docente",
        tipoUsuarioActual: req.tipoUsuario,
      });
    }

    const allowedAreaIds = Array.isArray(req.docenteAreaIds)
      ? req.docenteAreaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    if (allowedAreaIds.length === 0) {
      if (allowMissingDocente) {
        return next();
      }

      return res.status(401).json({
        mensaje: "No autorizado: áreas del docente no disponibles",
      });
    }

    // Obtener el area_id que se intenta gestionar (desde body, params o query)
    const areaIdAGestionar =
      req.body.area_id ||
      req.params.areaId ||
      req.query.areaId ||
      req.body.actividad?.area_id;

    // Si no hay area_id en la request, opcional (algunos endpoints no lo requieren)
    if (!areaIdAGestionar) {
      // Algunos endpoints como GET /temas no especifican area_id
      // Permitimos que continúe y será responsabilidad del controlador filtrar
      req.docenteAreaId = allowedAreaIds[0];
      return next();
    }

    const areaIdNumerico = parseInt(areaIdAGestionar, 10);

    // Validar que el area_id esté permitido
    if (!allowedAreaIds.includes(areaIdNumerico)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado: no tienes permisos para gestionar esta área",
        areasPermitidas: allowedAreaIds,
        areaIntentada: areaIdAGestionar,
      });
    }

    // Pasar el area_id a través del request para uso en controladores
    req.docenteAreaId = areaIdNumerico;
    next();
  } catch (error) {
    res.status(500).json({
      mensaje: "Error en validación de autorización",
      error: error.message,
    });
  }
};

const autorizacionDocente = createAutorizacionDocente(false);
autorizacionDocente.optional = createAutorizacionDocente(true);

module.exports = autorizacionDocente;
