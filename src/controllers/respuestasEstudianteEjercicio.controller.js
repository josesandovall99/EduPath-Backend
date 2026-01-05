const axios = require('axios');
const { RespuestaEstudianteEjercicio, Estudiante, Ejercicio } = require("../models");

const JUDGE0_URL = process.env.JUDGE0_URL;
const JUDGE0_KEY = process.env.JUDGE0_KEY;

/* =========================
   CREAR RESPUESTA (Con Judge0)
========================= */
const crearRespuestaEjercicio = async (req, res) => {
  try {
    const { respuesta, estudiante_id, ejercicio_id, respuesta_esperada, idioma_id } = req.body;

    // 1. Validaciones (Estudiante y Ejercicio) ... se mantienen igual ...

    // 2. Llamada a Judge0
    const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
      source_code: respuesta,
      language_id: idioma_id || 71,
    }, {
      headers: { 
        'x-rapidapi-key': JUDGE0_KEY,
        'Content-Type': 'application/json'
      }
    });

    // AQUÍ SE DEFINE EL TOKEN
    const token = response.data.token; 

    // 3. Ahora sí, creamos el registro en la BD usando el token
    // ... dentro del crearRespuestaEjercicio ...

    const nuevaRespuesta = await RespuestaEstudianteEjercicio.create({
      respuesta,
      estudiante_id,
      ejercicio_id,
      // respuesta_esperada, <--- COMENTA O BORRA ESTA LÍNEA
      idioma_id: idioma_id || 71,
      token: token, 
      estado: "Processing",
      calificacion: 0
    });

    res.status(201).json(nuevaRespuesta);

  } catch (error) {
    // Si Axios falla, el error vendrá aquí
    res.status(500).json({
      mensaje: "Error al crear",
      error: error.message
    });
  }
};

/* =========================
   OBTENER RESULTADO JUDGE0 (Calificación)
========================= */
const obtenerResultadoJudge0 = async (req, res) => {
  try {
    const { token } = req.params;
    const response = await axios.get(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`, {
      headers: { 'x-rapidapi-key': JUDGE0_KEY }
    });

    const result = response.data;

    // Si el proceso terminó (status id > 2)
    if (result.status && result.status.id > 2) {
      let nota = 0;
      const registro = await RespuestaEstudianteEjercicio.findOne({ where: { token } });
      
      if (result.stdout && registro && registro.respuesta_esperada) {
        const salidaReal = Buffer.from(result.stdout, 'base64').toString('utf-8').trim();
        const salidaEsperada = registro.respuesta_esperada.trim();
        nota = (salidaReal === salidaEsperada) ? 100 : 0;
      }

      await RespuestaEstudianteEjercicio.update({
        stdout: result.stdout,
        stderr: result.stderr,
        compile_output: result.compile_output,
        estado: result.status.description,
        calificacion: nota
      }, { where: { token } });

      result.calificacion_automatica = nota;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al consultar Judge0", error: error.message });
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
    res.status(500).json({ mensaje: "Error al obtener respuestas", error: error.message });
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

    if (!respuesta) return res.status(404).json({ mensaje: "No encontrada" });
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ mensaje: "Error", error: error.message });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;
    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) return res.status(404).json({ mensaje: "No encontrada" });

    await respuesta.update(req.body);
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar", error: error.message });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;
    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) return res.status(404).json({ mensaje: "No encontrada" });

    await respuesta.destroy();
    res.json({ mensaje: "Eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar", error: error.message });
  }
};

module.exports = {
  crearRespuestaEjercicio,
  obtenerResultadoJudge0, // Asegúrate de agregar esta a tus rutas
  obtenerRespuestasEjercicio,
  obtenerRespuestaEjercicioPorId,
  actualizarRespuestaEjercicio,
  eliminarRespuestaEjercicio,
};