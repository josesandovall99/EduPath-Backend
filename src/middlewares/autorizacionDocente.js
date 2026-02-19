const { Docente } = require("../models");

/**
 * Middleware para autorizar gestión por ADMINISTRADOR o DOCENTE
 * - ADMINISTRADOR: acceso completo
 * - DOCENTE: solo su área asignada
 * 
 * Uso: aplicar a rutas que requieran validación de area
 * 
 * Espera que req tenga:
 * - req.docenteId (del token/sesión)
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

    // Obtener docente_id desde el request
    const docenteId = req.docenteId || req.body.docente_id || req.headers["x-docente-id"];

    if (!docenteId) {
      if (allowMissingDocente) {
        return next();
      }

      return res.status(401).json({
        mensaje: "No autorizado: docente_id requerido",
      });
    }

    // Obtener el docente con su area
    const docente = await Docente.findByPk(docenteId);

    if (!docente) {
      return res.status(404).json({
        mensaje: "Docente no encontrado",
      });
    }

    // Obtener el area_id que se intenta gestionar (desde body, params o query)
    const areaIdAGestionar =
      req.body.area_id ||
      req.params.areaId ||
      req.params.id ||
      req.query.areaId ||
      req.body.actividad?.area_id;

    // Si no hay area_id en la request, opcional (algunos endpoints no lo requieren)
    if (!areaIdAGestionar) {
      // Algunos endpoints como GET /temas no especifican area_id
      // Permitimos que continúe y será responsabilidad del controlador filtrar
      req.docenteAreaId = docente.area_id;
      return next();
    }

    // Validar que el area_id coincida
    if (parseInt(areaIdAGestionar) !== parseInt(docente.area_id)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado: no tienes permisos para gestionar esta área",
        tuArea: docente.area_id,
        areaIntentada: areaIdAGestionar,
      });
    }

    // Pasar el area_id a través del request para uso en controladores
    req.docenteAreaId = docente.area_id;
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
