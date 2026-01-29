const { RespuestaEstudianteEjercicio, Estudiante, Ejercicio, Evaluacion } = require("../models");
const { Op } = require('sequelize');

/* ============================================================
   1. CREAR RESPUESTA (POST)
============================================================ */
const crearRespuestaEjercicio = async (req, res) => {
    try {
        const { respuesta, estudiante_id, ejercicio_id, estado } = req.body;

        if (typeof respuesta === 'undefined' || respuesta === null || !estudiante_id || !ejercicio_id) {
            return res.status(400).json({ error: "Faltan campos obligatorios: respuesta, estudiante_id, ejercicio_id" });
        }

        const ejercicio = await Ejercicio.findByPk(ejercicio_id);
        if (!ejercicio) {
            return res.status(404).json({ error: "El ejercicio no existe" });
        }

        // Evitar duplicados: un intento por estudiante por ejercicio
        const existente = await RespuestaEstudianteEjercicio.findOne({
            where: { estudiante_id, ejercicio_id }
        });
        if (existente) {
            return res.status(409).json({
                error: "Ya existe una respuesta para este estudiante en este ejercicio",
                intentoId: existente.id
            });
        }

        // Normalizar respuesta: admitir string/objeto/arreglo
        let respuestaPayload = respuesta;
        if (typeof respuesta === 'string') {
            respuestaPayload = { texto: respuesta };
        }
        // Nota: si a futuro se reciben archivos, se pueden anexar en respuestaPayload.archivos

        // Registrar el intento con estado opcional (por defecto 'ENVIADO')
        const nuevoIntento = await RespuestaEstudianteEjercicio.create({
            respuesta: respuestaPayload,
            estudiante_id,
            ejercicio_id,
            estado: estado || 'ENVIADO'
        });

        res.status(201).json(nuevoIntento);
    } catch (error) {
        console.error("Error en crearRespuesta:", error.message);
        res.status(500).json({ error: "Error al crear la respuesta", detalle: error.message });
    }
};

/* ============================================================
   2. OBTENER RESULTADO (GET)
============================================================ */
// Ya no hay integración con Judge0 en este módulo según el diagrama

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
    obtenerRespuestasEjercicio,
    obtenerRespuestaEjercicioPorId,
    actualizarRespuestaEjercicio,
    eliminarRespuestaEjercicio,
    verificarEjercicioCompletado
};