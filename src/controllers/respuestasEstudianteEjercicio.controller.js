const axios = require('axios');
const { RespuestaEstudianteEjercicio, Estudiante, Ejercicio } = require("../models");

const JUDGE0_URL = process.env.JUDGE0_URL;
const JUDGE0_KEY = process.env.JUDGE0_KEY;

/* ============================================================
   UTILIDADES DE CONVERSIÓN (Base64)
============================================================ */
// Convierte texto humano a Base64 para Judge0
const codificar = (texto) => Buffer.from(texto || "").toString('base64');

// Convierte Base64 de Judge0 a texto humano
const decodificar = (base64) => Buffer.from(base64 || "", 'base64').toString('utf-8').trim();

/* ============================================================
   1. CREAR RESPUESTA (POST)
============================================================ */
const crearRespuestaEjercicio = async (req, res) => {
  try {
    // El frontend enviará "respuesta" como texto normal (ej: print("hola"))
    const { respuesta, estudiante_id, ejercicio_id, lenguaje_id } = req.body;

    if (!respuesta || !estudiante_id || !ejercicio_id || !lenguaje_id) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const ejercicio = await Ejercicio.findByPk(ejercicio_id);
    if (!ejercicio) {
      return res.status(404).json({ error: "El ejercicio no existe" });
    }

    // --- CODIFICAMOS EL CÓDIGO ANTES DE ENVIAR ---
    const codigoBase64 = codificar(respuesta);

    const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
      source_code: codigoBase64,
      language_id: lenguaje_id
    }, {
      headers: { 'x-rapidapi-key': JUDGE0_KEY }
    });

    // Guardamos la respuesta original (texto plano) para que sea legible en nuestra DB
    const nuevoIntento = await RespuestaEstudianteEjercicio.create({
      respuesta: respuesta, 
      estudiante_id,
      ejercicio_id,
      lenguaje_id,
      token: response.data.token,
      estado: 'Processing'
    });

    res.status(201).json(nuevoIntento);
  } catch (error) {
    console.error("Error en crearRespuesta:", error.message);
    res.status(500).json({ error: "Error al procesar con Judge0" });
  }
};

/* ============================================================
   2. OBTENER RESULTADO (GET)
============================================================ */
const obtenerResultadoJudge0 = async (req, res) => {
  try {
    const { token } = req.params;
    const response = await axios.get(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`, {
      headers: { 'x-rapidapi-key': JUDGE0_KEY }
    });

    const result = response.data;

    if (result.status && result.status.id >= 3) {
      const registro = await RespuestaEstudianteEjercicio.findOne({ where: { token } });

      if (registro) {
        // --- DECODIFICAMOS LA SALIDA DE CONSOLA (stdout) ---
        const stdoutHumano = result.stdout ? decodificar(result.stdout) : "";
        
        // También decodificamos el error si existe (stderr)
        const stderrHumano = result.stderr ? decodificar(result.stderr) : "";

        await registro.update({
          stdout: stdoutHumano,
          estado: result.status.description
        });

        // Modificamos el objeto 'result' que devolvemos al front para que también sea legible
        result.stdout = stdoutHumano;
        result.stderr = stderrHumano;
        result.compile_output = result.compile_output ? decodificar(result.compile_output) : null;
      }
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error al consultar token" });
  }
};

/* ============================================================
   CRUD RESTANTE
============================================================ */
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
    res.status(500).json({ error: error.message });
  }
};

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
    res.status(500).json({ error: error.message });
  }
};

const actualizarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;
    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) return res.status(404).json({ mensaje: "No encontrada" });

    await respuesta.update(req.body);
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarRespuestaEjercicio = async (req, res) => {
  try {
    const { id } = req.params;
    const respuesta = await RespuestaEstudianteEjercicio.findByPk(id);
    if (!respuesta) return res.status(404).json({ mensaje: "No encontrada" });

    await respuesta.destroy();
    res.json({ mensaje: "Eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  crearRespuestaEjercicio,
  obtenerResultadoJudge0,
  obtenerRespuestasEjercicio,
  obtenerRespuestaEjercicioPorId,
  actualizarRespuestaEjercicio,
  eliminarRespuestaEjercicio
};