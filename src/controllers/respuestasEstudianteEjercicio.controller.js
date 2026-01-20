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

        const headers = { 'content-type': 'application/json' };
        if (JUDGE0_KEY) {
            headers['x-rapidapi-key'] = JUDGE0_KEY;
            headers['x-rapidapi-host'] = 'judge0-ce.p.rapidapi.com';
            headers['X-Auth-Token'] = JUDGE0_KEY;
        }

        const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
            source_code: codificar(respuesta),
            language_id: lenguaje_id
        }, { headers });

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
        res.status(error.response?.status || 500).json({ 
            error: "Error al comunicarse con el motor de ejecución", 
            detalle: error.response?.data || error.message 
        });
    }
};

/* ============================================================
   2. OBTENER RESULTADO (GET)
============================================================ */
const obtenerResultadoJudge0 = async (req, res) => {
    try {
        const { token } = req.params;
        
        const headers = {};
        if (JUDGE0_KEY) {
            headers['x-rapidapi-key'] = JUDGE0_KEY;
            headers['x-rapidapi-host'] = 'judge0-ce.p.rapidapi.com';
            headers['X-Auth-Token'] = JUDGE0_KEY;
        }

        const response = await axios.get(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`, { headers });
        const result = response.data;

        if (result.status && result.status.id >= 3) {
            const registro = await RespuestaEstudianteEjercicio.findOne({
                where: { token },
                include: [{ model: Ejercicio, as: 'ejercicio' }]
            });

            if (registro) {
                const stdoutHumano = result.stdout ? decodificar(result.stdout) : "";
                const stderrHumano = result.stderr ? decodificar(result.stderr) : "";
                const compileOutput = result.compile_output ? decodificar(result.compile_output) : "";

                const limpiarCadena = (str) => str ? str.toString().replace(/[\n\r]/g, "").trim() : "";

                const esperado = limpiarCadena(registro.ejercicio?.resultado_ejercicio);
                const obtenido = limpiarCadena(stdoutHumano);
                
                const esCorrecto = (obtenido === esperado && obtenido !== "" && !result.stderr);

                await registro.update({
                    stdout: stdoutHumano || stderrHumano || compileOutput,
                    estado: result.status.description
                });

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
   3. CRUD ESTÁNDAR (Faltaban estas definiciones)
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

// Verificar si un ejercicio está completado/aprobado por un estudiante
const verificarEjercicioCompletado = async (req, res) => {
    try {
        const { ejercicio_id, estudiante_id } = req.query;

        if (!ejercicio_id || !estudiante_id) {
            return res.status(400).json({
                message: "ejercicio_id y estudiante_id son requeridos como parámetros de query"
            });
        }

        // Convertir a números
        const eId = parseInt(ejercicio_id, 10);
        const esId = parseInt(estudiante_id, 10);

        // Validar que sean números válidos
        if (isNaN(eId) || isNaN(esId)) {
            return res.status(400).json({
                message: "ejercicio_id y estudiante_id deben ser números válidos"
            });
        }

        // Buscar evaluación aprobada para este estudiante y ejercicio
        const evaluacion = await Evaluacion.findOne({
            where: {
                estudiante_id: esId,
                ejercicio_id: eId,
                estado: 'Aprobado'
            }
        });

        if (evaluacion) {
            return res.json({
                completado: true,
                ejercicio_id: eId,
                estudiante_id: esId,
                estado: 'Aprobado',
                calificacion: evaluacion.calificacion,
                fecha_evaluacion: evaluacion.fecha_evaluacion,
                mensaje: "El ejercicio ha sido completado y aprobado"
            });
        }

        // Si no hay evaluación aprobada, retornar que no está completado
        res.json({
            completado: false,
            ejercicio_id: eId,
            estudiante_id: esId,
            estado: 'No completado',
            mensaje: "El ejercicio no ha sido completado o no está aprobado"
        });

    } catch (error) {
        console.error('Error en verificarEjercicioCompletado:', error);
        res.status(500).json({
            message: "Error al verificar estado del ejercicio",
            error: error.message || error
        });
    }
};

/* ============================================================
   EXPORTACIONES
============================================================ */
module.exports = {
    crearRespuestaEjercicio,
    obtenerResultadoJudge0,
    obtenerRespuestasEjercicio,
    obtenerRespuestaEjercicioPorId,
    actualizarRespuestaEjercicio,
    eliminarRespuestaEjercicio,
    verificarEjercicioCompletado
};