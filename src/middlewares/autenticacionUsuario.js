const { Persona, Docente, Area } = require("../models");

/**
 * Middleware para autenticar y validar el tipo de usuario desde la BD
 * 
 * Extrae persona_id del header x-persona-id y consulta la BD para obtener:
 * - tipoUsuario (ADMINISTRADOR, DOCENTE, ESTUDIANTE)
 * - Si es DOCENTE: también obtiene area_id
 * 
 * Setea en req:
 * - req.personaId
 * - req.tipoUsuario
 * - req.docenteAreaId (solo si es DOCENTE)
 */
const autenticacionUsuario = async (req, res, next) => {
  try {
    // Obtener persona_id desde headers
    const personaId = req.headers["x-persona-id"] || req.body.persona_id;

    if (!personaId) {
      // Si no hay persona_id, simplemente continuar sin autenticación
      // Útil para rutas públicas
      return next();
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

    // Si es DOCENTE, obtener también el area_id
    if (persona.tipoUsuario === "DOCENTE") {
      const docente = await Docente.findOne({
        where: { persona_id: personaId }
      });

      if (!docente) {
        return res.status(404).json({
          mensaje: "Registro de docente no encontrado para esta persona"
        });
      }

      req.docenteAreaId = docente.area_id;
      req.docenteId = docente.id;
    }

    // Si es ADMINISTRADOR, obtener el admin_id
    if (persona.tipoUsuario === "ADMINISTRADOR") {
      const { Administrador } = require("../models");
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
      const { Estudiante } = require("../models");
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
