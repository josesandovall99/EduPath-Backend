const { Op } = require('sequelize');
const { Contenido, Tema, Subtema, Asignatura: AsignaturaModel, Estudiante, SecuenciaContenido, Progreso } = require('../models');
const { progresoCuentaContenidoVisualizado } = require('../utils/progresoContenidoVisto');

const canViewInactiveContenidos = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);
const CONTENIDO_TYPE_MAP = {
  video: 'video',
  document: 'document',
  documento: 'document',
  pdf: 'document',
  activity: 'activity',
  actividad: 'activity',
  explicacion: 'explicacion',
  'explicación': 'explicacion',
  simulacion_ruta_critica: 'simulacion_ruta_critica',
  simulador_curva_s: 'simulador_curva_s',
  'simulador-curva-s': 'simulador_curva_s',
  simulador_evm_curva_s: 'simulador_curva_s',
};

const parsePositiveInteger = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Number.NaN;
  }

  return parsed;
};

const stripRichText = (value) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

async function validateContenidoPayload(req, rawPayload) {
  const titulo = String(rawPayload.titulo || '').trim();
  const tipo = CONTENIDO_TYPE_MAP[String(rawPayload.tipo || '').trim().toLowerCase()];
  const descripcion = String(rawPayload.descripcion || '').trim();
  const descripcionTexto = stripRichText(descripcion);
  let url = String(rawPayload.url || '').trim();
  const temaId = parsePositiveInteger(rawPayload.tema_id);
  const subtemaId = parsePositiveInteger(rawPayload.subtema_id);
  const isSimuladorCurvaS = tipo === 'simulador_curva_s';
  const isCPMSimulation = tipo === 'simulacion_ruta_critica';
  // Para simulaciones CPM: descripción es opcional y la URL es un JSON (no una URL HTTP)
  const needsDescription = !isCPMSimulation;
  const needsHttpUrl = !isCPMSimulation;

  if (!titulo || !tipo || (needsDescription && !descripcionTexto) || !temaId || !subtemaId || Number.isNaN(temaId) || Number.isNaN(subtemaId)) {
    return {
      error: {
        status: 400,
        message: 'Completa todos los campos obligatorios del contenido antes de guardar.'
      }
    };
  }

  if (isSimuladorCurvaS && !url) {
    url = 'https://edupath.app/contenido/simulador-curva-s-evm';
  }

  if (!url) {
    return {
      error: {
        status: 400,
        message: 'Completa todos los campos obligatorios del contenido antes de guardar.'
      }
    };
  }

  if (needsHttpUrl) {
    try {
      new URL(url);
    } catch (error) {
      return {
        error: {
          status: 400,
          message: 'La URL del contenido debe ser válida.'
        }
      };
    }
  }

  const temaExistente = await Tema.findByPk(temaId);
  if (!temaExistente) {
    return {
      error: {
        status: 400,
        message: 'El tema especificado no existe'
      }
    };
  }

  if (temaExistente.estado === false) {
    return {
      error: {
        status: 400,
        message: 'El tema especificado está inactivo'
      }
    };
  }

  if (req.docenteAsignaturaId && parseInt(temaExistente.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
    return {
      error: {
        status: 403,
        message: 'Acceso denegado: asignatura fuera de tu alcance'
      }
    };
  }

  const subtemaExistente = await Subtema.findByPk(subtemaId);
  if (!subtemaExistente) {
    return {
      error: {
        status: 400,
        message: 'El subtema especificado no existe'
      }
    };
  }

  if (subtemaExistente.estado === false) {
    return {
      error: {
        status: 400,
        message: 'El subtema especificado está inactivo'
      }
    };
  }

  if (parseInt(subtemaExistente.tema_id, 10) !== parseInt(temaExistente.id, 10)) {
    return {
      error: {
        status: 400,
        message: 'El subtema seleccionado no pertenece al tema indicado.'
      }
    };
  }

  return {
    payload: {
      titulo,
      tipo,
      descripcion,
      url,
      tema_id: temaId,
      subtema_id: subtemaId
    }
  };
}

async function resolveContenidoScope(req) {
  let asignaturaId = parsePositiveInteger(req.query.asignaturaId);
  let temaId = parsePositiveInteger(req.query.temaId);
  let subtemaId = parsePositiveInteger(req.query.subtemaId);

  if ([asignaturaId, temaId, subtemaId].some((value) => Number.isNaN(value))) {
    return {
      error: {
        status: 400,
        message: 'Los filtros de asignatura, tema y subtema deben ser identificadores válidos.'
      }
    };
  }

  const docenteAsignaturaId = req.docenteAsignaturaId ? parseInt(req.docenteAsignaturaId, 10) : null;
  let tema = null;

  if (docenteAsignaturaId) {
    if (asignaturaId && asignaturaId !== docenteAsignaturaId) {
      return {
        error: {
          status: 403,
          message: 'Acceso denegado: asignatura fuera de tu alcance'
        }
      };
    }

    asignaturaId = docenteAsignaturaId;
  }

  if (temaId) {
    tema = await Tema.findByPk(temaId);
    if (!tema) {
      return {
        error: {
          status: 404,
          message: 'Tema no encontrado'
        }
      };
    }

    if (tema.estado === false && !canViewInactiveContenidos(req)) {
      return {
        error: {
          status: 404,
          message: 'Tema no encontrado'
        }
      };
    }

    const temaasignaturaId = parseInt(tema.asignatura_id, 10);
    if (docenteAsignaturaId && temaasignaturaId !== docenteAsignaturaId) {
      return {
        error: {
          status: 403,
          message: 'Acceso denegado: asignatura fuera de tu alcance'
        }
      };
    }

    if (asignaturaId && temaasignaturaId !== asignaturaId) {
      return {
        error: {
          status: 400,
          message: 'El tema no pertenece al asignatura seleccionada'
        }
      };
    }

    asignaturaId = temaasignaturaId;
  }

  if (subtemaId) {
    const subtema = await Subtema.findByPk(subtemaId);
    if (!subtema) {
      return {
        error: {
          status: 404,
          message: 'Subtema no encontrado'
        }
      };
    }

    if (subtema.estado === false && !canViewInactiveContenidos(req)) {
      return {
        error: {
          status: 404,
          message: 'Subtema no encontrado'
        }
      };
    }

    const subtemaTemaId = parseInt(subtema.tema_id, 10);
    if (temaId && subtemaTemaId !== temaId) {
      return {
        error: {
          status: 400,
          message: 'El subtema no pertenece al tema seleccionado'
        }
      };
    }

    if (!tema || parseInt(tema.id, 10) !== subtemaTemaId) {
      tema = await Tema.findByPk(subtemaTemaId);
      if (!tema) {
        return {
          error: {
            status: 404,
            message: 'Tema no encontrado para el subtema indicado'
          }
        };
      }
    }

    const temaasignaturaId = parseInt(tema.asignatura_id, 10);
    if (docenteAsignaturaId && temaasignaturaId !== docenteAsignaturaId) {
      return {
        error: {
          status: 403,
          message: 'Acceso denegado: asignatura fuera de tu alcance'
        }
      };
    }

    if (asignaturaId && temaasignaturaId !== asignaturaId) {
      return {
        error: {
          status: 400,
          message: 'El subtema no pertenece al asignatura seleccionada'
        }
      };
    }

    temaId = subtemaTemaId;
    asignaturaId = temaasignaturaId;
  }

  return { asignaturaId, temaId, subtemaId };
}

// Al inactivar un contenido B en cadena A→B→C, crea A→C y elimina las secuencias que lo involucran.
async function handleSecuenciaRedirecccion(contenidoId) {
  const resultado = {
    secuenciasEliminadas: [],
    secuenciasCreadas: [],
    errores: []
  };

  try {
    // 1. Encontrar todas las secuencias donde el contenido es ORIGEN (B en A → B)
    const secuenciasComOrigen = await SecuenciaContenido.findAll({
      where: { contenido_origen_id: contenidoId }
    });

    // 2. Encontrar todas las secuencias donde el contenido es DESTINO (B en B → C)
    const secuenciasComoDestino = await SecuenciaContenido.findAll({
      where: { contenido_destino_id: contenidoId }
    });

    // 3. Si está en medio de una secuencia, crear la redirección (A → C)
    if (secuenciasComoDestino.length > 0 && secuenciasComOrigen.length > 0) {
      for (const secuenciaOrigen of secuenciasComOrigen) {
        for (const secuenciaDestino of secuenciasComoDestino) {
          const contenido_origen_id = secuenciaDestino.contenido_origen_id;
          const contenido_destino_id = secuenciaOrigen.contenido_destino_id;

          // Validar que no sea un ciclo (A → A)
          if (contenido_origen_id === contenido_destino_id) {
            resultado.errores.push(
              `No se puede crear redirección porque sería un ciclo: ${contenido_origen_id} → ${contenido_destino_id}`
            );
            continue;
          }

          const relacionExistente = await SecuenciaContenido.findOne({
            where: {
              contenido_origen_id,
              contenido_destino_id
            }
          });

          if (relacionExistente) {
            resultado.errores.push(
              `La secuencia ${contenido_origen_id} → ${contenido_destino_id} ya existe`
            );
            continue;
          }

          const nuevaSecuencia = await SecuenciaContenido.create({
            contenido_origen_id,
            contenido_destino_id,
            descripcion: `Redirección automática (origen: ${secuenciaDestino.contenido_origen_id} → ${contenidoId} → ${secuenciaOrigen.contenido_destino_id})`,
            estado: true
          });

          resultado.secuenciasCreadas.push({
            id: nuevaSecuencia.id,
            de: contenido_origen_id,
            a: contenido_destino_id
          });
        }
      }
    }

    // 4. Eliminar todas las secuencias que involucran este contenido
    // Eliminar donde el contenido es ORIGEN (B → C)
    for (const secuencia of secuenciasComOrigen) {
      await secuencia.destroy();
      resultado.secuenciasEliminadas.push({
        id: secuencia.id,
        de: secuencia.contenido_origen_id,
        a: secuencia.contenido_destino_id,
        razon: 'Contenido origen eliminado/inactivado'
      });
    }

    // Eliminar donde el contenido es DESTINO (A → B)
    for (const secuencia of secuenciasComoDestino) {
      await secuencia.destroy();
      resultado.secuenciasEliminadas.push({
        id: secuencia.id,
        de: secuencia.contenido_origen_id,
        a: secuencia.contenido_destino_id,
        razon: 'Contenido destino eliminado/inactivado'
      });
    }

    return resultado;
  } catch (error) {
    resultado.errores.push(error.message);
    return resultado;
  }
}

exports.createContenido = async (req, res) => {
  try {
    const validation = await validateContenidoPayload(req, req.body);
    if (validation.error) {
      return res.status(validation.error.status).json({ message: validation.error.message });
    }

    const nuevoContenido = await Contenido.create(validation.payload);

    res.status(201).json(nuevoContenido);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el contenido", error });
  }
};

// Listar todos los contenidos
exports.getContenidos = async (req, res) => {
  try {
    const scope = await resolveContenidoScope(req);
    if (scope.error) {
      return res.status(scope.error.status).json({ message: scope.error.message });
    }

    const where = canViewInactiveContenidos(req) ? {} : { estado: true };

    if (scope.subtemaId) {
      where.subtema_id = scope.subtemaId;
    } else if (scope.temaId) {
      where.tema_id = scope.temaId;
    } else if (scope.asignaturaId) {
      const temas = await Tema.findAll({
        where: {
          asignatura_id: scope.asignaturaId,
          ...(canViewInactiveContenidos(req) ? {} : { estado: true })
        },
        attributes: ['id']
      });

      const temaIds = temas.map((tema) => tema.id);
      if (temaIds.length === 0) {
        return res.json([]);
      }

      where.tema_id = { [Op.in]: temaIds };
    }

    const contenidos = await Contenido.findAll({ where });

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los contenidos", error });
  }
};

// Obtener un contenido por ID
exports.getContenidoById = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });

    if (contenido.estado === false && !canViewInactiveContenidos(req)) {
      return res.status(404).json({ message: 'Contenido no encontrado' });
    }

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(contenido.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    res.json(contenido);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el contenido", error });
  }
};

// Actualizar un contenido con validación de tema_id y subtema_id
exports.updateContenido = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(contenido.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    const mergedPayload = {
      titulo: req.body.titulo ?? contenido.titulo,
      tipo: req.body.tipo ?? contenido.tipo,
      descripcion: req.body.descripcion ?? contenido.descripcion,
      url: req.body.url ?? contenido.url,
      tema_id: req.body.tema_id ?? contenido.tema_id,
      subtema_id: req.body.subtema_id ?? contenido.subtema_id
    };

    const validation = await validateContenidoPayload(req, mergedPayload);
    if (validation.error) {
      return res.status(validation.error.status).json({ message: validation.error.message });
    }

    await contenido.update(validation.payload);
    res.json(contenido);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el contenido", error });
  }
};

// Eliminar un contenido con redirección automática de secuencias
exports.deleteContenido = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(contenido.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    if (contenido.estado === false) {
      return res.json({
        message: 'Contenido ya estaba inhabilitado',
        redirecccion: null,
      });
    }

    const resultadoRedirecccion = await handleSecuenciaRedirecccion(req.params.id);
    await contenido.update({ estado: false });

    res.json({
      message: "Contenido inhabilitado correctamente",
      redirecccion: resultadoRedirecccion
    });
  } catch (error) {
    res.status(500).json({ message: "Error al inhabilitar el contenido", error });
  }
};

// Obtener contenidos por subtema_id
exports.getContenidosPorSubtema = async (req, res) => {
  try {
    const { subtemaId } = req.params;

    const subtema = await Subtema.findByPk(subtemaId);
    if (!subtema) {
      return res.status(404).json({ message: "Subtema no encontrado" });
    }

    if (subtema.estado === false && !canViewInactiveContenidos(req)) {
      return res.status(404).json({ message: 'Subtema no encontrado' });
    }

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(subtema.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    const contenidos = await Contenido.findAll({
      where: {
        subtema_id: subtemaId,
        ...(canViewInactiveContenidos(req) ? {} : { estado: true })
      }
    });

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los contenidos por subtema", error });
  }
};

// Toggle del estado de un contenido con redirección automática de secuencias
exports.toggleEstadoContenido = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) {
      return res.status(404).json({ message: "Contenido no encontrado" });
    }

    // Si el contenido va a ser inactivado, manejar la redirección
    const estadoActual = contenido.estado;
    if (estadoActual === true) {
      const resultadoRedirecccion = await handleSecuenciaRedirecccion(req.params.id);
      
      // Inactivar el contenido
      await contenido.update({ estado: false });

      return res.json({
        message: "Contenido inactivado correctamente",
        contenido,
        redirecccion: resultadoRedirecccion
      });
    } else {
      await contenido.update({ estado: true });

      return res.json({
        message: "Contenido reactivado correctamente",
        contenido
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error al cambiar el estado del contenido", error });
  }
};

// Obtener contenidos por categoría (tipo)
exports.getContenidosPorCategoria = async (req, res) => {
  try {
    const { categoria } = req.params;

    const where = { tipo: categoria };

    if (req.docenteAsignaturaId) {
      const temas = await Tema.findAll({
        where: { asignatura_id: req.docenteAsignaturaId },
        attributes: ['id']
      });
      const temaIds = temas.map((tema) => tema.id);

      if (temaIds.length === 0) {
        return res.status(404).json({ message: "No se encontraron contenidos para esta categoría" });
      }

      where.tema_id = temaIds;
    }

    if (!canViewInactiveContenidos(req)) {
      where.estado = true;
    }

    const contenidos = await Contenido.findAll({ where });

    if (contenidos.length === 0) {
      return res.status(404).json({ message: "No se encontraron contenidos para esta categoría" });
    }

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los contenidos por categoría", error });
  }
};

// Obtener contenidos por nombre del asignatura (ej. "ATC", "Fundamentos de programación")
exports.getContenidosPorasignaturaNombre = async (req, res) => {
  try {
    const { nombreAsignatura } = req.params;

    const asignatura = await AsignaturaModel.findOne({
      where: {
        nombre: nombreAsignatura,
        ...(canViewInactiveContenidos(req) ? {} : { estado: true })
      }
    });
    if (!asignatura) {
      return res.status(404).json({ message: "Asignatura no encontrada" });
    }

    if (req.docenteAsignaturaId && parseInt(asignatura.id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
      return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
    }

    const temas = await Tema.findAll({ where: { asignatura_id: asignatura.id, estado: true } });
    const temaIds = temas.map(t => t.id);

    const contenidos = await Contenido.findAll({
      where: {
        tema_id: temaIds,
        ...(canViewInactiveContenidos(req) ? {} : { estado: true })
      },
      include: [
        { model: Tema,    attributes: ['id', 'nombre', 'asignatura_id'] },
        { model: Subtema, attributes: ['id', 'nombre', 'tema_id'] },
      ],
    });

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener contenidos por asignatura", error });
  }
};

// Obtener contenidos adaptados al perfil del estudiante (todos ven todas las asignaturas)
exports.adaptarContenidoPorPerfil = async (req, res) => {
  try {
    const { estudianteId } = req.params;

    const estudiante = await Estudiante.findByPk(estudianteId);
    if (!estudiante) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    const asignaturas = await AsignaturaModel.findAll({
      where: { estado: true }
    });

    const asignaturaIds = asignaturas.map((asignatura) => asignatura.id);
    const nombresasignaturas = asignaturas.map((asignatura) => asignatura.nombre);

    const temas = await Tema.findAll({
      where: { asignatura_id: asignaturaIds, estado: true }
    });

    const temaIds = temas.map(tema => tema.id);

    const contenidos = await Contenido.findAll({
      where: { tema_id: temaIds, estado: true },
      include: [
        { model: Tema,    attributes: ['id', 'nombre', 'asignatura_id'] },
        { model: Subtema, attributes: ['id', 'nombre', 'tema_id'] },
      ],
    });

    res.json({
      estudianteId,
      periodo_academico: estudiante.periodo_academico,
      asignaturas: nombresasignaturas,
      totalContenidos: contenidos.length,
      contenidos
    });

  } catch (error) {
    res.status(500).json({
      message: "Error al adaptar los contenidos por perfil del estudiante",
      error: error.message || error
    });
  }
};

// Marcar contenido como visualizado y registrar progreso del estudiante
exports.marcarContenidoVisualizado = async (req, res) => {
  try {
    const { contenido_id, estudiante_id } = req.body;

    if (!contenido_id || !estudiante_id) {
      return res.status(400).json({
        message: "contenido_id y estudiante_id son requeridos"
      });
    }

    const contenido = await Contenido.findByPk(contenido_id);
    if (!contenido) {
      return res.status(404).json({
        message: "Contenido no encontrado"
      });
    }

    if (contenido.estado === false) {
      return res.status(400).json({
        message: 'El contenido está inactivo'
      });
    }

    const estudiante = await Estudiante.findByPk(estudiante_id);
    if (!estudiante) {
      return res.status(404).json({
        message: "Estudiante no encontrado"
      });
    }

    await contenido.update({ visualizado: true });

    // Cada periodo genera su propio registro de progreso; el historial de periodos anteriores se conserva.
    const periodoActual = estudiante.periodo_academico || '2026-A';
    const [progreso, created] = await Progreso.findOrCreate({
      where: {
        estudiante_id: estudiante_id,
        contenido_id: contenido_id,
        periodo_academico: periodoActual
      },
      defaults: {
        estudiante_id: estudiante_id,
        contenido_id: contenido_id,
        periodo_academico: periodoActual,
        completado: true,
        estado: 'Visualizado',
        fecha_inicio: new Date(),
        fecha_fin: new Date()
      }
    });

    // Si ya existía, actualizar a completado
    if (!created) {
      await progreso.update({
        completado: true,
        estado: 'Visualizado',
        fecha_fin: new Date()
      });
    }

    res.json({
      message: "Contenido marcado como visualizado y progreso registrado",
      contenido: {
        id: contenido.id,
        titulo: contenido.titulo,
        visualizado: contenido.visualizado
      },
      progreso: {
        id: progreso.id,
        estudiante_id: progreso.estudiante_id,
        contenido_id: progreso.contenido_id,
        completado: progreso.completado,
        estado: progreso.estado,
        fecha_inicio: progreso.fecha_inicio,
        fecha_fin: progreso.fecha_fin
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar contenido como visualizado",
      error: error.message || error
    });
  }
};

// Obtener estado de visualización de un contenido por un estudiante
exports.obtenerEstadoVisualizacion = async (req, res) => {
  try {
    const { contenido_id, estudiante_id } = req.query;

    if (!contenido_id || !estudiante_id) {
      return res.status(400).json({
        message: "contenido_id y estudiante_id son requeridos como parámetros de query"
      });
    }

    const cId = parseInt(contenido_id, 10);
    const eId = parseInt(estudiante_id, 10);

    if (isNaN(cId) || isNaN(eId)) {
      return res.status(400).json({
        message: "contenido_id y estudiante_id deben ser números válidos"
      });
    }

    const progreso = await Progreso.findOne({
      where: {
        estudiante_id: eId,
        contenido_id: cId
      }
    });

    if (!progreso) {
      return res.json({
        visualizado: false,
        contenido_id: cId,
        estudiante_id: eId,
        estado: 'No visualizado',
        fecha_inicio: null,
        fecha_fin: null,
        completado: false,
        mensaje: "El contenido no ha sido visualizado por este estudiante"
      });
    }

    res.json({
      visualizado: progresoCuentaContenidoVisualizado(progreso),
      contenido_id: progreso.contenido_id,
      estudiante_id: progreso.estudiante_id,
      estado: progreso.estado,
      fecha_inicio: progreso.fecha_inicio,
      fecha_fin: progreso.fecha_fin,
      completado: progreso.completado
    });

  } catch (error) {
    res.status(500).json({
      message: "Error al obtener estado de visualización",
      error: error.message || error
    });
  }
};
