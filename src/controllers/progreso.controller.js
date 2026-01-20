const { Progreso, Area, Tema, Subtema, Contenido, Ejercicio, Miniproyecto, Evaluacion, RespuestaEstudianteMiniproyecto, Estudiante } = require('../models');
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

    // Convertir a números
    const aId = parseInt(area_id, 10);
    const esId = parseInt(estudiante_id, 10);

    // Validar que sean números válidos
    if (isNaN(aId) || isNaN(esId)) {
      return res.status(400).json({
        message: "area_id y estudiante_id deben ser números válidos"
      });
    }

    // Verificar que el área existe
    const area = await Area.findByPk(aId);
    if (!area) {
      return res.status(404).json({
        message: "Área no encontrada"
      });
    }

    // Verificar que el estudiante existe
    const estudiante = await Estudiante.findByPk(esId);
    if (!estudiante) {
      return res.status(404).json({
        message: "Estudiante no encontrado"
      });
    }

    // Obtener todos los temas del área
    const temas = await Tema.findAll({
      where: { area_id: aId },
      attributes: ['id']
    });

    const temaIds = temas.map(t => t.id);

    // ==========================================
    // 1. CONTENIDOS DEL ÁREA
    // ==========================================
    const contenidos = await Contenido.findAll({
      where: { tema_id: { [Op.in]: temaIds } },
      attributes: ['id']
    });

    const contenidoIds = contenidos.map(c => c.id);
    
    // Contenidos visualizados
    const contenidosVisualizados = await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    });

    const totalContenidos = contenidoIds.length;

    // ==========================================
    // 2. EJERCICIOS DEL ÁREA
    // ==========================================
    // Obtener subtemas del área
    const subtemas = await Subtema.findAll({
      where: { tema_id: { [Op.in]: temaIds } },
      attributes: ['id']
    });

    const subtemaIds = subtemas.map(s => s.id);

    // Obtener ejercicios a través de subtemas
    const ejerciciosArea = await Ejercicio.findAll({
      where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] } },
      attributes: ['id']
    });

    const ejercicioIds = ejerciciosArea.map(e => e.id);

    // Ejercicios completados/aprobados
    const ejerciciosCompletados = await Evaluacion.count({
      where: {
        estudiante_id: esId,
        ejercicio_id: { [Op.in]: ejercicioIds },
        estado: 'Aprobado'
      }
    });

    const totalEjercicios = ejercicioIds.length;

    // ==========================================
    // 3. MINIPROYECTOS DEL ÁREA
    // ==========================================
    // Obtener todos los miniproyectos (simplificado)
    let miniproyectoIds = [];
    let totalMiniproyectos = 0;
    let miniproyectosCompletados = 0;

    const miniproyectosArea = await Miniproyecto.findAll({
      attributes: ['id'],
      raw: true
    });

    miniproyectoIds = miniproyectosArea.map(m => m.id);

    if (miniproyectoIds.length > 0) {
      totalMiniproyectos = miniproyectoIds.length;

      // Miniproyectos completados
      miniproyectosCompletados = await RespuestaEstudianteMiniproyecto.count({
        where: {
          estudiante_id: esId,
          miniproyecto_id: { [Op.in]: miniproyectoIds },
          estado: 'Completado'
        }
      });
    }

    // ==========================================
    // 4. CÁLCULO DE PORCENTAJE
    // ==========================================
    // Contar solo los tipos que tienen al menos 1 item
    let totalItems = 0;
    let itemsCompletados = 0;

    // Sumar solo los que existen
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

    // Construir respuesta dinámica (solo incluir secciones que tengan items)
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
    console.error('Error en obtenerProgresoEstudiantePorArea:', error);
    res.status(500).json({
      message: "Error al obtener progreso del estudiante por área",
      error: error.message || error
    });
  }
};
