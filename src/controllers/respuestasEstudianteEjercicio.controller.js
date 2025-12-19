import RespuestaEstudianteEjercicio from "../models/respuestaEstudianteEjercicio.model.js";

/* CREAR RESPUESTA */
export const crearRespuesta = async (req, res) => {
  try {
    const { respuesta, estudiante_id, ejercicio_id, estado } = req.body;

    const nuevaRespuesta = await RespuestaEstudianteEjercicio.create({
      respuesta,
      estudiante_id,
      ejercicio_id,
      estado,
    });

    res.status(201).json(nuevaRespuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear la respuesta",
      error: error.message,
    });
  }
};

/* OBTENER TODAS LAS RESPUESTAS */
export const obtenerRespuestas = async (req, res) => {
  try {
    const respuestas = await RespuestaEstudianteEjercicio.findAll();
    res.json(respuestas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener respuestas" });
  }
};

/* OBTENER RESPUESTA POR ID */
export const obtenerRespuestaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);

    if (!respuesta) {
      return res
        .status(404)
        .json({ mensaje: "Respuesta no encontrada" });
    }

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener respuesta" });
  }
};

/* ACTUALIZAR RESPUESTA */
export const actualizarRespuesta = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) {
      return res
        .status(404)
        .json({ mensaje: "Respuesta no encontrada" });
    }

    await respuesta.update(req.body);
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar respuesta" });
  }
};

/* ELIMINAR RESPUESTA */
export const eliminarRespuesta = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) {
      return res
        .status(404)
        .json({ mensaje: "Respuesta no encontrada" });
    }

    await respuesta.destroy();
    res.json({ mensaje: "Respuesta eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar respuesta" });
  }
};
