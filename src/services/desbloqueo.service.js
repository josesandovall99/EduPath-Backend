const { Contenido, Subtema, Tema, Progreso, Asignatura, SecuenciaContenido } = require('../models');

const { obtenerSubtemasOrdenadosPorSecuenciaParaTema } = require('../utils/subtemaOrdenSecuencia');

const { progresoCuentaContenidoVisualizado } = require('../utils/progresoContenidoVisto');

const { Op } = require('sequelize');

/** IDs de contenido marcados como vistos por el estudiante según tabla progreso (criterio relajado). */
async function idsContenidosVistosDesdeProgreso(estudianteId, contenidoIds) {
  if (!contenidoIds.length) return new Set();
  const rows = await Progreso.findAll({
    where: { estudiante_id: estudianteId, contenido_id: { [Op.in]: contenidoIds } },
    attributes: ['contenido_id', 'completado', 'estado'],
  });
  const out = new Set();
  rows.forEach((r) => {
    if (progresoCuentaContenidoVisualizado(r)) out.add(Number(r.contenido_id));
  });
  return out;
}



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
      },
      attributes: ['completado', 'estado'],
    });



    if (progresoCuentaContenidoVisualizado(progresoPredecesor)) {

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



    const vistos = await idsContenidosVistosDesdeProgreso(estudianteId, contenidoIds);

    const contenidosCompletados = contenidoIds.filter((cid) => vistos.has(Number(cid))).length;



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
    const [secuencial, contenidos] = await Promise.all([
      obtenerProgresionSecuencialPorTemaId(temaId),
      Contenido.findAll({
        where: { tema_id: temaId, estado: true },
        include: [{ model: Subtema, attributes: ['id', 'nombre'] }],
        order: [['subtema_id', 'ASC'], ['id', 'ASC']],
      }),
    ]);

    if (contenidos.length === 0) return [];

    const contenidoIds = contenidos.map(c => c.id);

    const [progresosRaw, secuencias] = await Promise.all([
      Progreso.findAll({
        where: { estudiante_id: estudianteId, contenido_id: { [Op.in]: contenidoIds } },
        attributes: ['contenido_id', 'completado', 'estado'],
      }),
      secuencial
        ? SecuenciaContenido.findAll({
            where: { contenido_destino_id: { [Op.in]: contenidoIds }, estado: true },
            attributes: ['contenido_origen_id', 'contenido_destino_id'],
          })
        : Promise.resolve([]),
    ]);

    const completadosSet = new Set(
      progresosRaw.filter((p) => progresoCuentaContenidoVisualizado(p)).map((p) => Number(p.contenido_id))
    );
    const predecesores = new Map(secuencias.map(s => [Number(s.contenido_destino_id), Number(s.contenido_origen_id)]));

    return contenidos.map(contenido => {
      const completado = completadosSet.has(Number(contenido.id));
      let desbloqueado = true;
      if (secuencial) {
        const predecesorId = predecesores.get(Number(contenido.id));
        if (predecesorId) desbloqueado = completadosSet.has(Number(predecesorId));
      }
      return {
        id: contenido.id,
        titulo: contenido.titulo,
        tipo: contenido.tipo,
        subtema_id: contenido.subtema_id,
        subtema_nombre: contenido.Subtema?.nombre,
        desbloqueado,
        completado,
        razon: desbloqueado ? 'Acceso libre' : 'Contenido predecesor no completado',
      };
    });
  } catch (error) {
    console.error('Error en obtenerEstadoContenidosTema:', error);
    throw error;
  }
};

// Reescrito: 1+N*2+(N-1)*2 queries => 3 queries batch
exports.obtenerEstadoSubtemasTema = async (estudianteId, temaId) => {
  try {
    const secuencial = await obtenerProgresionSecuencialPorTemaId(temaId);

    /** Misma orden que /secuencias-subtema/tema/:id/ordenados cuando hay progresión secuencial */
    const subtemas = secuencial
      ? await obtenerSubtemasOrdenadosPorSecuenciaParaTema(temaId)
      : await Subtema.findAll({
          where: { tema_id: temaId, estado: true },
          order: [['id', 'ASC']],
        });

    if (subtemas.length === 0) return [];

    const subtemaIds = subtemas.map(s => s.id);

    const contenidos = await Contenido.findAll({
      where: { subtema_id: { [Op.in]: subtemaIds }, estado: true },
      attributes: ['id', 'subtema_id'],
    });

    const contenidoIds = contenidos.map(c => c.id);

    const completadosSet = contenidoIds.length > 0
      ? await idsContenidosVistosDesdeProgreso(estudianteId, contenidoIds)
      : new Set();

    const contenidosPorSubtema = new Map();
    contenidos.forEach(c => {
      if (!contenidosPorSubtema.has(c.subtema_id)) contenidosPorSubtema.set(c.subtema_id, []);
      contenidosPorSubtema.get(c.subtema_id).push(c.id);
    });

    const calcularEstadoSubtema = (subtemaId) => {
      const ids = contenidosPorSubtema.get(subtemaId) || [];
      const total = ids.length;
      const completados = ids.filter(id => completadosSet.has(Number(id))).length;
      return { total, completados, completo: total === 0 || completados === total };
    };

    return subtemas.map((subtema, index) => {
      const { total, completados, completo } = calcularEstadoSubtema(subtema.id);
      let desbloqueado = true;
      if (secuencial) {
        desbloqueado = index === 0 ? true : calcularEstadoSubtema(subtemas[index - 1].id).completo;
      }
      return {
        id: subtema.id,
        nombre: subtema.nombre,
        descripcion: subtema.descripcion,
        desbloqueado,
        completo,
        totalContenidos: total,
        contenidosCompletados: completados,
        porcentaje: total > 0 ? Math.round((completados / total) * 100) : 100,
      };
    });
  } catch (error) {
    console.error('Error en obtenerEstadoSubtemasTema:', error);
    throw error;
  }
};

// Reescrito: 1+N*(1+M*2) queries => 5 queries batch
exports.obtenerEstadoTemasAsignatura = async (estudianteId, asignaturaId) => {
  try {
    const [secuencial, temas] = await Promise.all([
      obtenerProgresionSecuencialPorAsignaturaId(asignaturaId),
      Tema.findAll({ where: { asignatura_id: asignaturaId, estado: true }, order: [['orden', 'ASC'], ['id', 'ASC']] }),
    ]);

    if (temas.length === 0) return [];

    const temaIds = temas.map(t => t.id);

    const subtemas = await Subtema.findAll({
      where: { tema_id: { [Op.in]: temaIds }, estado: true },
      attributes: ['id', 'tema_id'],
    });

    const subtemaIds = subtemas.map(s => s.id);

    const contenidos = subtemaIds.length > 0
      ? await Contenido.findAll({
          where: { subtema_id: { [Op.in]: subtemaIds }, estado: true },
          attributes: ['id', 'subtema_id'],
        })
      : [];

    const contenidoIds = contenidos.map(c => c.id);

    const completadosSet = contenidoIds.length > 0
      ? await idsContenidosVistosDesdeProgreso(estudianteId, contenidoIds)
      : new Set();

    const subtemasPorTema = new Map();
    subtemas.forEach(s => {
      if (!subtemasPorTema.has(s.tema_id)) subtemasPorTema.set(s.tema_id, []);
      subtemasPorTema.get(s.tema_id).push(s.id);
    });

    const contenidosPorSubtema = new Map();
    contenidos.forEach(c => {
      if (!contenidosPorSubtema.has(c.subtema_id)) contenidosPorSubtema.set(c.subtema_id, []);
      contenidosPorSubtema.get(c.subtema_id).push(c.id);
    });

    const estaSubtemaCompleto = (subtemaId) => {
      const ids = contenidosPorSubtema.get(subtemaId) || [];
      return ids.length === 0 || ids.every(id => completadosSet.has(Number(id)));
    };

    const estaTemaCompleto = (temaId) => {
      const subs = subtemasPorTema.get(temaId) || [];
      return subs.length === 0 || subs.every(estaSubtemaCompleto);
    };

    return temas.map((tema, index) => {
      const subs = subtemasPorTema.get(tema.id) || [];
      const totalSubtemas = subs.length;
      const subtemasCompletados = subs.filter(estaSubtemaCompleto).length;
      const completo = estaTemaCompleto(tema.id);
      let desbloqueado = true;
      if (secuencial) {
        desbloqueado = index === 0 ? true : estaTemaCompleto(temas[index - 1].id);
      }
      const contenidosDelTema = subs.flatMap(sid => contenidosPorSubtema.get(sid) || []);
      const totalContenidos = contenidosDelTema.length;
      const completadosDelTema = contenidosDelTema.filter(id => completadosSet.has(Number(id))).length;
      const porcentaje = totalContenidos > 0 ? Math.round((completadosDelTema / totalContenidos) * 100) : 0;
      return {
        id: tema.id,
        nombre: tema.nombre,
        descripcion: tema.descripcion,
        orden: tema.orden,
        desbloqueado,
        completo,
        totalSubtemas,
        subtemasCompletados,
        porcentaje,
      };
    });
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

