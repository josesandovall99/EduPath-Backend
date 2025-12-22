const db = require('../models');

// Esta línea asegura que capturemos el modelo sin importar si en el index 
// se exportó como 'evaluacion' o 'Evaluacion'
const Evaluacion = db.Evaluacion || db.evaluacion;

exports.create = async (req, res) => {
    try {
        if (!Evaluacion) throw new Error("Modelo Evaluacion no encontrado en db");
        const data = await Evaluacion.create(req.body);
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.findAll = async (req, res) => {
    try {
        if (!Evaluacion) throw new Error("Modelo Evaluacion no encontrado en db");
        const data = await Evaluacion.findAll();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.findOne = async (req, res) => {
    try {
        const data = await Evaluacion.findByPk(req.params.id);
        if (!data) return res.status(404).json({ message: "No se encontró la evaluación" });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.update = async (req, res) => {
    try {
        const [updated] = await Evaluacion.update(req.body, { where: { id: req.params.id } });
        if (updated === 0) return res.status(404).json({ message: "No se encontró el registro para actualizar" });
        res.json({ message: 'Evaluación actualizada' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const deleted = await Evaluacion.destroy({ where: { id: req.params.id } });
        if (deleted === 0) return res.status(404).json({ message: "No se encontró el registro para eliminar" });
        res.json({ message: 'Evaluación eliminada' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};