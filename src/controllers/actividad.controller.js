const { Actividad } = require('../models');

exports.create = async (req, res) => {
  try {
    res.status(201).json(await Actividad.create(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  res.json(await Actividad.findAll());
};

exports.findOne = async (req, res) => {
  res.json(await Actividad.findByPk(req.params.id));
};

exports.update = async (req, res) => {
  await Actividad.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'Actividad actualizada' });
};

exports.delete = async (req, res) => {
  await Actividad.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Actividad eliminada' });
};
