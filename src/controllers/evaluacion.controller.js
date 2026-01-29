const db = require('../models');
const { Evaluacion, Estudiante, Ejercicio, Miniproyecto } = db;

// Función auxiliar de validación
const validarFKs = async (estudiante_id, ejercicio_id, miniproyecto_id) => {
  if (estudiante_id) {
    const existe = await Estudiante.findByPk(estudiante_id);
    if (!existe) throw new Error(`El estudiante_id (${estudiante_id}) no existe.`);
  }
  if (ejercicio_id) {
    const existe = await Ejercicio.findByPk(ejercicio_id);
    if (!existe) throw new Error(`El ejercicio_id (${ejercicio_id}) no existe.`);
  }
  if (miniproyecto_id) {
    const existe = await Miniproyecto.findByPk(miniproyecto_id);
    if (!existe) throw new Error(`El miniproyecto_id (${miniproyecto_id}) no existe.`);
  }
};

exports.create = async (req, res) => {
  try {
    await validarFKs(req.body.estudiante_id, req.body.ejercicio_id, req.body.miniproyecto_id);
    const data = await Evaluacion.create(req.body);
    res.status(201).json({ message: "Evaluación creada con éxito", data: data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Evaluacion.findAll({
      attributes: { exclude: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id'] },
      include: [
        { model: Estudiante },
        { model: Ejercicio },
        { model: Miniproyecto }
      ]
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ESTAS SON LAS QUE FALTABAN:
exports.findOne = async (req, res) => {
  try {
    const data = await Evaluacion.findByPk(req.params.id, {
      attributes: { exclude: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id'] },
      include: [{ model: Estudiante }, { model: Ejercicio }, { model: Miniproyecto }]
    });
    if (!data) return res.status(404).json({ message: "No se encontró la evaluación" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    await validarFKs(req.body.estudiante_id, req.body.ejercicio_id, req.body.miniproyecto_id);
    const [updated] = await Evaluacion.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ message: "No se encontró el registro" });
    res.json({ message: 'Evaluación actualizada correctamente' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await Evaluacion.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "No se encontró el registro" });
    res.json({ message: 'Evaluación eliminada correctamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Búsqueda por query params: estudiante_id, ejercicio_id, miniproyecto_id
exports.findBy = async (req, res) => {
  try {
    const { estudiante_id, ejercicio_id, miniproyecto_id } = req.query;
    const where = {};
    if (estudiante_id) where.estudiante_id = parseInt(estudiante_id, 10);
    if (ejercicio_id) where.ejercicio_id = parseInt(ejercicio_id, 10);
    if (miniproyecto_id) where.miniproyecto_id = parseInt(miniproyecto_id, 10);

    const data = await Evaluacion.findAll({
      where,
      attributes: { exclude: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id'] },
      include: [{ model: Estudiante }, { model: Ejercicio }, { model: Miniproyecto }]
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};