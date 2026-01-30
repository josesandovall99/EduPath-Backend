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
        actividad_id: nuevaActividad.id,
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
      const actividadPayload = {
        ...(req.body.titulo !== undefined && { titulo: req.body.titulo }),
        ...(req.body.descripcion !== undefined && { descripcion: req.body.descripcion }),
        ...(req.body.nivel_dificultad !== undefined && { nivel_dificultad: req.body.nivel_dificultad }),
        ...(req.body.fecha_creacion !== undefined && { fecha_creacion: req.body.fecha_creacion }),
        ...(req.body.tipo_actividad_id !== undefined && { tipo_actividad_id: req.body.tipo_actividad_id })
      };

      const miniproyectoPayload = {
        ...(req.body.area_id !== undefined && { area_id: req.body.area_id }),
        ...(req.body.entregable !== undefined && { entregable: req.body.entregable }),
        ...(req.body.respuesta_miniproyecto !== undefined && { respuesta_miniproyecto: req.body.respuesta_miniproyecto })
      };

      // Actualizar tabla padre (Actividad)
      if (Object.keys(actividadPayload).length > 0) {
        await Actividad.update(actividadPayload, {
          where: { id: miniproyecto.actividad_id },
          transaction: t
        });
      }

      // Actualizar tabla hija (Miniproyecto)
      if (Object.keys(miniproyectoPayload).length > 0) {
        await Miniproyecto.update(miniproyectoPayload, {
          where: { id: req.params.id },
          transaction: t
        });
      }

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
    const { area_id } = req.query;
    const where = {};

    if (area_id !== undefined) {
      const parsedAreaId = parseInt(area_id, 10);
      if (isNaN(parsedAreaId)) {
        return res.status(400).json({ error: 'area_id debe ser un número válido' });
      }
      where.area_id = parsedAreaId;
    }

    const data = await Miniproyecto.findAll({
      where,
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