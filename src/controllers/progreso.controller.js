const { Area, Estudiante, Tema, Subtema, Contenido, Ejercicio, Evaluacion, Miniproyecto, Progreso, RespuestaEstudianteMiniproyecto, RespuestaEstudianteEjercicio, SecuenciaContenido } = require('../models');
const { Op } = require('sequelize');

exports.create = async (req, res) => {
  try {
    res.status(201).json(await Progreso.create(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Obtener progreso de un estudiante por TEMA (contenidos del tema)
exports.obtenerProgresoEstudiantePorTema = async (req, res) => {
  try {
    const { tema_id, estudiante_id } = req.query;

    if (!tema_id || !estudiante_id) {
      return res.status(400).json({ message: "tema_id y estudiante_id son requeridos como parámetros de query" });
    }

    const tId = parseInt(tema_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (isNaN(tId) || isNaN(esId)) {
      return res.status(400).json({ message: "tema_id y estudiante_id deben ser números válidos" });
    }

    const tema = await Tema.findByPk(tId);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });

    const contenidosDelTema = await Contenido.findAll({ where: { tema_id: tId }, attributes: ['id'] });
    const contenidoIdsDelTema = contenidosDelTema.map(c => c.id);

    const secuencias = await SecuenciaContenido.findAll({
      where: {
        estado: true,
        [Op.or]: [
          { contenido_origen_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } },
          { contenido_destino_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } }
        ]
      },
      attributes: ['contenido_origen_id', 'contenido_destino_id']
    });

    const contenidoIdsEnSecuencia = new Set();
    secuencias.forEach(seq => {
      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);
      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);
    });

    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelTema.includes(id));
    const totalContenidos = contenidoIds.length;

    const contenidosVisualizados = totalContenidos > 0 ? await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    }) : 0;

    const porcentaje = totalContenidos > 0 ? Math.round((contenidosVisualizados / totalContenidos) * 100) : 0;

    res.json({
      tema: { id: tema.id, nombre: tema.nombre },
      estudiante_id: esId,
      progreso: {
        contenidos: {
          total: totalContenidos,
          completados: contenidosVisualizados,
          porcentaje
        }
      },
      resumen: {
        totalItems: totalContenidos,
        itemsCompletados: contenidosVisualizados,
        porcentajeTotalTema: porcentaje,
        estado: porcentaje === 100 ? 'Completado' : porcentaje >= 50 ? 'En progreso' : 'Iniciado'
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerProgresoEstudiantePorTema:', error);
    res.status(500).json({ message: 'Error al obtener progreso del estudiante por tema', error: error.message || error });
  }
};

// Obtener progreso de un estudiante por SUBTEMA (contenidos del subtema)
exports.obtenerProgresoEstudiantePorSubtema = async (req, res) => {
  try {
    const { subtema_id, estudiante_id } = req.query;

    if (!subtema_id || !estudiante_id) {
      return res.status(400).json({ message: "subtema_id y estudiante_id son requeridos como parámetros de query" });
    }

    const sId = parseInt(subtema_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (isNaN(sId) || isNaN(esId)) {
      return res.status(400).json({ message: "subtema_id y estudiante_id deben ser números válidos" });
    }

    const subtema = await Subtema.findByPk(sId);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    const contenidosDelSubtema = await Contenido.findAll({ where: { subtema_id: sId }, attributes: ['id'] });
    const contenidoIdsDelSubtema = contenidosDelSubtema.map(c => c.id);

    const secuencias = await SecuenciaContenido.findAll({
      where: {
        estado: true,
        [Op.or]: [
          { contenido_origen_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } },
          { contenido_destino_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } }
        ]
      },
      attributes: ['contenido_origen_id', 'contenido_destino_id']
    });

    const contenidoIdsEnSecuencia = new Set();
    secuencias.forEach(seq => {
      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);
      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);
    });

    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelSubtema.includes(id));
    const totalContenidos = contenidoIds.length;

    const contenidosVisualizados = totalContenidos > 0 ? await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    }) : 0;

    const porcentaje = totalContenidos > 0 ? Math.round((contenidosVisualizados / totalContenidos) * 100) : 0;

    res.json({
      subtema: { id: subtema.id, nombre: subtema.nombre },
      estudiante_id: esId,
      progreso: {
        contenidos: {
          total: totalContenidos,
          completados: contenidosVisualizados,
          porcentaje
        }
      },
      resumen: {
        totalItems: totalContenidos,
        itemsCompletados: contenidosVisualizados,
        porcentajeTotalSubtema: porcentaje,
        estado: porcentaje === 100 ? 'Completado' : porcentaje >= 50 ? 'En progreso' : 'Iniciado'
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerProgresoEstudiantePorSubtema:', error);
    res.status(500).json({ message: 'Error al obtener progreso del estudiante por subtema', error: error.message || error });
  }
};

// Resumen de unidades para un estudiante (unidad = 'tema' o 'subtema')
// Query params: unidad_tipo ('tema'|'subtema'), unidad_id, estudiante_id
exports.obtenerResumenUnidadEstudiante = async (req, res) => {
  try {
    const { unidad_tipo, unidad_id, estudiante_id } = req.query;

    if (!unidad_tipo || !unidad_id || !estudiante_id) {
      return res.status(400).json({ message: "unidad_tipo, unidad_id y estudiante_id son requeridos como query params" });
    }

    const tipo = unidad_tipo.toString().toLowerCase();
    const uId = parseInt(unidad_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (!['tema', 'subtema'].includes(tipo)) {
      return res.status(400).json({ message: "unidad_tipo debe ser 'tema' o 'subtema'" });
    }
    if (isNaN(uId) || isNaN(esId)) {
      return res.status(400).json({ message: "unidad_id y estudiante_id deben ser números válidos" });
    }

    // Determinar contenidos y ejercicios según tipo
    let contenidoIds = [];
    let ejercicioIds = [];
    let areaId = null;

    if (tipo === 'tema') {
      const tema = await Tema.findByPk(uId);
      if (!tema) return res.status(404).json({ message: 'Tema no encontrado' });
      areaId = tema.area_id;

      const contenidos = await Contenido.findAll({ where: { tema_id: uId }, attributes: ['id'] });
      const contenidoIdsDelTema = contenidos.map(c => c.id);

      // contenidos válidos en secuencia activa
      const secuencias = await SecuenciaContenido.findAll({
        where: {
          estado: true,
          [Op.or]: [
            { contenido_origen_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } },
            { contenido_destino_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } }
          ]
        },
        attributes: ['contenido_origen_id', 'contenido_destino_id']
      });

      const contenidoIdsEnSecuencia = new Set();
      secuencias.forEach(s => { contenidoIdsEnSecuencia.add(s.contenido_origen_id); contenidoIdsEnSecuencia.add(s.contenido_destino_id); });
      contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelTema.includes(id));

      const subtemas = await Subtema.findAll({ where: { tema_id: uId }, attributes: ['id'] });
      const subtemaIds = subtemas.map(s => s.id);
      const ejercicios = await Ejercicio.findAll({ where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] } }, attributes: ['id'] });
      ejercicioIds = ejercicios.map(e => e.id);

    } else { // subtema
      const subtema = await Subtema.findByPk(uId);
      if (!subtema) return res.status(404).json({ message: 'Subtema no encontrado' });

      const tema = await Tema.findByPk(subtema.tema_id);
      areaId = tema ? tema.area_id : null;

      const contenidos = await Contenido.findAll({ where: { subtema_id: uId }, attributes: ['id'] });
      const contenidoIdsDelSubtema = contenidos.map(c => c.id);

      const secuencias = await SecuenciaContenido.findAll({
        where: {
          estado: true,
          [Op.or]: [
            { contenido_origen_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } },
            { contenido_destino_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } }
          ]
        },
        attributes: ['contenido_origen_id', 'contenido_destino_id']
      });

      const contenidoIdsEnSecuencia = new Set();
      secuencias.forEach(s => { contenidoIdsEnSecuencia.add(s.contenido_origen_id); contenidoIdsEnSecuencia.add(s.contenido_destino_id); });
      contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelSubtema.includes(id));

      const ejercicios = await Ejercicio.findAll({ where: { subtema_id: uId }, attributes: ['id'] });
      ejercicioIds = ejercicios.map(e => e.id);
    }

    // Conteos
    const totalContenidos = contenidoIds.length;
    const contenidosCompletados = totalContenidos > 0 ? await Progreso.count({ where: { estudiante_id: esId, contenido_id: { [Op.in]: contenidoIds }, completado: true, estado: 'Visualizado' } }) : 0;

    const totalEjercicios = ejercicioIds.length;
    const ejerciciosCompletados = totalEjercicios > 0 ? await RespuestaEstudianteEjercicio.count({ where: { estudiante_id: esId, ejercicio_id: { [Op.in]: ejercicioIds }, estado: { [Op.in]: ['ENVIADO', 'APROBADO'] } } }) : 0;

    let totalMiniproyectos = 0;
    let miniproyectosCompletados = 0;
    if (areaId) {
      const respuestasMiniproyectos = await RespuestaEstudianteMiniproyecto.findAll({
        where: { estudiante_id: esId, estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] } },
        include: [{ model: Miniproyecto, as: 'miniproyecto', where: { area_id: areaId }, attributes: ['id'] }]
      });
      totalMiniproyectos = await Miniproyecto.count({ where: { area_id: areaId } });
      miniproyectosCompletados = respuestasMiniproyectos.length;
    }

    res.json({
      unidad: { tipo, id: uId },
      estudiante_id: esId,
      resumen: {
        contenidos: { total: totalContenidos, completados: contenidosCompletados, porcentaje: totalContenidos > 0 ? Math.round((contenidosCompletados/totalContenidos)*100) : 0 },
        ejercicios: { total: totalEjercicios, completados: ejerciciosCompletados, porcentaje: totalEjercicios > 0 ? Math.round((ejerciciosCompletados/totalEjercicios)*100) : 0 },
        miniproyectos: { total: totalMiniproyectos, completados: miniproyectosCompletados, porcentaje: totalMiniproyectos > 0 ? Math.round((miniproyectosCompletados/totalMiniproyectos)*100) : 0 }
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerResumenUnidadEstudiante:', error);
    res.status(500).json({ message: 'Error al obtener resumen de unidad para el estudiante', error: error.message || error });
  }
};

exports.findAll = async (req, res) => {
  res.json(await Progreso.findAll());
};

exports.findOne = async (req, res) => {
  res.json(await Progreso.findByPk(req.params.id));
};

exports.update = async (req, res) => {
  await Progreso.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'Progreso actualizado' });
};

exports.delete = async (req, res) => {
  await Progreso.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Progreso eliminado' });
};

// Obtener progreso de un estudiante por área (para la barra de progreso)
exports.obtenerProgresoEstudiantePorArea = async (req, res) => {
  try {
    const { area_id, estudiante_id } = req.query;

    if (!area_id || !estudiante_id) {
      return res.status(400).json({
        message: "area_id y estudiante_id son requeridos como parámetros de query"
      });
    }

    const aId = parseInt(area_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (isNaN(aId) || isNaN(esId)) {
      return res.status(400).json({
        message: "area_id y estudiante_id deben ser números válidos"
      });
    }

    const area = await Area.findByPk(aId);
    if (!area) {
      return res.status(404).json({ message: "Área no encontrada" });
    }

    const estudiante = await Estudiante.findByPk(esId);
    if (!estudiante) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    const temas = await Tema.findAll({
      where: { area_id: aId },
      attributes: ['id']
    });
    const temaIds = temas.map(t => t.id);

    // ==========================================
    // 1. CONTENIDOS DEL ÁREA (filtrados por secuencia activa)
    // ==========================================
    const contenidosDelArea = await Contenido.findAll({
      where: { tema_id: { [Op.in]: temaIds } },
      attributes: ['id']
    });
    const contenidoIdsDelArea = contenidosDelArea.map(c => c.id);

    const secuencias = await SecuenciaContenido.findAll({
      where: {
        estado: true,
        [Op.or]: [
          { contenido_origen_id: { [Op.in]: contenidoIdsDelArea } },
          { contenido_destino_id: { [Op.in]: contenidoIdsDelArea } }
        ]
      },
      attributes: ['contenido_origen_id', 'contenido_destino_id']
    });

    const contenidoIdsEnSecuencia = new Set();
    secuencias.forEach(seq => {
      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);
      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);
    });

    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelArea.includes(id));
    const totalContenidos = contenidoIds.length;

    const contenidosVisualizados = await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    });

    console.log(`📦 Contenido IDs usados para el cálculo de progreso (en secuencia activa):`, contenidoIds);
    console.log(`👁️ Contenidos visualizados por estudiante ${esId}: ${contenidosVisualizados}`);

    // ==========================================
    // 2. EJERCICIOS DEL ÁREA (desde respuestas enviadas o aprobadas)
    // ==========================================
    const subtemas = await Subtema.findAll({
      where: { tema_id: { [Op.in]: temaIds } },
      attributes: ['id']
    });
    const subtemaIds = subtemas.map(s => s.id);

    const ejerciciosArea = await Ejercicio.findAll({
      where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] } },
      attributes: ['id']
    });
    const ejercicioIds = ejerciciosArea.map(e => e.id);
    const totalEjercicios = ejercicioIds.length;

    const ejerciciosCompletados = await RespuestaEstudianteEjercicio.count({
      where: {
        estudiante_id: esId,
        ejercicio_id: { [Op.in]: ejercicioIds },
        estado: { [Op.in]: ['ENVIADO', 'APROBADO'] }
      }
    });

    // ==========================================
    // 3. MINIPROYECTOS DEL ÁREA (desde respuestas enviadas o completadas)
    // ==========================================
    const respuestasMiniproyectos = await RespuestaEstudianteMiniproyecto.findAll({
      where: {
        estudiante_id: esId,
        estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] }
      },
      include: [{
        model: Miniproyecto,
        as: 'miniproyecto', // 👈 alias obligatorio
        where: { area_id: aId },
        attributes: ['id']
      }]
    });

    const totalMiniproyectos = respuestasMiniproyectos.length;
    const miniproyectosCompletados = totalMiniproyectos;

    // ==========================================
    // 4. CÁLCULO DE PORCENTAJE
    // ==========================================
    let totalItems = 0;
    let itemsCompletados = 0;

    if (totalContenidos > 0) {
      totalItems += totalContenidos;
      itemsCompletados += contenidosVisualizados;
    }

    if (totalEjercicios > 0) {
      totalItems += totalEjercicios;
      itemsCompletados += ejerciciosCompletados;
    }

    if (totalMiniproyectos > 0) {
      totalItems += totalMiniproyectos;
      itemsCompletados += miniproyectosCompletados;
    }

    let porcentajeProgreso = 0;
    if (totalItems > 0) {
      porcentajeProgreso = Math.round((itemsCompletados / totalItems) * 100);
    }

    const progresoDetallado = {};

    if (totalContenidos > 0) {
      progresoDetallado.contenidos = {
        total: totalContenidos,
        completados: contenidosVisualizados,
        porcentaje: Math.round((contenidosVisualizados / totalContenidos) * 100)
      };
    }

    if (totalEjercicios > 0) {
      progresoDetallado.ejercicios = {
        total: totalEjercicios,
        completados: ejerciciosCompletados,
        porcentaje: Math.round((ejerciciosCompletados / totalEjercicios) * 100)
      };
    }

    if (totalMiniproyectos > 0) {
      progresoDetallado.miniproyectos = {
        total: totalMiniproyectos,
        completados: miniproyectosCompletados,
        porcentaje: Math.round((miniproyectosCompletados / totalMiniproyectos) * 100)
      };
    }

    res.json({
      area: {
        id: area.id,
        nombre: area.nombre
      },
      estudiante_id: esId,
      progreso: progresoDetallado,
      resumen: {
        totalItems,
        itemsCompletados,
        porcentajeTotalArea: porcentajeProgreso,
        estado: porcentajeProgreso === 100 ? 'Completado' : porcentajeProgreso >= 50 ? 'En progreso' : 'Iniciado'
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerProgresoEstudiantePorArea:', error);
    res.status(500).json({
      message: "Error al obtener progreso del estudiante por área",
      error: error.message || error
    });
  }
};

// Obtener calificación estimada general de un estudiante
// Query params: estudiante_id
exports.getCalificacionEstimada = async (req, res) => {
  try {
    const estudianteId = parseInt(req.query.estudiante_id || req.params.estudiante_id, 10);
    if (!estudianteId || isNaN(estudianteId)) {
      return res.status(400).json({ message: 'estudiante_id es requerido y debe ser un número' });
    }

    // Obtener evaluaciones del estudiante (excluir estados claramente pendientes si aplica)
    const evaluaciones = await Evaluacion.findAll({
      where: {
        estudiante_id: estudianteId,
        estado: { [Op.notIn]: ['PENDIENTE', 'BORRADOR'] }
      },
      attributes: ['calificacion', 'ejercicio_id', 'miniproyecto_id', 'fecha_evaluacion', 'estado']
    });

    if (!evaluaciones || evaluaciones.length === 0) {
      return res.json({ estudiante_id: estudianteId, promedio: null, totalEvaluaciones: 0, mensaje: 'No hay evaluaciones disponibles' });
    }

    const total = evaluaciones.length;
    const suma = evaluaciones.reduce((acc, ev) => acc + (ev.calificacion ? parseFloat(ev.calificacion) : 0), 0);
    const promedio = parseFloat((suma / total).toFixed(2));

    // Desglose por tipo
    const porTipo = {
      ejercicios: { count: 0, promedio: null },
      miniproyectos: { count: 0, promedio: null }
    };

    const evalEjercicios = evaluaciones.filter(e => e.ejercicio_id !== null);
    if (evalEjercicios.length > 0) {
      const sumaE = evalEjercicios.reduce((a, e) => a + (e.calificacion ? parseFloat(e.calificacion) : 0), 0);
      porTipo.ejercicios.count = evalEjercicios.length;
      porTipo.ejercicios.promedio = parseFloat((sumaE / evalEjercicios.length).toFixed(2));
    }

    const evalMinis = evaluaciones.filter(e => e.miniproyecto_id !== null);
    if (evalMinis.length > 0) {
      const sumaM = evalMinis.reduce((a, e) => a + (e.calificacion ? parseFloat(e.calificacion) : 0), 0);
      porTipo.miniproyectos.count = evalMinis.length;
      porTipo.miniproyectos.promedio = parseFloat((sumaM / evalMinis.length).toFixed(2));
    }

    // Última evaluación
    const ultima = evaluaciones.reduce((latest, e) => {
      const fecha = e.fecha_evaluacion ? new Date(e.fecha_evaluacion) : null;
      if (!fecha) return latest;
      return !latest || fecha > latest ? fecha : latest;
    }, null);

    res.json({
      estudiante_id: estudianteId,
      promedio,
      totalEvaluaciones: total,
      porTipo,
      ultimaEvaluacion: ultima ? ultima.toISOString() : null
    });

  } catch (error) {
    console.error('❌ Error en getCalificacionEstimada:', error);
    res.status(500).json({ message: 'Error al obtener calificación estimada', error: error.message || error });
  }
};

