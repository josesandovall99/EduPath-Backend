const { SecuenciaContenido, Contenido, sequelize } = require('../models');
const { Op } = require('sequelize');

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

async function loadSubtemaSequenceGraph(subtemaId, includeInactiveSequences = false) {
  const parsedSubtemaId = parsePositiveInteger(subtemaId);

  if (!parsedSubtemaId || Number.isNaN(parsedSubtemaId)) {
    return {
      subtemaId: null,
      contenidos: [],
      contenidoIds: [],
      secuencias: []
    };
  }

  const contenidos = await Contenido.findAll({
    where: {
      subtema_id: parsedSubtemaId,
      estado: true
    },
    attributes: ['id', 'titulo', 'tipo', 'descripcion', 'tema_id', 'subtema_id', 'estado']
  });

  const contenidoIds = contenidos.map((contenido) => Number(contenido.id));
  if (contenidoIds.length === 0) {
    return {
      subtemaId: parsedSubtemaId,
      contenidos,
      contenidoIds,
      secuencias: []
    };
  }

  const where = {
    contenido_origen_id: { [Op.in]: contenidoIds },
    contenido_destino_id: { [Op.in]: contenidoIds },
    ...(includeInactiveSequences ? {} : { estado: true })
  };

  const secuencias = await SecuenciaContenido.findAll({
    where,
    attributes: ['id', 'contenido_origen_id', 'contenido_destino_id', 'descripcion', 'estado']
  });

  return {
    subtemaId: parsedSubtemaId,
    contenidos,
    contenidoIds,
    secuencias
  };
}

function buildCreationContextFromGraph(graph, requestedOriginId = null) {
  const availableContentIds = graph.contenidoIds.map((id) => Number(id));
  const activeSequences = graph.secuencias.filter((sequence) => sequence.estado !== false);
  const origenes = new Set(activeSequences.map((sequence) => Number(sequence.contenido_origen_id)));
  const destinos = new Set(activeSequences.map((sequence) => Number(sequence.contenido_destino_id)));
  const connectedContentIds = new Set([...origenes, ...destinos]);
  const tailCandidates = [...destinos].filter((destinoId) => !origenes.has(destinoId));

  const hasExistingChain = activeSequences.length > 0;
  const lockedOriginId = hasExistingChain && tailCandidates.length === 1 ? Number(tailCandidates[0]) : null;
  const normalizedRequestedOriginId = requestedOriginId && availableContentIds.includes(Number(requestedOriginId))
    ? Number(requestedOriginId)
    : null;
  const effectiveOriginId = hasExistingChain
    ? lockedOriginId
    : normalizedRequestedOriginId;

  const availableOriginIds = hasExistingChain
    ? (lockedOriginId ? [lockedOriginId] : [])
    : availableContentIds;

  const availableDestinationIds = hasExistingChain
    ? availableContentIds.filter((contentId) => contentId !== effectiveOriginId && !connectedContentIds.has(contentId))
    : availableContentIds.filter((contentId) => contentId !== effectiveOriginId);

  return {
    subtemaId: graph.subtemaId,
    hasExistingChain,
    lockedOriginId,
    effectiveOriginId,
    availableOriginIds,
    availableDestinationIds,
    connectedContentIds: [...connectedContentIds],
    totalActiveContents: availableContentIds.length,
    contents: graph.contenidos
  };
}

/**
 * Función auxiliar para validar la integridad de una secuencia de contenido
 * 
 * Validaciones realizadas:
 * 1. Existencia de ambos contenidos
 * 2. Evitar relación consigo mismo (A → A)
 * 3. Evitar duplicados exactos (A → B ya existe)
 * 4. Evitar relaciones inversas directas (B → A existe)
 * 5. Evitar múltiples salidas desde un contenido
 * 6. Evitar múltiples entradas hacia un contenido
 * 7. Evitar ciclos indirectos (A → B → ... → A)
 * 8. Validar pertenencia al mismo subtema (opcional)
 * 
 * @param {number} contenido_origen_id - ID del contenido origen
 * @param {number} contenido_destino_id - ID del contenido destino
 * @param {number} excludeSecuenciaId - ID de secuencia a excluir (para updates)
 * @param {boolean} validarSubtema - Si debe validar mismo subtema
 * @returns {Object} { valido: boolean, error: string, detalles: Object }
 */
async function validarSecuenciaContenido(
  contenido_origen_id,
  contenido_destino_id,
  excludeSecuenciaId = null,
  validarSubtema = true
) {
  const resultado = {
    valido: true,
    error: null,
    detalles: {},
    validacionesRealizadas: []
  };

  try {
    const origenId = Number(contenido_origen_id);
    const destinoId = Number(contenido_destino_id);
    const excludeId = excludeSecuenciaId ? Number(excludeSecuenciaId) : null;

    if (!Number.isInteger(origenId) || !Number.isInteger(destinoId)) {
      resultado.valido = false;
      resultado.error = 'Los IDs de origen y destino deben ser numéricos';
      return resultado;
    }

    // ========== VALIDACIÓN 1: Existencia de contenidos ==========
    const contenidoOrigen = await Contenido.findByPk(origenId);
    if (!contenidoOrigen) {
      resultado.valido = false;
      resultado.error = `Contenido origen con ID ${origenId} no existe`;
      return resultado;
    }
    if (contenidoOrigen.estado === false) {
      resultado.valido = false;
      resultado.error = `Contenido origen con ID ${origenId} está inhabilitado`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V1: Existencia de contenidos');

    const contenidoDestino = await Contenido.findByPk(destinoId);
    if (!contenidoDestino) {
      resultado.valido = false;
      resultado.error = `Contenido destino con ID ${destinoId} no existe`;
      return resultado;
    }
    if (contenidoDestino.estado === false) {
      resultado.valido = false;
      resultado.error = `Contenido destino con ID ${destinoId} está inhabilitado`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V2: Contenido destino existe');

    // ========== VALIDACIÓN 1.1: Mismo subtema ==========
    if (validarSubtema && Number(contenidoOrigen.subtema_id) !== Number(contenidoDestino.subtema_id)) {
      resultado.valido = false;
      resultado.error = `Contenidos en diferente subtema. Origen subtema_id: ${contenidoOrigen.subtema_id}, Destino subtema_id: ${contenidoDestino.subtema_id}`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V2.1: Mismo subtema');

    // ========== VALIDACIÓN 1.2: Continuidad de cadena (lineal) ==========
    if (validarSubtema) {
      const contenidosDelSubtema = await Contenido.findAll({
        where: { subtema_id: contenidoOrigen.subtema_id, estado: true },
        attributes: ['id']
      });
      const idsSubtema = contenidosDelSubtema.map((contenido) => Number(contenido.id));

      const whereClauseSubtema = {
        contenido_origen_id: { [Op.in]: idsSubtema },
        contenido_destino_id: { [Op.in]: idsSubtema }
      };

      if (excludeId) {
        whereClauseSubtema.id = { [Op.ne]: excludeId };
      }

      const secuenciasSubtema = await SecuenciaContenido.findAll({
        where: whereClauseSubtema,
        attributes: ['id', 'contenido_origen_id', 'contenido_destino_id']
      });

      if (secuenciasSubtema.length > 0) {
        const origenes = new Set(secuenciasSubtema.map((secuencia) => Number(secuencia.contenido_origen_id)));
        const destinos = new Set(secuenciasSubtema.map((secuencia) => Number(secuencia.contenido_destino_id)));
        const conectados = new Set([...origenes, ...destinos]);

        const colaActual = [...destinos].filter((destino) => !origenes.has(destino));

        if (colaActual.length !== 1) {
          resultado.valido = false;
          resultado.error = 'La cadena actual está fragmentada. Reorganiza antes de crear una nueva secuencia';
          return resultado;
        }

        const ultimoDestinoActual = Number(colaActual[0]);
        if (origenId !== ultimoDestinoActual) {
          resultado.valido = false;
          resultado.error = `El origen debe ser el último destino actual (ID: ${ultimoDestinoActual})`;
          return resultado;
        }

        if (conectados.has(destinoId)) {
          resultado.valido = false;
          resultado.error = 'El destino ya participa en la cadena actual';
          return resultado;
        }
      }
    }
    resultado.validacionesRealizadas.push('✅ V2.2: Continuidad lineal de cadena');

    // ========== VALIDACIÓN 2: Relación consigo mismo ==========
    if (origenId === destinoId) {
      resultado.valido = false;
      resultado.error = `No se permite A → A. Origen y destino son el mismo contenido (ID: ${origenId})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V3: No es relación consigo mismo');

    // ========== VALIDACIÓN 3: Duplicados exactos ==========
    const whereClauseDuplicados = {
      contenido_origen_id: origenId,
      contenido_destino_id: destinoId
    };
    if (excludeId) {
      whereClauseDuplicados.id = { [Op.ne]: excludeId };
    }

    const secuenciaDuplicada = await SecuenciaContenido.findOne({
      where: whereClauseDuplicados
    });

    if (secuenciaDuplicada) {
      resultado.valido = false;
      resultado.error = `Ya existe secuencia duplicada ${origenId} → ${destinoId} (ID: ${secuenciaDuplicada.id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V4: No hay duplicados');

    // ========== VALIDACIÓN 4: Relaciones inversas directas ==========
    const secuenciaInversa = await SecuenciaContenido.findOne({
      where: {
        contenido_origen_id: destinoId,
        contenido_destino_id: origenId,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
      }
    });

    if (secuenciaInversa) {
      resultado.valido = false;
      resultado.error = `No se permite relación inversa. Ya existe ${destinoId} → ${origenId} (ID: ${secuenciaInversa.id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V5: No hay relación inversa');

    // ========== VALIDACIÓN 5: Múltiples salidas desde un contenido ==========
    const whereClauseSalidas = {
      contenido_origen_id: origenId
    };
    if (excludeId) {
      whereClauseSalidas.id = { [Op.ne]: excludeId };
    }

    const salidasExistentes = await SecuenciaContenido.findAll({
      where: whereClauseSalidas
    });

    if (salidasExistentes && salidasExistentes.length > 0) {
      resultado.valido = false;
      const destinos = salidasExistentes.map(s => `${s.contenido_destino_id} (ID:${s.id})`).join(', ');
      resultado.error = `Contenido ${origenId} ya tiene salidas a: ${destinos}. No se permiten múltiples salidas`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V6: Sin múltiples salidas');

    // ========== VALIDACIÓN 6: Múltiples entradas hacia un contenido ==========
    const whereClaseEntradas = {
      contenido_destino_id: destinoId
    };
    if (excludeId) {
      whereClaseEntradas.id = { [Op.ne]: excludeId };
    }

    const entradasExistentes = await SecuenciaContenido.findAll({
      where: whereClaseEntradas
    });

    if (entradasExistentes && entradasExistentes.length > 0) {
      resultado.valido = false;
      const origenes = entradasExistentes.map(s => `${s.contenido_origen_id} (ID:${s.id})`).join(', ');
      resultado.error = `Contenido ${destinoId} ya recibe desde: ${origenes}. No se permiten múltiples entradas`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V7: Sin múltiples entradas');

    // ========== VALIDACIÓN 7: Ciclos indirectos ==========
    const existeCiclo = await detectarCicloIndirecto(destinoId, origenId);
    if (existeCiclo) {
      resultado.valido = false;
      resultado.error = `Ciclo detectado: ${destinoId} → ... → ${origenId}. Crear ${origenId} → ${destinoId} formaría bucle`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V8: Sin ciclos indirectos');

    resultado.detalles = {
      contenido_origen: {
        id: contenidoOrigen.id,
        titulo: contenidoOrigen.titulo,
        subtema_id: contenidoOrigen.subtema_id
      },
      contenido_destino: {
        id: contenidoDestino.id,
        titulo: contenidoDestino.titulo,
        subtema_id: contenidoDestino.subtema_id
      }
    };

    return resultado;
  } catch (error) {
    resultado.valido = false;
    resultado.error = `Error en validación: ${error.message}`;
    console.error(`[ERROR VALIDACION] ${error.message}`);
    return resultado;
  }
}

/**
 * Función auxiliar para detectar ciclos indirectos usando DFS (Depth-First Search)
 * Verifica si hay un camino desde 'destino' hacia 'origen'
 * 
 * @param {number} desde - Contenido desde el cual buscar
 * @param {number} objetivo - Contenido objetivo a encontrar
 * @param {Set} visitados - Conjunto de nodos ya visitados
 * @returns {boolean} true si se detecta un ciclo potencial
 */
async function detectarCicloIndirecto(desde, objetivo, visitados = new Set()) {
  // Prevenir bucle infinito
  if (visitados.has(desde)) {
    return false;
  }

  visitados.add(desde);

  // Si encontramos el objetivo, hay ciclo
  if (desde === objetivo) {
    return true;
  }

  // Buscar todas las secuencias donde 'desde' es origen
  const siguientes = await SecuenciaContenido.findAll({
    where: { contenido_origen_id: desde }
  });

  // Recursivamente buscar en cada siguiente
  for (const secuencia of siguientes) {
    if (await detectarCicloIndirecto(secuencia.contenido_destino_id, objetivo, visitados)) {
      return true;
    }
  }

  return false;
}

// Crear una secuencia de contenido
exports.createSecuenciaContenido = async (req, res) => {
  try {
    const { contenido_origen_id, contenido_destino_id, descripcion, estado } = req.body;

    if (!contenido_origen_id || !contenido_destino_id) {
      return res.status(400).json({
        message: "Faltan campos requeridos",
        error: "contenido_origen_id y contenido_destino_id son obligatorios"
      });
    }

    console.log(`[CREATE] Creando ${contenido_origen_id} → ${contenido_destino_id}`);

    // Ejecutar 8 validaciones exhaustivas
    const validacion = await validarSecuenciaContenido(
      contenido_origen_id,
      contenido_destino_id,
      null,
      true
    );

    if (!validacion.valido) {
      console.log(`[CREATE] Validacion fallida: ${validacion.error}`);
      return res.status(400).json({
        message: "Validación fallida",
        error: validacion.error,
        detalles: validacion.detalles,
        validacionesRealizadas: validacion.validacionesRealizadas
      });
    }

    // Crear la secuencia
    const nuevaSecuencia = await SecuenciaContenido.create({
      contenido_origen_id,
      contenido_destino_id,
      descripcion: descripcion || null,
      estado: estado !== undefined ? estado : true
    });

    console.log(`[CREATE] Secuencia creada. ID: ${nuevaSecuencia.id}`);

    return res.status(201).json({
      message: "Secuencia creada correctamente",
      secuencia: nuevaSecuencia,
      validacionesRealizadas: validacion.validacionesRealizadas,
      detallesContenidos: validacion.detalles
    });
  } catch (error) {
    console.error(`[CREATE] Error: ${error.message}`);
    res.status(500).json({
      message: "Error al crear secuencia",
      error: error.message
    });
  }
};

// Obtener contenidos ordenados por secuencia de un subtema
exports.getContenidosOrdenadosPorSecuencia = async (req, res) => {
  try {
    const { subtemaId } = req.params;

    // Obtener todos los contenidos del subtema
    const contenidos = await Contenido.findAll({
      where: { subtema_id: subtemaId, estado: true }
    });

    if (contenidos.length === 0) {
      return res.json([]);
    }

    // Obtener todas las secuencias activas
    const secuencias = await SecuenciaContenido.findAll({
      where: { estado: true }
    });

    // Crear mapa de secuencias (un origen puede tener múltiples destinos)
    const secuenciaMap = new Map(); // contenido_origen_id -> [destinos]
    secuencias.forEach(sec => {
      if (!secuenciaMap.has(sec.contenido_origen_id)) {
        secuenciaMap.set(sec.contenido_origen_id, []);
      }
      secuenciaMap.get(sec.contenido_origen_id).push(sec.contenido_destino_id);
    });

    // Encontrar contenidos iniciales (que no son destino de ninguno)
    const contenidosDestinoIds = new Set();
    secuencias.forEach(s => contenidosDestinoIds.add(s.contenido_destino_id));

    const contenidosIniciales = contenidos.filter(c => !contenidosDestinoIds.has(c.id));

    // Construir la secuencia ordenada usando el primer destino de cada origen
    // Para reorganización completa, podrías necesitar una lógica más compleja
    const ordenado = [];
    const visitados = new Set();

    // Función recursiva para construir la secuencia
    const agregarSecuencia = (contenidoId) => {
      if (visitados.has(contenidoId)) return;
      
      const contenido = contenidos.find(c => c.id === contenidoId);
      if (contenido) {
        ordenado.push(contenido);
        visitados.add(contenidoId);

        // Obtener el primer destino de este origen (para mantener compatibilidad con cascada)
        const destinos = secuenciaMap.get(contenidoId);
        if (destinos && destinos.length > 0) {
          agregarSecuencia(destinos[0]); // Toma el primer destino
        }
      }
    };

    // Agregar secuencias desde contenidos iniciales
    contenidosIniciales.forEach(c => agregarSecuencia(c.id));

    // Añadir contenidos no secuenciados al final
    const ids = new Set(ordenado.map(c => c.id));
    contenidos.forEach(c => {
      if (!ids.has(c.id)) {
        ordenado.push(c);
      }
    });

    res.json(ordenado);
  } catch (error) {
    console.error("Error al obtener contenidos ordenados:", error);
    res.status(500).json({ message: "Error al obtener contenidos ordenados", error });
  }
};

exports.getSecuenciaContenidoCreationContext = async (req, res) => {
  try {
    const subtemaId = parsePositiveInteger(req.params.subtemaId);
    const origenId = parsePositiveInteger(req.query.origenId);

    if (!subtemaId || Number.isNaN(subtemaId)) {
      return res.status(400).json({ message: 'El subtema indicado no es válido' });
    }

    if (Number.isNaN(origenId)) {
      return res.status(400).json({ message: 'El origen indicado no es válido' });
    }

    const graph = await loadSubtemaSequenceGraph(subtemaId);
    const context = buildCreationContextFromGraph(graph, origenId);

    res.json(context);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el contexto de creación de secuencias', error });
  }
};

// Listar todas las secuencias de contenido
exports.getSecuenciasContenido = async (req, res) => {
  try {
    const subtemaId = parsePositiveInteger(req.query.subtemaId);
    const where = {};

    if (Number.isNaN(subtemaId)) {
      return res.status(400).json({ message: 'El subtema indicado no es válido' });
    }

    if (subtemaId) {
      const graph = await loadSubtemaSequenceGraph(subtemaId, true);

      if (graph.contenidoIds.length === 0) {
        return res.json([]);
      }

      where.contenido_origen_id = { [Op.in]: graph.contenidoIds };
      where.contenido_destino_id = { [Op.in]: graph.contenidoIds };
    }

    const secuencias = await SecuenciaContenido.findAll({
      where,
      include: [
        { 
          model: Contenido,
          as: 'origen',
          attributes: ['id', 'titulo', 'descripcion']
        },
        { 
          model: Contenido,
          as: 'destino',
          attributes: ['id', 'titulo', 'descripcion']
        }
      ]
    });
    res.json(secuencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener las secuencias de contenido", error });
  }
};

// Obtener una secuencia de contenido por ID
exports.getSecuenciaContenidoById = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id, {
      include: [
        { 
          model: Contenido,
          as: 'origen',
          attributes: ['id', 'titulo', 'descripcion']
        },
        { 
          model: Contenido,
          as: 'destino',
          attributes: ['id', 'titulo', 'descripcion']
        }
      ]
    });

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    res.json(secuencia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener la secuencia de contenido", error });
  }
};

// Habilitar o inhabilitar una secuencia de contenido
exports.toggleEstadoSecuenciaContenido = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    // Alternar el estado (true -> false, false -> true)
    if (!secuencia.estado) {
      const [origen, destino] = await Promise.all([
        Contenido.findByPk(secuencia.contenido_origen_id),
        Contenido.findByPk(secuencia.contenido_destino_id)
      ]);

      if (!origen || origen.estado === false || !destino || destino.estado === false) {
        return res.status(400).json({
          message: 'No se puede habilitar la secuencia porque el contenido origen o destino está inhabilitado'
        });
      }
    }

    await secuencia.update({ estado: !secuencia.estado });

    res.json({
      message: `Secuencia de contenido ${secuencia.estado ? 'habilitada' : 'inhabilitada'} correctamente`,
      secuencia
    });
  } catch (error) {
    res.status(500).json({ message: "Error al cambiar el estado de la secuencia de contenido", error });
  }
};

// Actualizar una secuencia de contenido
exports.updateSecuenciaContenido = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({
        message: "Secuencia no encontrada"
      });
    }

    const { contenido_origen_id, contenido_destino_id, descripcion, estado } = req.body;

    // Usar valores actuales si no se envían nuevos
    const nuevoOrigen = contenido_origen_id || secuencia.contenido_origen_id;
    const nuevoDestino = contenido_destino_id || secuencia.contenido_destino_id;

    console.log(`[UPDATE] ID ${secuencia.id}: (${secuencia.contenido_origen_id}→${secuencia.contenido_destino_id}) a (${nuevoOrigen}→${nuevoDestino})`);

    const origenAnterior = Number(secuencia.contenido_origen_id);
    const destinoAnterior = Number(secuencia.contenido_destino_id);
    const cambiaOrigen = contenido_origen_id !== undefined && Number(contenido_origen_id) !== origenAnterior;
    const cambiaDestino = contenido_destino_id !== undefined && Number(contenido_destino_id) !== destinoAnterior;

    if (contenido_origen_id || contenido_destino_id) {
      const [contenidoOrigen, contenidoDestino] = await Promise.all([
        Contenido.findByPk(Number(nuevoOrigen)),
        Contenido.findByPk(Number(nuevoDestino))
      ]);

      if (!contenidoOrigen || contenidoOrigen.estado === false || !contenidoDestino || contenidoDestino.estado === false) {
        return res.status(400).json({
          message: 'No se puede actualizar la secuencia con contenidos inhabilitados'
        });
      }
    }

    // Caso especial: inversión de tramo (ej. 1→2→3 al cambiar 1 por 3 => 3→2→1)
    if (cambiaOrigen && !cambiaDestino) {
      const secuenciaSiguiente = await SecuenciaContenido.findOne({
        where: {
          id: { [Op.ne]: secuencia.id },
          contenido_origen_id: destinoAnterior,
          contenido_destino_id: Number(nuevoOrigen)
        }
      });

      if (secuenciaSiguiente) {
        const transaction = await sequelize.transaction();
        try {
          await secuencia.update({
            contenido_origen_id: Number(nuevoOrigen),
            contenido_destino_id: destinoAnterior,
            descripcion: descripcion !== undefined ? descripcion : secuencia.descripcion,
            estado: estado !== undefined ? estado : secuencia.estado
          }, { transaction });

          await secuenciaSiguiente.update({
            contenido_origen_id: destinoAnterior,
            contenido_destino_id: origenAnterior,
            estado: secuenciaSiguiente.estado
          }, { transaction });

          await transaction.commit();

          return res.json({
            message: "Secuencia actualizada correctamente",
            secuencia
          });
        } catch (swapError) {
          await transaction.rollback();
          throw swapError;
        }
      }
    }

    // Validar si hay cambios en los contenidos
    if (contenido_origen_id || contenido_destino_id) {
      const validacion = await validarSecuenciaContenido(
        nuevoOrigen,
        nuevoDestino,
        req.params.id,  // Excluir esta secuencia
        true
      );

      if (!validacion.valido) {
        console.log(`[UPDATE] Validacion fallida: ${validacion.error}`);
        return res.status(400).json({
          message: "Validación fallida",
          error: validacion.error,
          detalles: validacion.detalles,
          validacionesRealizadas: validacion.validacionesRealizadas
        });
      }
    }

    // Actualizar
    const actualizada = await secuencia.update({
      contenido_origen_id: nuevoOrigen,
      contenido_destino_id: nuevoDestino,
      descripcion: descripcion !== undefined ? descripcion : secuencia.descripcion,
      estado: estado !== undefined ? estado : secuencia.estado
    });

    console.log(`[UPDATE] ID ${secuencia.id} actualizada`);

    return res.json({
      message: "Secuencia actualizada correctamente",
      secuencia: actualizada
    });
  } catch (error) {
    console.error(`[UPDATE] Error: ${error.message}`);
    res.status(500).json({
      message: "Error al actualizar secuencia",
      error: error.message
    });
  }
};

// 🆕 Reorganizar secuencias completas de un contenedor (ej: al reordenar por drag & drop)
// Recibe: { contenidos: [id1, id2, id3, ...] } en el nuevo orden
// Actualiza TODAS las secuencias para reflejar el nuevo orden
// Ejemplo: A->B->C reordenado a C->B->A creará: C->B->A
exports.reorderSequences = async (req, res) => {
  try {
    const { contenidos } = req.body;

    // Validar que se proporcione una lista no vacía
    if (!Array.isArray(contenidos) || contenidos.length < 2) {
      return res.status(400).json({ 
        message: "Se requiere un array de al menos 2 contenidos en el nuevo orden" 
      });
    }

    const uniqueContenidos = new Set(contenidos.map(Number));
    if (uniqueContenidos.size !== contenidos.length) {
      return res.status(400).json({
        message: "El nuevo orden no puede contener contenidos repetidos"
      });
    }

    // Validar que todos los contenidos existan
    const contenidosValidos = await Contenido.findAll({
      where: { id: contenidos, estado: true },
      attributes: ['id', 'subtema_id']
    });

    if (contenidosValidos.length !== contenidos.length) {
      return res.status(400).json({ 
        message: "Uno o más contenidos especificados no existen o están inhabilitados" 
      });
    }

    const subtemasEnOrden = new Set(contenidosValidos.map((contenido) => Number(contenido.subtema_id)));
    if (subtemasEnOrden.size !== 1) {
      return res.status(400).json({
        message: "El nuevo orden debe contener contenidos de un mismo subtema"
      });
    }

    // Obtener todas las secuencias que involucren estos contenidos
    const secuenciasExistentes = await SecuenciaContenido.findAll({
      where: {
        [Op.or]: [
          { contenido_origen_id: contenidos },
          { contenido_destino_id: contenidos }
        ]
      }
    });

    // Crear un map de secuencias actuales para reutilizar IDs
    const secuenciaMap = new Map();
    secuenciasExistentes.forEach(seq => {
      secuenciaMap.set(`${seq.contenido_origen_id}-${seq.contenido_destino_id}`, seq.id);
    });

    // Construir las nuevas secuencias basadas en el orden proporcionado
    const secuenciasNuevas = [];
    for (let i = 0; i < contenidos.length - 1; i++) {
      const origenId = contenidos[i];
      const destinoId = contenidos[i + 1];

      secuenciasNuevas.push({
        contenido_origen_id: origenId,
        contenido_destino_id: destinoId,
        descripcion: null,
        estado: true
      });
    }

    // Eliminar todas las secuencias antiguas que ya no se necesitan
    const idsAntiguas = secuenciasExistentes
      .filter(seq => !secuenciasNuevas.some(
        newSeq => newSeq.contenido_origen_id === seq.contenido_origen_id && 
                  newSeq.contenido_destino_id === seq.contenido_destino_id
      ))
      .map(seq => seq.id);

    if (idsAntiguas.length > 0) {
      await SecuenciaContenido.destroy({
        where: { id: idsAntiguas }
      });
    }

    // Actualizar o crear las nuevas secuencias
    const secuenciasGuardadas = [];
    for (const newSeq of secuenciasNuevas) {
      const key = `${newSeq.contenido_origen_id}-${newSeq.contenido_destino_id}`;
      const existingId = secuenciaMap.get(key);

      if (existingId) {
        // Actualizar si ya existe
        const seq = await SecuenciaContenido.findByPk(existingId);
        if (seq) {
          await seq.update({
            estado: true // Asegurar que está habilitada
          });
          secuenciasGuardadas.push(seq);
        }
      } else {
        // Crear nueva si no existe
        const seq = await SecuenciaContenido.create(newSeq);
        secuenciasGuardadas.push(seq);
      }
    }

    res.json({
      message: "Secuencias reordenadas correctamente",
      secuenciasCreadas: secuenciasGuardadas.length,
      secuenciasEliminadas: idsAntiguas.length,
      secuencias: secuenciasGuardadas
    });
  } catch (error) {
    console.error("Error al reordenar secuencias:", error);
    res.status(500).json({ 
      message: "Error al reordenar las secuencias de contenido", 
      error: error.message 
    });
  }
};

// Eliminar una secuencia de contenido con reconexión automática
// Acepta opcionalmente secuencias adyacentes para reconectar antes de eliminar
exports.deleteSecuenciaContenido = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    const { prevSequenceId, nextSequenceId } = req.body; // Opcionales: para reconectar

    // Si se proporcionan secuencias adyacentes, reconectar antes de eliminar
    if (prevSequenceId && nextSequenceId) {
      const prevSeq = await SecuenciaContenido.findByPk(prevSequenceId);
      const nextSeq = await SecuenciaContenido.findByPk(nextSequenceId);

      if (prevSeq && nextSeq) {
        // Actualizar la secuencia anterior para que apunte directamente al destino de la siguiente
        // Esto mantiene la cadena intacta
        await prevSeq.update({
          contenido_origen_id: prevSeq.contenido_origen_id,
          contenido_destino_id: nextSeq.contenido_destino_id, // Reconecta saltando la eliminada
          descripcion: prevSeq.descripcion,
          estado: prevSeq.estado
        });
      }
    }

    // Eliminar la secuencia solicitada
    await secuencia.destroy();

    res.json({ 
      message: "Secuencia eliminada correctamente",
      eliminada: secuencia.id
    });
  } catch (error) {
    console.error("Error al eliminar secuencia:", error);
    res.status(500).json({ message: "Error al eliminar la secuencia de contenido", error });
  }
};
