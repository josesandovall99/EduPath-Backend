const { RespuestaEstudianteEjercicio, Estudiante, Ejercicio } = require("../models");

/* =========================
   CREAR RESPUESTA
========================= */
const crearRespuestaEjercicio = async (req, res) => {
  try {
    const { respuesta, estudiante_id, ejercicio_id, estado } = req.body;

    const estudiante = await Estudiante.findByPk(estudiante_id);
    if (!estudiante) {
      return res.status(400).json({
        mensaje: `No existe un estudiante con id ${estudiante_id}`,
      });
    }

    const ejercicio = await Ejercicio.findByPk(ejercicio_id);
    if (!ejercicio) {
      return res.status(400).json({
        mensaje: `No existe un ejercicio con id ${ejercicio_id}`,
      });
    }

    const nuevaRespuesta = await RespuestaEstudianteEjercicio.create({
      respuesta,
      estudiante_id,
      ejercicio_id,
      estado,
    });

    res.status(201).json(nuevaRespuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear la respuesta del ejercicio",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER TODAS
========================= */
const obtenerRespuestasEjercicio = async (req, res) => {
  try {
    const respuestas = await RespuestaEstudianteEjercicio.findAll({
      include: [
        { model: Estudiante, as: "estudiante" },
        { model: Ejercicio, as: "ejercicio" },
      ],
    });
    res.json(respuestas);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener respuestas del ejercicio",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerRespuestaEjercicioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id, {
      include: [
        { model: Estudiante, as: "estudiante" },
        { model: Ejercicio, as: "ejercicio" },
      ],
    });

    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de ejercicio no encontrada",
      });
    }

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener la respuesta del ejercicio",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { estudiante_id, ejercicio_id } = req.body;

    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de ejercicio no encontrada",
      });
    }

    if (estudiante_id) {
      const estudiante = await Estudiante.findByPk(estudiante_id);
      if (!estudiante) {
        return res.status(400).json({
          mensaje: `No existe un estudiante con id ${estudiante_id}`,
        });
      }
    }

    if (ejercicio_id) {
      const ejercicio = await Ejercicio.findByPk(ejercicio_id);
      if (!ejercicio) {
        return res.status(400).json({
          mensaje: `No existe un ejercicio con id ${ejercicio_id}`,
        });
      }
    }

    await respuesta.update(req.body);
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar la respuesta del ejercicio",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de ejercicio no encontrada",
      });
    }

    await respuesta.destroy();
    res.json({
      mensaje: "Respuesta de ejercicio eliminada correctamente",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al eliminar la respuesta del ejercicio",
      error: error.message,
    });
  }
};

Estudiante.hasMany(RespuestaEstudianteEjercicio, {
  foreignKey: "estudiante_id",
  as: "respuestasEjercicio",
});

RespuestaEstudianteEjercicio.belongsTo(Estudiante, {
  foreignKey: "estudiante_id",
  as: "estudiante",
});

Ejercicio.hasMany(RespuestaEstudianteEjercicio, {
  foreignKey: "ejercicio_id",
  as: "respuestasEstudiante",
});

RespuestaEstudianteEjercicio.belongsTo(Ejercicio, {
  foreignKey: "ejercicio_id",
  as: "ejercicio",
});


module.exports = {
  crearRespuestaEjercicio,
  obtenerRespuestasEjercicio,
  obtenerRespuestaEjercicioPorId,
  actualizarRespuestaEjercicio,
  eliminarRespuestaEjercicio,
};
