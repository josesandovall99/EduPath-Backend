const { RespuestaEstudianteEjercicio, Estudiante, Ejercicio, Evaluacion } = require("../models");

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

        const estudiante = await Estudiante.findByPk(estudiante_id);
        const periodo_academico = estudiante?.periodo_academico || "2026-A";

        // Normalizar respuesta: admitir string, objeto o arreglo
        let respuestaPayload = typeof respuesta === 'string' ? { texto: respuesta } : respuesta;

        // Un registro por estudiante+ejercicio+periodo; cada periodo inicia desde cero
        const existente = await RespuestaEstudianteEjercicio.findOne({
            where: { estudiante_id, ejercicio_id, periodo_academico }
        });

        if (existente) {
            const nuevoContador = (existente.contador || 0) + 1;
            await existente.update({
                respuesta: respuestaPayload,
                estado: estado || 'ENVIADO',
                contador: nuevoContador,
                periodo_academico
            });

            return res.status(200).json({
                ...existente.toJSON(),
                contador: nuevoContador,
                mensaje: 'Intento actualizado correctamente'
            });
        }

        const nuevoIntento = await RespuestaEstudianteEjercicio.create({
            respuesta: respuestaPayload,
            estudiante_id,
            ejercicio_id,
            estado: estado || 'ENVIADO',
            contador: 1,
            periodo_academico
        });

        res.status(201).json({
            ...nuevoIntento.toJSON(),
            mensaje: 'Intento creado correctamente'
        });
    } catch (error) {
        res.status(500).json({ error: "Error al crear la respuesta", detalle: error.message });
    }
};

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

const verificarEjercicioCompletado = async (req, res) => {
    try {
        const { ejercicio_id, estudiante_id } = req.query;

        if (!ejercicio_id || !estudiante_id) {
            return res.status(400).json({
                message: "ejercicio_id y estudiante_id son requeridos como parámetros de query"
            });
        }

        const eId = parseInt(ejercicio_id, 10);
        const esId = parseInt(estudiante_id, 10);

        if (isNaN(eId) || isNaN(esId)) {
            return res.status(400).json({
                message: "ejercicio_id y estudiante_id deben ser números válidos"
            });
        }

        const estudianteObj = await Estudiante.findByPk(esId, { attributes: ['id', 'periodo_academico'] });
        const periodoAcademico = estudianteObj?.periodo_academico || null;

        const evalWhere = { estudiante_id: esId, ejercicio_id: eId, estado: 'Aprobado' };
        if (periodoAcademico) evalWhere.periodo_academico = periodoAcademico;
        const evaluacion = await Evaluacion.findOne({ where: evalWhere });

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

        res.json({
            completado: false,
            ejercicio_id: eId,
            estudiante_id: esId,
            estado: 'No completado',
            mensaje: "El ejercicio no ha sido completado o no está aprobado"
        });

    } catch (error) {
        res.status(500).json({
            message: "Error al verificar estado del ejercicio",
            error: error.message || error
        });
    }
};

module.exports = {
    crearRespuestaEjercicio,
    obtenerRespuestasEjercicio,
    obtenerRespuestaEjercicioPorId,
    actualizarRespuestaEjercicio,
    eliminarRespuestaEjercicio,
    verificarEjercicioCompletado
};
