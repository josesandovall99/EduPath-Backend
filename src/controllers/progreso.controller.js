const { Progreso } = require('../models');

exports.create = async (req, res) => {
  try {
    res.status(201).json(await Progreso.create(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  res.json(await Progreso.findAll());
};

exports.findOne = async (req, res) => {
  res.json(await Progreso.findByPk(req.params.id));
};

exports.update = async (req, res) => {
  await Progreso.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'Progreso actualizado' });
};

exports.delete = async (req, res) => {
  await Progreso.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Progreso eliminado' });
};
