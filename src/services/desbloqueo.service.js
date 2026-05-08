const { Contenido, Subtema, Tema, Progreso, Asignatura, SecuenciaContenido } = require('../models');
const { Op } = require('sequelize');

/**
 * Progresión por asignatura (`Asignatura.progresion_secuencial`):
 * - false: estudiantes navegan libremente (API devuelve todo desbloqueado).
 * - true: reglas anteriores — secuencia de contenidos, subtemas y temas en orden.
 */

async function obtenerProgresionSecuencialPorAsignaturaId(asignaturaId) {
  if (!asignaturaId) return false;
  const a = await Asignatura.findOne({
    where: { id: asignaturaId },
    attributes: ['progresion_secuencial'],
  });
  return Boolean(a?.progresion_secuencial);
}

async function obtenerProgresionSecuencialPorTemaId(temaId) {
  const tema = await Tema.findOne({
    where: { id: temaId, estado: true },
    attributes: ['asignatura_id'],
  });
  if (!tema) return false;
  return obtenerProgresionSecuencialPorAsignaturaId(tema.asignatura_id);
}

/**
 * Verifica si un contenido está disponible para un estudiante
 * @param {number} estudianteId
 * @param {number} contenidoId
 */
exports.verificarContenidoDesbloqueado = async (estudianteId, contenidoId) => {
  try {
    const contenido = await Contenido.findOne({ where: { id: contenidoId, estado: true } });
    if (!contenido) {
      return { desbloqueado: false, razon: 'Contenido no encontrado' };
    }

    const secuencial = await obtenerProgresionSecuencialPorTemaId(contenido.tema_id);
    if (!secuencial) {
      return { desbloqueado: true, razon: 'Acceso libre' };
    }

    const secuenciaEntrante = await SecuenciaContenido.findOne({
      where: {
        contenido_destino_id: contenidoId,
        estado: true,
      },
    });

    if (!secuenciaEntrante) {
      return { desbloqueado: true, razon: 'Es el primer contenido de la secuencia' };
    }

    const predecesorId = secuenciaEntrante.contenido_origen_id;
    const progresoPredecesor = await Progreso.findOne({
      where: {
        estudiante_id: estudianteId,
        contenido_id: predecesorId,
        completado: true,
        estado: 'Visualizado',
      },
    });

    if (progresoPredecesor) {
      return { desbloqueado: true, razon: 'Contenido predecesor completado' };
    }
    return { desbloqueado: false, razon: 'Contenido predecesor no completado' };
  } catch (error) {
    console.error('Error en verificarContenidoDesbloqueado:', error);
    return { desbloqueado: false, razon: 'Error al verificar', error: error.message };
  }
};

/**
 * Verifica si un subtema está completo para un estudiante
 */
exports.verificarSubtemaCompleto = async (estudianteId, subtemaId) => {
  try {
    const contenidos = await Contenido.findAll({
      where: { subtema_id: subtemaId, estado: true },
      attributes: ['id'],
    });

    const totalContenidos = contenidos.length;

    if (totalContenidos === 0) {
      return { completo: true, totalContenidos: 0, contenidosCompletados: 0, razon: 'Sin contenidos' };
    }

    const contenidoIds = contenidos.map((c) => c.id);

    const contenidosCompletados = await Progreso.count({
      where: {
        estudiante_id: estudianteId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado',
      },
    });

    const completo = contenidosCompletados === totalContenidos;

    return {
      completo,
      totalContenidos,
      contenidosCompletados,
      porcentaje: Math.round((contenidosCompletados / totalContenidos) * 100),
    };
  } catch (error) {
    console.error('Error en verificarSubtemaCompleto:', error);
    return { completo: false, totalContenidos: 0, contenidosCompletados: 0, error: error.message };
  }
};

/**
 * Verifica si un tema está completo para un estudiante
 */
exports.verificarTemaCompleto = async (estudianteId, temaId) => {
  try {
    const subtemas = await Subtema.findAll({
      where: { tema_id: temaId, estado: true },
      attributes: ['id'],
    });

    const totalSubtemas = subtemas.length;

    if (totalSubtemas === 0) {
      return { completo: true, totalSubtemas: 0, subtemasCompletados: 0, razon: 'Sin subtemas' };
    }

    let subtemasCompletados = 0;
    for (const subtema of subtemas) {
      const resultado = await exports.verificarSubtemaCompleto(estudianteId, subtema.id);
      if (resultado.completo) {
        subtemasCompletados++;
      }
    }

    const completo = subtemasCompletados === totalSubtemas;

    return {
      completo,
      totalSubtemas,
      subtemasCompletados,
      porcentaje: Math.round((subtemasCompletados / totalSubtemas) * 100),
    };
  } catch (error) {
    console.error('Error en verificarTemaCompleto:', error);
    return { completo: false, totalSubtemas: 0, subtemasCompletados: 0, error: error.message };
  }
};

exports.obtenerEstadoContenidosTema = async (estudianteId, temaId) => {
  try {
    const contenidos = await Contenido.findAll({
      where: { tema_id: temaId, estado: true },
      include: [{ model: Subtema, attributes: ['id', 'nombre'] }],
      order: [['subtema_id', 'ASC'], ['id', 'ASC']],
    });

    const resultado = await Promise.all(
      contenidos.map(async (contenido) => {
        const desbloqueo = await exports.verificarContenidoDesbloqueado(estudianteId, contenido.id);

        const progreso = await Progreso.findOne({
          where: {
            estudiante_id: estudianteId,
            contenido_id: contenido.id,
            completado: true,
            estado: 'Visualizado',
          },
        });

        return {
          id: contenido.id,
          titulo: contenido.titulo,
          tipo: contenido.tipo,
          subtema_id: contenido.subtema_id,
          subtema_nombre: contenido.Subtema?.nombre,
          desbloqueado: desbloqueo.desbloqueado,
          completado: !!progreso,
          razon: desbloqueo.razon,
        };
      })
    );

    return resultado;
  } catch (error) {
    console.error('Error en obtenerEstadoContenidosTema:', error);
    throw error;
  }
};

exports.obtenerEstadoSubtemasTema = async (estudianteId, temaId) => {
  try {
    const secuencial = await obtenerProgresionSecuencialPorTemaId(temaId);

    const subtemas = await Subtema.findAll({
      where: { tema_id: temaId, estado: true },
      order: [['id', 'ASC']],
    });

    const resultado = await Promise.all(
      subtemas.map(async (subtema, index) => {
        const estadoSubtema = await exports.verificarSubtemaCompleto(estudianteId, subtema.id);

        let desbloqueado = true;
        if (secuencial) {
          desbloqueado = index === 0;
          if (index > 0) {
            const subtemaAnterior = subtemas[index - 1];
            const estadoAnterior = await exports.verificarSubtemaCompleto(estudianteId, subtemaAnterior.id);
            desbloqueado = estadoAnterior.completo;
          }
        }

        return {
          id: subtema.id,
          nombre: subtema.nombre,
          descripcion: subtema.descripcion,
          desbloqueado,
          completo: estadoSubtema.completo,
          totalContenidos: estadoSubtema.totalContenidos,
          contenidosCompletados: estadoSubtema.contenidosCompletados,
          porcentaje: estadoSubtema.porcentaje,
        };
      })
    );

    return resultado;
  } catch (error) {
    console.error('Error en obtenerEstadoSubtemasTema:', error);
    throw error;
  }
};

exports.obtenerEstadoTemasAsignatura = async (estudianteId, asignaturaId) => {
  try {
    const secuencial = await obtenerProgresionSecuencialPorAsignaturaId(asignaturaId);

    const temas = await Tema.findAll({
      where: { asignatura_id: asignaturaId, estado: true },
      order: [['orden', 'ASC'], ['id', 'ASC']],
    });

    const resultado = await Promise.all(
      temas.map(async (tema, index) => {
        const estadoTema = await exports.verificarTemaCompleto(estudianteId, tema.id);

        let desbloqueado = true;
        if (secuencial) {
          desbloqueado = index === 0;
          if (index > 0) {
            const temaAnterior = temas[index - 1];
            const estadoAnterior = await exports.verificarTemaCompleto(estudianteId, temaAnterior.id);
            desbloqueado = estadoAnterior.completo;
          }
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
          porcentaje: estadoTema.porcentaje,
        };
      })
    );

    return resultado;
  } catch (error) {
    console.error('Error en obtenerEstadoTemasAsignatura:', error);
    throw error;
  }
};

exports.obtenerSiguienteContenido = async (estudianteId, temaId) => {
  try {
    const estadoContenidos = await exports.obtenerEstadoContenidosTema(estudianteId, temaId);

    const siguiente = estadoContenidos.find((c) => c.desbloqueado && !c.completado);

    if (!siguiente) {
      const primerDesbloqueado = estadoContenidos.find((c) => c.desbloqueado);
      return primerDesbloqueado || null;
    }

    return siguiente;
  } catch (error) {
    console.error('Error en obtenerSiguienteContenido:', error);
    throw error;
  }
};
