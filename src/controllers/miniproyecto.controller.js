const db = require('../models');
const { Actividad, Miniproyecto, TipoActividad, Area, Evaluacion, Estudiante, RespuestaEstudianteMiniproyecto, sequelize } = db;
const evaluacionController = require('./evaluacion.controller');

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

    if (req.docenteAreaId && parseInt(req.body.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

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

    if (req.docenteAreaId && parseInt(miniproyecto.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

    if (req.docenteAreaId && req.body.area_id !== undefined && parseInt(req.body.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

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

    if (req.docenteAreaId) {
      where.area_id = parseInt(req.docenteAreaId, 10);
    } else if (area_id !== undefined) {
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
    const attributes = req.docenteAreaId ? undefined : { exclude: ['area_id'] };
    const data = await Miniproyecto.findByPk(req.params.id, {
      attributes,
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

    if (req.docenteAreaId && parseInt(data.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

    if (req.docenteAreaId) {
      const payload = data.toJSON();
      delete payload.area_id;
      return res.json(payload);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    if (req.docenteAreaId) {
      const miniproyecto = await Miniproyecto.findByPk(req.params.id);
      if (!miniproyecto) return res.status(404).json({ message: "Registro no encontrado" });

      if (parseInt(miniproyecto.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
        return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
      }
    }

    const deleted = await Actividad.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "Registro no encontrado" });
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Enviar respuesta para miniproyecto de programacion
exports.enviarMiniproyectoProgramacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estudiante_id } = req.body || {};
    const codigo = req.body?.codigo || req.body?.respuesta?.codigo || req.body?.respuesta?.texto || '';
    const lenguaje_id = req.body?.lenguaje_id || req.body?.respuesta?.lenguaje_id;

    if (!estudiante_id || !codigo || !lenguaje_id) {
      return res.status(400).json({ message: 'Faltan campos: estudiante_id, lenguaje_id, codigo' });
    }

    const estudiante = await Estudiante.findByPk(estudiante_id);
    if (!estudiante) {
      return res.status(400).json({ message: `El estudiante_id (${estudiante_id}) no existe.` });
    }

    const miniproyecto = await Miniproyecto.findByPk(id);
    if (!miniproyecto) {
      return res.status(404).json({ message: 'Miniproyecto no encontrado' });
    }

    // Validar que sea miniproyecto de programacion (actividad_id = 1)
    if (Number(miniproyecto.actividad_id) !== 1) {
      return res.status(400).json({ message: 'El miniproyecto no es de programacion' });
    }

    const evalExistente = await Evaluacion.findOne({
      where: { estudiante_id, miniproyecto_id: parseInt(id, 10), estado: 'APROBADO' }
    });
    if (evalExistente) {
      return res.status(409).json({ message: 'Miniproyecto ya aprobado para el estudiante' });
    }

    let esperado = miniproyecto.respuesta_miniproyecto || '';
    let configuracion = {};

    if (miniproyecto.respuesta_miniproyecto) {
      try {
        const parsed = JSON.parse(miniproyecto.respuesta_miniproyecto);
        if (parsed && typeof parsed === 'object') {
          if (parsed.tipo === 'programacion' || parsed.esperado || parsed.lenguajesPermitidos || parsed.sintaxis) {
            esperado = parsed.esperado || '';
            configuracion = {
              esperado,
              sintaxis: parsed.sintaxis || [],
              lenguajesPermitidos: parsed.lenguajesPermitidos || []
            };
          }
        }
      } catch (err) {
        // Si no es JSON, se deja como texto esperado
      }
    }

    const evaluacion = await evaluacionController.evaluateCompilerSubmission({
      codigo,
      lenguaje_id,
      configuracion,
      esperado
    });

    if (!evaluacion || evaluacion.status === 500) {
      return res.status(500).json({ message: evaluacion?.message || 'Error evaluando el miniproyecto' });
    }

    if (evaluacion.status !== 200) {
      const respuestaPayload = JSON.stringify({
        codigo,
        lenguaje_id,
        stdout: evaluacion.data?.stdout || '',
        stderr: evaluacion.data?.stderr || '',
        esperado: evaluacion.data?.esperado,
        obtenido: evaluacion.data?.obtenido
      });

      const existenteRespuesta = await RespuestaEstudianteMiniproyecto.findOne({
        where: { estudiante_id, miniproyecto_id: parseInt(id, 10) }
      });

      if (existenteRespuesta) {
        const contadorActual = Number.isFinite(existenteRespuesta.contador)
          ? existenteRespuesta.contador
          : 0;
        await existenteRespuesta.update({
          respuesta: respuestaPayload,
          estado: 'REPROBADO',
          contador: contadorActual + 1
        });
      } else {
        await RespuestaEstudianteMiniproyecto.create({
          respuesta: respuestaPayload,
          estudiante_id,
          miniproyecto_id: parseInt(id, 10),
          estado: 'REPROBADO',
          contador: 1
        });
      }

      const evalPayload = {
        calificacion: 0,
        retroalimentacion: evaluacion.data?.estado || evaluacion.message || 'Respuesta incorrecta',
        estudiante_id,
        miniproyecto_id: parseInt(id, 10),
        estado: 'REPROBADO'
      };
      const evalPrev = await Evaluacion.findOne({ where: { estudiante_id, miniproyecto_id: parseInt(id, 10) } });
      if (evalPrev) {
        await evalPrev.update(evalPayload);
      } else {
        await Evaluacion.create(evalPayload);
      }

      return res.status(400).json({
        esCorrecta: false,
        ...evaluacion.data,
        message: evaluacion.message || 'Respuesta incorrecta'
      });
    }

    const respuestaPayload = JSON.stringify({
      codigo,
      lenguaje_id,
      stdout: evaluacion.data?.stdout || ''
    });

    const existenteRespuesta = await RespuestaEstudianteMiniproyecto.findOne({
      where: { estudiante_id, miniproyecto_id: parseInt(id, 10) }
    });

    if (existenteRespuesta) {
      const contadorActual = Number.isFinite(existenteRespuesta.contador)
        ? existenteRespuesta.contador
        : 0;
      await existenteRespuesta.update({
        respuesta: respuestaPayload,
        estado: 'COMPLETADO',
        contador: contadorActual + 1
      });
    } else {
      await RespuestaEstudianteMiniproyecto.create({
        respuesta: respuestaPayload,
        estudiante_id,
        miniproyecto_id: parseInt(id, 10),
        estado: 'COMPLETADO',
        contador: 1
      });
    }

    const evalPayload = {
      calificacion: 100,
      retroalimentacion: 'Aprobado automaticamente. Salida y sintaxis correctas.',
      estudiante_id,
      miniproyecto_id: parseInt(id, 10),
      estado: 'APROBADO'
    };
    const evalPrev = await Evaluacion.findOne({ where: { estudiante_id, miniproyecto_id: parseInt(id, 10) } });
    if (evalPrev) {
      await evalPrev.update(evalPayload);
    } else {
      await Evaluacion.create(evalPayload);
    }

    return res.status(200).json({
      esCorrecta: true,
      puntosObtenidos: 100,
      ...evaluacion.data
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error al evaluar miniproyecto', error: err.message || err });
  }
};