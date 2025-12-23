const { sequelize, Ejercicio, Actividad, Subtema } = require('../models');

// Crear ejercicio con su actividad base (herencia con transacción)
exports.createEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { actividad, ejercicio } = req.body;

    // Validar subtema
    const subtemaExistente = await Subtema.findByPk(ejercicio.subtema_id);
    if (!subtemaExistente) {
      await t.rollback();
      return res.status(400).json({ message: "El subtema especificado no existe" });
    }

    // Crear la actividad primero
    const nuevaActividad = await Actividad.create(actividad, { transaction: t });

    // Crear el ejercicio usando el mismo id de la actividad
    const nuevoEjercicio = await Ejercicio.create(
      {
        id: nuevaActividad.id, // herencia: mismo PK que Actividad
        subtema_id: ejercicio.subtema_id,
        puntos: ejercicio.puntos,
        resultado_ejercicio: ejercicio.resultado_ejercicio
      },
      { transaction: t }
    );

    // Confirmar transacción
    await t.commit();

    res.status(201).json({
      actividad: nuevaActividad,
      ejercicio: nuevoEjercicio
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al crear el ejercicio", error: error.message || error });
  }
};

// Listar ejercicios con su actividad
exports.getEjercicios = async (req, res) => {
  try {
    const ejercicios = await Ejercicio.findAll({
      include: [
        { model: Actividad, as: 'detallesEjercicio' }, // alias definido en index.js
        { model: Subtema } // opcional: incluir también el subtema
      ]
    });
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los ejercicios", error: error.message || error });
  }
};

// Obtener un ejercicio por ID
exports.getEjercicioById = async (req, res) => {
  try {
    const ejercicio = await Ejercicio.findByPk(req.params.id, {
      include: [
        { model: Actividad, as: 'detallesEjercicio' },
        { model: Subtema }
      ]
    });
    if (!ejercicio) return res.status(404).json({ message: "Ejercicio no encontrado" });
    res.json(ejercicio);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el ejercicio", error: error.message || error });
  }
};

// Actualizar ejercicio y su actividad (transacción)
exports.updateEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ejercicio = await Ejercicio.findByPk(req.params.id);
    if (!ejercicio) {
      await t.rollback();
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    const actividad = await Actividad.findByPk(req.params.id);
    if (!actividad) {
      await t.rollback();
      return res.status(404).json({ message: "Actividad asociada no encontrada" });
    }

    // Validar subtema si se envía
    if (req.body.subtema_id) {
      const subtemaExistente = await Subtema.findByPk(req.body.subtema_id);
      if (!subtemaExistente) {
        await t.rollback();
        return res.status(400).json({ message: "El subtema especificado no existe" });
      }
    }

    // Actualizar actividad y ejercicio en conjunto
    if (req.body.actividad) {
      await actividad.update(req.body.actividad, { transaction: t });
    }
    if (req.body.ejercicio) {
      await ejercicio.update(req.body.ejercicio, { transaction: t });
    }

    await t.commit();
    res.json({ actividad, ejercicio });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al actualizar el ejercicio", error: error.message || error });
  }
};

// Eliminar ejercicio y su actividad (transacción)
exports.deleteEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ejercicio = await Ejercicio.findByPk(req.params.id);
    if (!ejercicio) {
      await t.rollback();
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    const actividad = await Actividad.findByPk(req.params.id);

    // Eliminar ambos
    await ejercicio.destroy({ transaction: t });
    if (actividad) {
      await actividad.destroy({ transaction: t });
    }

    await t.commit();
    res.json({ message: "Ejercicio y actividad eliminados correctamente" });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al eliminar el ejercicio", error: error.message || error });
  }
};
