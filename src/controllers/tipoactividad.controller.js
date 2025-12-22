const { TipoActividad } = require('../models');

exports.create = async (req, res) => {
  try {
    res.status(201).json(await TipoActividad.create(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  res.json(await TipoActividad.findAll());
};

exports.findOne = async (req, res) => {
  res.json(await TipoActividad.findByPk(req.params.id));
};

exports.update = async (req, res) => {
  await TipoActividad.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'TipoActividad actualizada' });
};

exports.delete = async (req, res) => {
  await TipoActividad.destroy({ where: { id: req.params.id } });
  res.json({ message: 'TipoActividad eliminada' });
};
