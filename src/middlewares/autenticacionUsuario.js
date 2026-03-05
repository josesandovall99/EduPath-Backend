const { Persona, Docente, Administrador, Estudiante } = require("../models");
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Middleware para autenticar y validar el tipo de usuario desde la BD.
 *
 * Extrae token JWT desde Authorization: Bearer <token> y consulta la BD para obtener:
 * - tipoUsuario (ADMINISTRADOR, DOCENTE, ESTUDIANTE)
 * - Si es DOCENTE: obtiene sus áreas asignadas
 * 
 * Setea en req:
 * - req.personaId
 * - req.tipoUsuario
 * - req.docenteAreaId (área activa)
 * - req.docenteAreaIds (todas las áreas permitidas)
 */
const autenticacionUsuario = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization || '';
    if (!authorizationHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        mensaje: 'No autorizado: token no proporcionado',
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({
        mensaje: 'No autorizado: token invalido',
      });
    }

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        mensaje: 'No autorizado: token invalido o expirado',
      });
    }

    const personaId = Number(claims.personaId);
    if (!Number.isFinite(personaId)) {
      return res.status(401).json({
        mensaje: 'No autorizado: token sin identidad valida',
      });
    }

    // Buscar la Persona en BD
    const persona = await Persona.findByPk(personaId);

    if (!persona) {
      return res.status(404).json({
        mensaje: "Persona no encontrada",
        personaId
      });
    }

    // Setear datos básicos
    req.personaId = personaId;
    req.tipoUsuario = persona.tipoUsuario;

    // Si es DOCENTE, obtener áreas asignadas
    if (persona.tipoUsuario === "DOCENTE") {
      const docentes = await Docente.findAll({
        where: { persona_id: personaId }
      });

      if (!docentes || docentes.length === 0) {
        return res.status(404).json({
          mensaje: "Registro de docente no encontrado para esta persona"
        });
      }

      const docenteIds = docentes
        .map((docente) => Number(docente.id))
        .filter((id) => Number.isFinite(id));

      const docenteAreaIds = Array.from(
        new Set(
          docentes
            .map((docente) => Number(docente.area_id))
            .filter((id) => Number.isFinite(id))
        )
      );

      const docenteIdHeader = Number(req.headers["x-docente-id"]);
      const areaIdHeader = Number(req.headers["x-area-id"]);

      const docenteSeleccionado = Number.isFinite(docenteIdHeader)
        ? docentes.find((docente) => Number(docente.id) === docenteIdHeader)
        : docentes[0];

      req.docenteIds = docenteIds;
      req.docenteAreaIds = docenteAreaIds;
      req.docenteId = docenteSeleccionado ? Number(docenteSeleccionado.id) : docenteIds[0];

      if (Number.isFinite(areaIdHeader) && docenteAreaIds.includes(areaIdHeader)) {
        req.docenteAreaId = areaIdHeader;
      } else if (docenteSeleccionado && Number.isFinite(Number(docenteSeleccionado.area_id))) {
        req.docenteAreaId = Number(docenteSeleccionado.area_id);
      } else {
        req.docenteAreaId = docenteAreaIds[0];
      }
    }

    // Si es ADMINISTRADOR, obtener el admin_id
    if (persona.tipoUsuario === "ADMINISTRADOR") {
      const administrador = await Administrador.findOne({
        where: { persona_id: personaId }
      });

      if (!administrador) {
        return res.status(404).json({
          mensaje: "Registro de administrador no encontrado para esta persona"
        });
      }

      req.adminId = administrador.id;
    }

    // Si es ESTUDIANTE, obtener el estudiante_id
    if (persona.tipoUsuario === "ESTUDIANTE") {
      const estudiante = await Estudiante.findOne({
        where: { persona_id: personaId }
      });

      if (!estudiante) {
        return res.status(404).json({
          mensaje: "Registro de estudiante no encontrado para esta persona"
        });
      }

      req.estudianteId = estudiante.id;
    }

    next();
  } catch (error) {
    res.status(500).json({
      mensaje: "Error en autenticación de usuario",
      error: error.message
    });
  }
};

module.exports = autenticacionUsuario;
