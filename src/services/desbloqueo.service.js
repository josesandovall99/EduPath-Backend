const { Contenido, Subtema, Tema, Progreso, SecuenciaContenido } = require('../models');
const { Op } = require('sequelize');

/**
 * Servicio para manejar la lógica de desbloqueo de contenidos, subtemas y temas
 * basado en el progreso del estudiante.
 * 
 * Reglas:
 * - El primer elemento siempre está desbloqueado
 * - Un contenido se desbloquea cuando su predecesor en la secuencia está completado
 * - Un subtema está completo cuando todos sus contenidos están completados
 * - Un tema está completo cuando todos sus subtemas están completos
 */

/**
 * Verifica si un contenido está desbloqueado para un estudiante
 * @param {number} estudianteId - ID del estudiante
 * @param {number} contenidoId - ID del contenido
 * @returns {Promise<{desbloqueado: boolean, razon: string}>}
 */
exports.verificarContenidoDesbloqueado = async (estudianteId, contenidoId) => {
  try {
    // Verificar que el contenido existe
    const contenido = await Contenido.findByPk(contenidoId);
    if (!contenido) {
      return { desbloqueado: false, razon: 'Contenido no encontrado' };
    }

    // Buscar si este contenido tiene un predecesor en la secuencia
    // (es decir, si existe una secuencia donde este contenido es el destino)
    const secuenciaEntrante = await SecuenciaContenido.findOne({
      where: {
        contenido_destino_id: contenidoId,
        estado: true
      }
    });

    // Si no tiene predecesor, es el primero y está desbloqueado
    if (!secuenciaEntrante) {
      return { desbloqueado: true, razon: 'Es el primer contenido de la secuencia' };
    }

    // Si tiene predecesor, verificar si el predecesor está completado
    const predecesorId = secuenciaEntrante.contenido_origen_id;
    const progresoPredecesor = await Progreso.findOne({
      where: {
        estudiante_id: estudianteId,
        contenido_id: predecesorId,
        completado: true,
        estado: 'Visualizado'
      }
    });

    if (progresoPredecesor) {
      return { desbloqueado: true, razon: 'Contenido predecesor completado' };
    } else {
      return { desbloqueado: false, razon: 'Contenido predecesor no completado' };
    }

  } catch (error) {
    console.error('Error en verificarContenidoDesbloqueado:', error);
    return { desbloqueado: false, razon: 'Error al verificar', error: error.message };
  }
};

/**
 * Verifica si un subtema está completo para un estudiante
 * @param {number} estudianteId - ID del estudiante
 * @param {number} subtemaId - ID del subtema
 * @returns {Promise<{completo: boolean, totalContenidos: number, contenidosCompletados: number}>}
 */
exports.verificarSubtemaCompleto = async (estudianteId, subtemaId) => {
  try {
    // Obtener todos los contenidos del subtema
    const contenidos = await Contenido.findAll({
      where: { subtema_id: subtemaId },
      attributes: ['id']
    });

    const totalContenidos = contenidos.length;

    if (totalContenidos === 0) {
      return { completo: true, totalContenidos: 0, contenidosCompletados: 0, razon: 'Sin contenidos' };
    }

    const contenidoIds = contenidos.map(c => c.id);

    // Contar cuántos contenidos están completados
    const contenidosCompletados = await Progreso.count({
      where: {
        estudiante_id: estudianteId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    });

    const completo = contenidosCompletados === totalContenidos;

    return {
      completo,
      totalContenidos,
      contenidosCompletados,
      porcentaje: Math.round((contenidosCompletados / totalContenidos) * 100)
    };

  } catch (error) {
    console.error('Error en verificarSubtemaCompleto:', error);
    return { completo: false, totalContenidos: 0, contenidosCompletados: 0, error: error.message };
  }
};

/**
 * Verifica si un tema está completo para un estudiante
 * @param {number} estudianteId - ID del estudiante
 * @param {number} temaId - ID del tema
 * @returns {Promise<{completo: boolean, totalSubtemas: number, subtemasCompletados: number}>}
 */
exports.verificarTemaCompleto = async (estudianteId, temaId) => {
  try {
    // Obtener todos los subtemas del tema
    const subtemas = await Subtema.findAll({
      where: { tema_id: temaId },
      attributes: ['id']
    });

    const totalSubtemas = subtemas.length;

    if (totalSubtemas === 0) {
      return { completo: true, totalSubtemas: 0, subtemasCompletados: 0, razon: 'Sin subtemas' };
    }

    // Verificar cuántos subtemas están completos
    let subtemasCompletados = 0;
    for (const subtema of subtemas) {
      const resultado = await this.verificarSubtemaCompleto(estudianteId, subtema.id);
      if (resultado.completo) {
        subtemasCompletados++;
      }
    }

    const completo = subtemasCompletados === totalSubtemas;

    return {
      completo,
      totalSubtemas,
      subtemasCompletados,
      porcentaje: Math.round((subtemasCompletados / totalSubtemas) * 100)
    };

  } catch (error) {
    console.error('Error en verificarTemaCompleto:', error);
    return { completo: false, totalSubtemas: 0, subtemasCompletados: 0, error: error.message };
  }
};

/**
 * Obtiene el estado de todos los contenidos de un tema para un estudiante
 * @param {number} estudianteId - ID del estudiante
 * @param {number} temaId - ID del tema
 * @returns {Promise<Array>} Lista de contenidos con su estado de desbloqueo
 */
exports.obtenerEstadoContenidosTema = async (estudianteId, temaId) => {
  try {
    // Obtener todos los contenidos del tema con sus relaciones
    const contenidos = await Contenido.findAll({
      where: { tema_id: temaId },
      include: [
        { model: Subtema, attributes: ['id', 'nombre'] }
      ],
      order: [['subtema_id', 'ASC'], ['id', 'ASC']]
    });

    // Para cada contenido, verificar si está desbloqueado y si está completado
    const resultado = await Promise.all(contenidos.map(async (contenido) => {
      const desbloqueo = await this.verificarContenidoDesbloqueado(estudianteId, contenido.id);
      
      const progreso = await Progreso.findOne({
        where: {
          estudiante_id: estudianteId,
          contenido_id: contenido.id,
          completado: true,
          estado: 'Visualizado'
        }
      });

      return {
        id: contenido.id,
        titulo: contenido.titulo,
        tipo: contenido.tipo,
        subtema_id: contenido.subtema_id,
        subtema_nombre: contenido.Subtema?.nombre,
        desbloqueado: desbloqueo.desbloqueado,
        completado: !!progreso,
        razon: desbloqueo.razon
      };
    }));

    return resultado;

  } catch (error) {
    console.error('Error en obtenerEstadoContenidosTema:', error);
    throw error;
  }
};

/**
 * Obtiene el estado de todos los subtemas de un tema para un estudiante
 * @param {number} estudianteId - ID del estudiante
 * @param {number} temaId - ID del tema
 * @returns {Promise<Array>} Lista de subtemas con su estado
 */
exports.obtenerEstadoSubtemasTema = async (estudianteId, temaId) => {
  try {
    // Obtener todos los subtemas del tema
    const subtemas = await Subtema.findAll({
      where: { tema_id: temaId },
      order: [['id', 'ASC']]
    });

    // Para cada subtema, verificar su estado
    const resultado = await Promise.all(subtemas.map(async (subtema, index) => {
      const estadoSubtema = await this.verificarSubtemaCompleto(estudianteId, subtema.id);
      
      // El primer subtema siempre está desbloqueado
      let desbloqueado = index === 0;
      
      // Si no es el primero, verificar si el anterior está completo
      if (index > 0) {
        const subtemaAnterior = subtemas[index - 1];
        const estadoAnterior = await this.verificarSubtemaCompleto(estudianteId, subtemaAnterior.id);
        desbloqueado = estadoAnterior.completo;
      }

      return {
        id: subtema.id,
        nombre: subtema.nombre,
        descripcion: subtema.descripcion,
        desbloqueado,
        completo: estadoSubtema.completo,
        totalContenidos: estadoSubtema.totalContenidos,
        contenidosCompletados: estadoSubtema.contenidosCompletados,
        porcentaje: estadoSubtema.porcentaje
      };
    }));

    return resultado;

  } catch (error) {
    console.error('Error en obtenerEstadoSubtemasTema:', error);
    throw error;
  }
};

/**
 * Obtiene el estado de todos los temas de un área para un estudiante
 * @param {number} estudianteId - ID del estudiante
 * @param {number} areaId - ID del área
 * @returns {Promise<Array>} Lista de temas con su estado
 */
exports.obtenerEstadoTemasArea = async (estudianteId, areaId) => {
  try {
    // Obtener todos los temas del área ordenados
    const temas = await Tema.findAll({
      where: { area_id: areaId, estado: true },
      order: [['orden', 'ASC'], ['id', 'ASC']]
    });

    // Para cada tema, verificar su estado
    const resultado = await Promise.all(temas.map(async (tema, index) => {
      const estadoTema = await this.verificarTemaCompleto(estudianteId, tema.id);
      
      // El primer tema siempre está desbloqueado
      let desbloqueado = index === 0;
      
      // Si no es el primero, verificar si el anterior está completo
      if (index > 0) {
        const temaAnterior = temas[index - 1];
        const estadoAnterior = await this.verificarTemaCompleto(estudianteId, temaAnterior.id);
        desbloqueado = estadoAnterior.completo;
      }

      return {
        id: tema.id,
        nombre: tema.nombre,
        descripcion: tema.descripcion,
        orden: tema.orden,
        desbloqueado,
        completo: estadoTema.completo,
        totalSubtemas: estadoTema.totalSubtemas,
        subtemasCompletados: estadoTema.subtemasCompletados,
        porcentaje: estadoTema.porcentaje
      };
    }));

    return resultado;

  } catch (error) {
    console.error('Error en obtenerEstadoTemasArea:', error);
    throw error;
  }
};

/**
 * Obtiene el siguiente contenido disponible para el estudiante en un tema
 * @param {number} estudianteId - ID del estudiante
 * @param {number} temaId - ID del tema
 * @returns {Promise<Object|null>} Siguiente contenido disponible o null
 */
exports.obtenerSiguienteContenido = async (estudianteId, temaId) => {
  try {
    const estadoContenidos = await this.obtenerEstadoContenidosTema(estudianteId, temaId);
    
    // Buscar el primer contenido desbloqueado y no completado
    const siguiente = estadoContenidos.find(c => c.desbloqueado && !c.completado);
    
    if (!siguiente) {
      // Si no hay siguiente, buscar el primer contenido desbloqueado (aunque esté completado)
      const primerDesbloqueado = estadoContenidos.find(c => c.desbloqueado);
      return primerDesbloqueado || null;
    }
    
    return siguiente;

  } catch (error) {
    console.error('Error en obtenerSiguienteContenido:', error);
    throw error;
  }
};
