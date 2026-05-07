/**
 * Middleware para autorizar gestión por ADMINISTRADOR o DOCENTE
 * - ADMINISTRADOR: acceso completo
 * - DOCENTE: solo sus asignaturas asignadas
 * 
 * Uso: aplicar a rutas que requieran validación de Asignatura
 * 
 * Espera que req tenga:
 * - req.docenteAsignaturaIds (del middleware autenticacionUsuario)
 * - req.body.asignatura_id OR req.params.asignaturaId OR req.query.asignaturaId (el Asignatura a validar)
 */
const createAutorizacionDocente = (allowMissingDocente = false) => async (req, res, next) => {
  try {
    // ADMINISTRADOR puede gestionar sin restricción de asignatura
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

    const allowedasignaturaIds = Array.isArray(req.docenteAsignaturaIds)
      ? req.docenteAsignaturaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    if (allowedasignaturaIds.length === 0) {
      if (allowMissingDocente) {
        return next();
      }

      return res.status(401).json({
        mensaje: "No autorizado: asignaturas del docente no disponibles",
      });
    }

    // Obtener el asignatura_id que se intenta gestionar (desde body, params o query)
    const asignaturaIdAGestionar =
      req.body.asignatura_id ||
      req.params.asignaturaId ||
      req.query.asignaturaId ||
      req.body.actividad?.asignatura_id ||
      req.headers["x-asignatura-id"] ||
      req.docenteAsignaturaId;

    // Si no hay asignatura_id en la request, opcional (algunos endpoints no lo requieren)
    if (!asignaturaIdAGestionar) {
      // Algunos endpoints como GET /temas no especifican asignatura_id
      // Permitimos que continúe y será responsabilidad del controlador filtrar
      req.docenteAsignaturaId = allowedasignaturaIds[0];
      return next();
    }

    const asignaturaIdNumerico = parseInt(asignaturaIdAGestionar, 10);

    // Validar que el asignatura_id esté permitido
    if (!allowedasignaturaIds.includes(asignaturaIdNumerico)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado: no tienes permisos para gestionar esta asignatura",
        asignaturasPermitidas: allowedasignaturaIds,
        AsignaturaIntentada: asignaturaIdAGestionar,
      });
    }

    // Pasar el asignatura_id a través del request para uso en controladores
    req.docenteAsignaturaId = asignaturaIdNumerico;
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
