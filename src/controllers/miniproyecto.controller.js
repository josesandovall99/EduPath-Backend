
const { Miniproyecto } = require('../models');

exports.create = async (req, res) => {
  try {
    const data = await Miniproyecto.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findAll = async (req, res) => {
  const data = await Miniproyecto.findAll();
  res.json(data);
};

exports.findOne = async (req, res) => {
  const data = await Miniproyecto.findByPk(req.params.id);
  res.json(data);
};

exports.update = async (req, res) => {
  await Miniproyecto.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'Actualizado correctamente' });
};

exports.delete = async (req, res) => {
  await Miniproyecto.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Eliminado correctamente' });
};
