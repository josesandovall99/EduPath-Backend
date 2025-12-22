const RespuestasEstudianteEjercicio = require(
  "../models/respuestasEstudianteEjercicio.model"
);

/* CREAR RESPUESTA */
const crearRespuestaEjercicio = async (req, res) => {
  try {
    const {
      respuesta,
      estudiante_id,
      ejercicio_id,
      estado,
    } = req.body;

    const nuevaRespuesta = await RespuestasEstudianteEjercicio.create({
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

/* OBTENER TODAS */
const obtenerRespuestasEjercicio = async (req, res) => {
  try {
    const respuestas =
      await RespuestaEstudianteEjercicio.findAll();
    res.json(respuestas);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener respuestas del ejercicio",
    });
  }
};

/* OBTENER POR ID */
const obtenerRespuestaEjercicioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta =
      await RespuestaEstudianteEjercicio.findByPk(id);

    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de ejercicio no encontrada",
      });
    }

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener la respuesta del ejercicio",
    });
  }
};

/* ACTUALIZAR */
const actualizarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta =
      await RespuestaEstudianteEjercicio.findByPk(id);

    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de ejercicio no encontrada",
      });
    }

    await respuesta.update(req.body);
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar la respuesta del ejercicio",
    });
  }
};

/* ELIMINAR */
const eliminarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta =
      await RespuestasEstudianteEjercicio.findByPk(id);

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
    });
  }
};

module.exports = {
  crearRespuestaEjercicio,
  obtenerRespuestasEjercicio,
  obtenerRespuestaEjercicioPorId,
  actualizarRespuestaEjercicio,
  eliminarRespuestaEjercicio,
};
