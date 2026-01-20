const { RespuestaEstudianteMiniproyecto, Estudiante, Miniproyecto } = require("../models");

/* =========================
   CREAR RESPUESTA
========================= */
const crearRespuestaMiniproyecto = async (req, res) => {
  try {
    const { respuesta, estudiante_id, miniproyecto_id, estado } = req.body;

    // Validar existencia de Estudiante
    const estudiante = await Estudiante.findByPk(estudiante_id);
    if (!estudiante) {
      return res.status(400).json({
        mensaje: `No existe un estudiante con id ${estudiante_id}`,
      });
    }

    // Validar existencia de Miniproyecto
    const miniproyecto = await Miniproyecto.findByPk(miniproyecto_id);
    if (!miniproyecto) {
      return res.status(400).json({
        mensaje: `No existe un miniproyecto con id ${miniproyecto_id}`,
      });
    }

    const nuevaRespuesta = await RespuestaEstudianteMiniproyecto.create({
      respuesta,
      estudiante_id,
      miniproyecto_id,
      estado,
    });

    res.status(201).json(nuevaRespuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER TODAS
========================= */
const obtenerRespuestasMiniproyecto = async (req, res) => {
  try {
    const respuestas = await RespuestaEstudianteMiniproyecto.findAll({
      include: [
        { model: Estudiante, as: "estudiante" },
        { model: Miniproyecto, as: "miniproyecto" },
      ],
    });
    res.json(respuestas);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener respuestas del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerRespuestaMiniproyectoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteMiniproyecto.findByPk(id, {
      include: [
        { model: Estudiante, as: "estudiante" },
        { model: Miniproyecto, as: "miniproyecto" },
      ],
    });

    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de miniproyecto no encontrada",
      });
    }

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarRespuestaMiniproyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const { estudiante_id, miniproyecto_id } = req.body;

    const respuesta = await RespuestaEstudianteMiniproyecto.findByPk(id);
    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de miniproyecto no encontrada",
      });
    }

    // Validar llaves foráneas si vienen en el body
    if (estudiante_id) {
      const estudiante = await Estudiante.findByPk(estudiante_id);
      if (!estudiante) {
        return res.status(400).json({
          mensaje: `No existe un estudiante con id ${estudiante_id}`,
        });
      }
    }

    if (miniproyecto_id) {
      const miniproyecto = await Miniproyecto.findByPk(miniproyecto_id);
      if (!miniproyecto) {
        return res.status(400).json({
          mensaje: `No existe un miniproyecto con id ${miniproyecto_id}`,
        });
      }
    }

    await respuesta.update(req.body);

    res.json({
      mensaje: "Respuesta actualizada correctamente",
      respuesta,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarRespuestaMiniproyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteMiniproyecto.findByPk(id);
    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de miniproyecto no encontrada",
      });
    }

    await respuesta.destroy();

    res.json({
      mensaje: "Respuesta de miniproyecto eliminada correctamente",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al eliminar la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   VERIFICAR MINIPROYECTO COMPLETADO
========================= */
const verificarMiniproyectoCompletado = async (req, res) => {
  try {
    const { miniproyecto_id, estudiante_id } = req.query;

    if (!miniproyecto_id || !estudiante_id) {
      return res.status(400).json({
        message: "miniproyecto_id y estudiante_id son requeridos como parámetros de query"
      });
    }

    // Convertir a números
    const mId = parseInt(miniproyecto_id, 10);
    const esId = parseInt(estudiante_id, 10);

    // Validar que sean números válidos
    if (isNaN(mId) || isNaN(esId)) {
      return res.status(400).json({
        message: "miniproyecto_id y estudiante_id deben ser números válidos"
      });
    }

    // Buscar respuesta completada para este estudiante y miniproyecto
    const respuesta = await RespuestaEstudianteMiniproyecto.findOne({
      where: {
        estudiante_id: esId,
        miniproyecto_id: mId,
        estado: 'Completado'
      }
    });

    if (respuesta) {
      return res.json({
        completado: true,
        miniproyecto_id: mId,
        estudiante_id: esId,
        estado: 'Completado',
        fecha_respuesta: respuesta.createdAt,
        mensaje: "El miniproyecto ha sido completado"
      });
    }

    // Si no está completado, retornar que no está completado
    res.json({
      completado: false,
      miniproyecto_id: mId,
      estudiante_id: esId,
      estado: 'No completado',
      mensaje: "El miniproyecto no ha sido completado"
    });

  } catch (error) {
    console.error('Error en verificarMiniproyectoCompletado:', error);
    res.status(500).json({
      message: "Error al verificar estado del miniproyecto",
      error: error.message || error
    });
  }
};


Estudiante.hasMany(RespuestaEstudianteMiniproyecto, {
  foreignKey: "estudiante_id",
  as: "respuestasMiniproyecto",
});

RespuestaEstudianteMiniproyecto.belongsTo(Estudiante, {
  foreignKey: "estudiante_id",
  as: "estudiante",
});

Miniproyecto.hasMany(RespuestaEstudianteMiniproyecto, {
  foreignKey: "miniproyecto_id",
  as: "respuestasEstudiante",
});

RespuestaEstudianteMiniproyecto.belongsTo(Miniproyecto, {
  foreignKey: "miniproyecto_id",
  as: "miniproyecto",
});


module.exports = {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
  verificarMiniproyectoCompletado
};
