const { Evaluacion } = require('../models');

exports.create = async (req, res) => {
  try {
    const data = await Evaluacion.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  res.json(await Evaluacion.findAll());
};

exports.findOne = async (req, res) => {
  res.json(await Evaluacion.findByPk(req.params.id));
};

exports.update = async (req, res) => {
  await Evaluacion.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'Evaluación actualizada' });
};

exports.delete = async (req, res) => {
  await Evaluacion.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Evaluación eliminada' });
};
