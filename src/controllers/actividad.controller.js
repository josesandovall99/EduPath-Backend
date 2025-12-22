const db = require('../models');

// Buscamos el modelo tanto en minúscula como en mayúscula para evitar el crash
const Actividad = db.Actividad || db.actividad;

exports.create = async (req, res) => {
  try {
    if (!Actividad) throw new Error("Modelo Actividad no encontrado en db");
    const data = await Actividad.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    if (!Actividad) throw new Error("Modelo Actividad no encontrado en db");
    const data = await Actividad.findAll();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const data = await Actividad.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: "Actividad no encontrada" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const [updated] = await Actividad.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ message: "No se encontró la actividad" });
    res.json({ message: 'Actividad actualizada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await Actividad.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "No se encontró la actividad" });
    res.json({ message: 'Actividad eliminada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};