const { Persona, Docente, Administrador, Estudiante } = require("../models");
const { verifyAccessToken } = require('../utils/jwt');

// Autentica JWT y enriquece req con personaId, tipoUsuario y datos de rol (docenteId, adminId, estudianteId).
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

    const persona = await Persona.findByPk(personaId);

    if (!persona) {
      return res.status(404).json({
        mensaje: "Persona no encontrada",
        personaId
      });
    }

    if (persona.estado === false) {
      return res.status(403).json({
        mensaje: 'Usuario inhabilitado',
      });
    }

    req.personaId = personaId;
    req.tipoUsuario = persona.tipoUsuario;

    // Si es DOCENTE, obtener asignaturas asignadas
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

      const docenteAsignaturaIds = Array.from(
        new Set(
          docentes
            .map((docente) => Number(docente.asignatura_id))
            .filter((id) => Number.isFinite(id))
        )
      );

      const docenteIdHeader = Number(req.headers["x-docente-id"]);
      const asignaturaIdHeader = Number(req.headers["x-asignatura-id"]);

      const docenteSeleccionado = Number.isFinite(docenteIdHeader)
        ? docentes.find((docente) => Number(docente.id) === docenteIdHeader)
        : docentes[0];

      req.docenteIds = docenteIds;
      req.docenteAsignaturaIds = docenteAsignaturaIds;
      req.docenteId = docenteSeleccionado ? Number(docenteSeleccionado.id) : docenteIds[0];

      if (Number.isFinite(asignaturaIdHeader) && docenteAsignaturaIds.includes(asignaturaIdHeader)) {
        req.docenteAsignaturaId = asignaturaIdHeader;
      } else if (docenteSeleccionado && Number.isFinite(Number(docenteSeleccionado.asignatura_id))) {
        req.docenteAsignaturaId = Number(docenteSeleccionado.asignatura_id);
      } else {
        req.docenteAsignaturaId = docenteAsignaturaIds[0];
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
      mensaje: "Error en autenticacion de usuario",
      error: error.message
    });
  }
};

module.exports = autenticacionUsuario;
