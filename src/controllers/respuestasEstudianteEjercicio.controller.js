const axios = require('axios');
const { RespuestaEstudianteEjercicio, Estudiante, Ejercicio, Evaluacion } = require("../models");
const { Op } = require('sequelize');

const JUDGE0_URL = process.env.JUDGE0_URL;
const JUDGE0_KEY = process.env.JUDGE0_KEY;

/* ============================================================
   UTILIDADES DE CONVERSIÓN (Base64)
============================================================ */
const codificar = (texto) => Buffer.from(texto || "").toString('base64');

const decodificar = (base64) => {
    if (!base64) return "";
    try {
        return Buffer.from(base64, 'base64').toString('utf-8').trim();
    } catch (e) {
        return base64;
    }
};

/* ============================================================
   1. CREAR RESPUESTA (POST)
============================================================ */
const crearRespuestaEjercicio = async (req, res) => {
    console.log("Petición recibida en el controlador ✅");
    try {
        const { respuesta, estudiante_id, ejercicio_id, lenguaje_id } = req.body;

        if (!respuesta || !estudiante_id || !ejercicio_id || !lenguaje_id) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        const ejercicio = await Ejercicio.findByPk(ejercicio_id);
        if (!ejercicio) {
            return res.status(404).json({ error: "El ejercicio no existe" });
        }

        const codigoBase64 = codificar(respuesta);

        // Petición a Judge0 con Headers de RapidAPI
        const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
            source_code: codigoBase64,
            language_id: lenguaje_id
        }, {
            headers: { 
                'x-rapidapi-key': JUDGE0_KEY,
                'x-rapidapi-host': 'judge0-ce.p.rapidapi.com' 
            }
        });

        const nuevoIntento = await RespuestaEstudianteEjercicio.create({
            respuesta,
            estudiante_id,
            ejercicio_id,
            lenguaje_id,
            token: response.data.token,
            estado: 'Processing'
        });

        res.status(201).json(nuevoIntento);
    } catch (error) {
        console.error("Error en crearRespuesta:", error.response?.data || error.message);
        res.status(500).json({ 
            error: "Error al comunicarse con el motor de ejecución", 
            detalle: error.response?.data || error.message 
        });
    }
};

/* ============================================================
   2. OBTENER RESULTADO (GET) - Evaluación Automática
============================================================ */
const obtenerResultadoJudge0 = async (req, res) => {
    try {
        const { token } = req.params;
        
        const response = await axios.get(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`, {
            headers: { 
                'x-rapidapi-key': JUDGE0_KEY,
                'x-rapidapi-host': 'judge0-ce.p.rapidapi.com' 
            }
        });

        const result = response.data;

        // Si el estado es >= 3 significa que terminó (Aceptado, Error, etc.)
        if (result.status && result.status.id >= 3) {
            const registro = await RespuestaEstudianteEjercicio.findOne({
                where: { token },
                include: [{ model: Ejercicio, as: 'ejercicio' }]
            });

            if (registro) {
                const stdoutHumano = result.stdout ? decodificar(result.stdout) : "";
                const stderrHumano = result.stderr ? decodificar(result.stderr) : "";
                const compileOutput = result.compile_output ? decodificar(result.compile_output) : "";

                const limpiarCadena = (str) => {
                    return str ? str.toString().replace(/[\n\r]/g, "").trim() : "";
                };

                const esperado = limpiarCadena(registro.ejercicio?.resultado_ejercicio);
                const obtenido = limpiarCadena(stdoutHumano);
                
                const esCorrecto = (obtenido === esperado && obtenido !== "" && !result.stderr);

                // 1. Actualizar la respuesta
                await registro.update({
                    stdout: stdoutHumano || stderrHumano || compileOutput,
                    estado: result.status.description
                });

                // 2. Crear evaluación automática
                const evaluacionExistente = await Evaluacion.findOne({ 
                    where: { 
                        estudiante_id: registro.estudiante_id,
                        ejercicio_id: registro.ejercicio_id,
                        retroalimentacion: { [Op.like]: `%${token}%` }
                    } 
                });

                if (!evaluacionExistente) {
                    await Evaluacion.create({
                        calificacion: esCorrecto ? 5.0 : 0.0,
                        retroalimentacion: esCorrecto
                            ? `Aprobado automáticamente (Token: ${token}). Resultado coincide.`
                            : `Revisión automática (Token: ${token}). Esperado: '${esperado}', Recibido: '${obtenido}'.`,
                        estudiante_id: registro.estudiante_id,
                        ejercicio_id: registro.ejercicio_id,
                        estado: esCorrecto ? 'Aprobado' : 'Reprobado',
                        fecha_evaluacion: new Date()
                    });
                }

                // Inyectamos datos limpios para el frontend
                result.stdout = stdoutHumano;
                result.stderr = stderrHumano || compileOutput;
                result.evaluacion_final = esCorrecto ? 'Aprobado' : 'Reprobado';
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error("Error en obtenerResultado:", error.message);
        res.status(500).json({ error: "Error al evaluar", detalle: error.message });
    }
};

/* ============================================================
   CRUD ESTÁNDAR
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
