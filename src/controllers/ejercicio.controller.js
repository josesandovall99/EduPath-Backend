const { Ejercicio, Actividad } = require('../models');

// Crear ejercicio con actividad base
exports.createEjercicio = async (req, res) => {
  try {
    const nuevoEjercicio = await Ejercicio.create(req.body);
    res.status(201).json(nuevoEjercicio);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el ejercicio", error });
  }
};


// Listar ejercicios con su actividad
exports.getEjercicios = async (req, res) => {
  try {
    const ejercicios = await Ejercicio.findAll({ include: ['Actividad'] });
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los ejercicios", error });
  }
};
