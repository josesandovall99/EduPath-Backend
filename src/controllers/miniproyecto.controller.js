const db = require('../models');
// Añadimos Area a la desestructuración para poder validar su existencia
const { Actividad, Miniproyecto, TipoActividad, Area, sequelize } = db;

exports.create = async (req, res) => {
  const { tipo_actividad_id, area_id } = req.body;

  try {
    // 1. VALIDACIÓN: Verificar que los IDs de las llaves foráneas existan realmente
    const [tipoExiste, areaExiste] = await Promise.all([
      TipoActividad.findByPk(tipo_actividad_id),
      Area.findByPk(area_id)
    ]);

    if (!tipoExiste) {
      return res.status(400).json({ 
        error: `Validación fallida: El tipo_actividad_id (${tipo_actividad_id}) no existe en la tabla tipo_actividad.` 
      });
    }

    if (!areaExiste) {
      return res.status(400).json({ 
        error: `Validación fallida: El area_id (${area_id}) no existe en la tabla area.` 
      });
    }

    // 2. Si las validaciones pasan, procedemos con la Transacción
    const t = await sequelize.transaction();

    try {
      // Crear Actividad (Padre)
      const nuevaActividad = await Actividad.create({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        nivel_dificultad: req.body.nivel_dificultad,
        fecha_creacion: req.body.fecha_creacion || new Date(),
        tipo_actividad_id: tipo_actividad_id
      }, { transaction: t });

      // Crear Miniproyecto (Hijo)
      const nuevoMiniproyecto = await Miniproyecto.create({
        id: nuevaActividad.id, 
        area_id: area_id,
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
      // Si falla algo en la inserción, deshacemos todo
      await t.rollback();
      throw err; 
    }

  } catch (err) {
    res.status(500).json({ error: "Error interno: " + err.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Miniproyecto.findAll({
      // Limpieza: Excluimos el ID redundante del área porque ya traeremos el modelo Area
      attributes: { exclude: ['area_id'] },
      include: [
        { model: Area },
        { 
          model: Actividad,
          attributes: { exclude: ['tipo_actividad_id'] },
          include: [{ model: TipoActividad, as: 'tipo' }] 
        }
      ] 
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const data = await Miniproyecto.findByPk(req.params.id, {
      attributes: { exclude: ['area_id'] },
      include: [
        { model: Area },
        { 
          model: Actividad,
          attributes: { exclude: ['tipo_actividad_id'] },
          include: [{ model: TipoActividad, as: 'tipo' }]
        }
      ]
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
    // Nota: Aquí también podrías agregar validaciones de existencia si cambian los IDs
    await Actividad.update(req.body, { where: { id: req.params.id }, transaction: t });
    await Miniproyecto.update(req.body, { where: { id: req.params.id }, transaction: t });
    await t.commit();
    res.json({ message: 'Registro actualizado correctamente' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await Actividad.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "Registro no encontrado" });
    res.json({ message: 'Miniproyecto y Actividad eliminados correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};