const db = require('../models');
const { Actividad, Miniproyecto, TipoActividad, sequelize } = db;

exports.create = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // 1. Crear Actividad (Padre)
    const nuevaActividad = await Actividad.create({
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      nivel_dificultad: req.body.nivel_dificultad,
      fecha_creacion: req.body.fecha_creacion || new Date(),
      tipo_actividad_id: req.body.tipo_actividad_id
    }, { transaction: t });

    // 2. Crear Miniproyecto (Hijo) heredando el ID
    const nuevoMiniproyecto = await Miniproyecto.create({
      id: nuevaActividad.id, 
      area_id: req.body.area_id,
      entregable: req.body.entregable,
      respuesta_miniproyecto: req.body.respuesta_miniproyecto
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      message: "Miniproyecto y Actividad creados exitosamente",
      data: {
        id: nuevaActividad.id,
        ...nuevaActividad.get({ plain: true }),
        ...nuevoMiniproyecto.get({ plain: true })
      }
    });

  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: "Error en la creación: " + err.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Miniproyecto.findAll({
      include: [{ 
        model: Actividad,
        // Traemos también el nombre del Tipo de Actividad (Anidado)
        include: [{ model: TipoActividad, as: 'tipo' }] 
      }] 
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const data = await Miniproyecto.findByPk(req.params.id, {
      include: [{ 
        model: Actividad,
        include: [{ model: TipoActividad, as: 'tipo' }]
      }]
    });
    if (!data) return res.status(404).json({ message: "Miniproyecto no encontrado" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Actualizamos Actividad
    await Actividad.update(req.body, { 
      where: { id: req.params.id }, 
      transaction: t 
    });
    // Actualizamos Miniproyecto
    await Miniproyecto.update(req.body, { 
      where: { id: req.params.id }, 
      transaction: t 
    });

    await t.commit();
    res.json({ message: 'Registro actualizado correctamente en ambas tablas' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    // ON DELETE CASCADE en la BD se encarga del hijo al borrar al padre
    const deleted = await Actividad.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "Registro no encontrado" });
    res.json({ message: 'Miniproyecto y Actividad eliminados correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};