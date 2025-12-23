const db = require('../models');
const { Actividad, Miniproyecto, TipoActividad, Area, sequelize } = db;

// Función auxiliar para validar FKs (Evita repetir código)
const validarRelaciones = async (tipo_id, area_id) => {
  if (tipo_id) {
    const existe = await TipoActividad.findByPk(tipo_id);
    if (!existe) throw new Error(`El tipo_actividad_id (${tipo_id}) no existe.`);
  }
  if (area_id) {
    const existe = await Area.findByPk(area_id);
    if (!existe) throw new Error(`El area_id (${area_id}) no existe.`);
  }
};

exports.create = async (req, res) => {
  try {
    // 1. Validar existencia de FKs antes de iniciar
    await validarRelaciones(req.body.tipo_actividad_id, req.body.area_id);

    const t = await sequelize.transaction();
    try {
      const nuevaActividad = await Actividad.create({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        nivel_dificultad: req.body.nivel_dificultad,
        fecha_creacion: req.body.fecha_creacion || new Date(),
        tipo_actividad_id: req.body.tipo_actividad_id
      }, { transaction: t });

      const nuevoMiniproyecto = await Miniproyecto.create({
        id: nuevaActividad.id,
        area_id: req.body.area_id,
        entregable: req.body.entregable,
        respuesta_miniproyecto: req.body.respuesta_miniproyecto
      }, { transaction: t });

      await t.commit();
      res.status(201).json({
        message: "Creado exitosamente",
        data: { ...nuevaActividad.toJSON(), ...nuevoMiniproyecto.toJSON() }
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // 1. Validar FKs solo si vienen en el body
    await validarRelaciones(req.body.tipo_actividad_id, req.body.area_id);

    // 2. Verificar si el registro existe antes de editar
    const miniproyecto = await Miniproyecto.findByPk(req.params.id);
    if (!miniproyecto) return res.status(404).json({ message: "Miniproyecto no encontrado" });

    const t = await sequelize.transaction();
    try {
      // Actualizar tabla padre
      await Actividad.update(req.body, { 
        where: { id: req.params.id }, 
        transaction: t 
      });
      // Actualizar tabla hija
      await Miniproyecto.update(req.body, { 
        where: { id: req.params.id }, 
        transaction: t 
      });

      await t.commit();
      res.json({ message: 'Actualizado correctamente' });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ... findAll, findOne y delete se mantienen igual ...

exports.findAll = async (req, res) => {
  try {
    const data = await Miniproyecto.findAll({
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

exports.delete = async (req, res) => {
  try {
    const deleted = await Actividad.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "Registro no encontrado" });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};