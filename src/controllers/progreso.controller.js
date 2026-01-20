const { Area, Estudiante, Tema, Subtema, Contenido, Ejercicio, Evaluacion, Miniproyecto, Progreso, RespuestaEstudianteMiniproyecto, RespuestaEstudianteEjercicio, SecuenciaContenido } = require('../models');
const { Op } = require('sequelize');

exports.create = async (req, res) => {
  try {
    res.status(201).json(await Progreso.create(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
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

