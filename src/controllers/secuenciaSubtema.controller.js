const { SecuenciaSubtema, Subtema } = require('../models');
const { Op } = require('sequelize');

/**
 * Función auxiliar para validar la integridad de una secuencia de subtema
 * 
 * Validaciones realizadas:
 * 1. Existencia de ambos subtemas
 * 2. Evitar relación consigo mismo (A → A)
 * 3. Evitar duplicados exactos (A → B ya existe)
 * 4. Evitar relaciones inversas directas (B → A existe)
 * 5. Evitar múltiples salidas desde un subtema
 * 6. Evitar múltiples entradas hacia un subtema
 * 7. Evitar ciclos indirectos (A → B → ... → A)
 * 
 * @param {number} subtema_origen_id - ID del subtema origen
 * @param {number} subtema_destino_id - ID del subtema destino
 * @param {number} excludeSecuenciaId - ID de secuencia a excluir (para updates)
 * @returns {Object} { valido: boolean, error: string, detalles: Object }
 */
async function validarSecuenciaSubtema(
  subtema_origen_id,
  subtema_destino_id,
  excludeSecuenciaId = null
) {
  const resultado = {
    valido: true,
    error: null,
    detalles: {},
    validacionesRealizadas: []
  };

  try {
    // ========== VALIDACIÓN 1: Existencia de subtemas ==========
    const subtemaOrigen = await Subtema.findByPk(subtema_origen_id);
    if (!subtemaOrigen) {
      resultado.valido = false;
      resultado.error = `Subtema origen con ID ${subtema_origen_id} no existe`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V1: Existencia de subtema origen');

    const subtemaDestino = await Subtema.findByPk(subtema_destino_id);
    if (!subtemaDestino) {
      resultado.valido = false;
      resultado.error = `Subtema destino con ID ${subtema_destino_id} no existe`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V2: Subtema destino existe');

    // ========== VALIDACIÓN 2: Relación consigo mismo ==========
    if (subtema_origen_id === subtema_destino_id) {
      resultado.valido = false;
      resultado.error = `No se permite A → A. Origen y destino son el mismo subtema (ID: ${subtema_origen_id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V3: No es relación consigo mismo');

    // ========== VALIDACIÓN 3: Duplicados exactos ==========
    const whereClauseDuplicados = {
      subtema_origen_id,
      subtema_destino_id
    };
    if (excludeSecuenciaId) {
      whereClauseDuplicados.id = { [Op.ne]: excludeSecuenciaId };
    }

    const secuenciaDuplicada = await SecuenciaSubtema.findOne({
      where: whereClauseDuplicados
    });

    if (secuenciaDuplicada) {
      resultado.valido = false;
      resultado.error = `Ya existe secuencia duplicada ${subtema_origen_id} → ${subtema_destino_id} (ID: ${secuenciaDuplicada.id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V4: No hay duplicados');

    // ========== VALIDACIÓN 4: Relaciones inversas directas ==========
    const secuenciaInversa = await SecuenciaSubtema.findOne({
      where: {
        subtema_origen_id: subtema_destino_id,
        subtema_destino_id: subtema_origen_id
      }
    });

    if (secuenciaInversa) {
      resultado.valido = false;
      resultado.error = `No se permite relación inversa. Ya existe ${subtema_destino_id} → ${subtema_origen_id} (ID: ${secuenciaInversa.id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V5: No hay relación inversa');

    // ========== VALIDACIÓN 5: Múltiples salidas desde un subtema ==========
    const whereClauseSalidas = {
      subtema_origen_id
    };
    if (excludeSecuenciaId) {
      whereClauseSalidas.id = { [Op.ne]: excludeSecuenciaId };
    }

    const salidasExistentes = await SecuenciaSubtema.findAll({
      where: whereClauseSalidas
    });

    if (salidasExistentes && salidasExistentes.length > 0) {
      resultado.valido = false;
      const destinos = salidasExistentes.map(s => `${s.subtema_destino_id} (ID:${s.id})`).join(', ');
      resultado.error = `Subtema ${subtema_origen_id} ya tiene salidas a: ${destinos}. No se permiten múltiples salidas`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V6: Sin múltiples salidas');

    // ========== VALIDACIÓN 6: Múltiples entradas hacia un subtema ==========
    const whereClaseEntradas = {
      subtema_destino_id
    };
    if (excludeSecuenciaId) {
      whereClaseEntradas.id = { [Op.ne]: excludeSecuenciaId };
    }

    const entradasExistentes = await SecuenciaSubtema.findAll({
      where: whereClaseEntradas
    });

    if (entradasExistentes && entradasExistentes.length > 0) {
      resultado.valido = false;
      const origenes = entradasExistentes.map(s => `${s.subtema_origen_id} (ID:${s.id})`).join(', ');
      resultado.error = `Subtema ${subtema_destino_id} ya recibe desde: ${origenes}. No se permiten múltiples entradas`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V7: Sin múltiples entradas');

    // ========== VALIDACIÓN 7: Ciclos indirectos ==========
    const existeCiclo = await detectarCicloIndirecto(subtema_destino_id, subtema_origen_id);
    if (existeCiclo) {
      resultado.valido = false;
      resultado.error = `Ciclo detectado: ${subtema_destino_id} → ... → ${subtema_origen_id}. Crear ${subtema_origen_id} → ${subtema_destino_id} formaría bucle`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V8: Sin ciclos indirectos');

    resultado.detalles = {
      subtema_origen: {
        id: subtemaOrigen.id,
        nombre: subtemaOrigen.nombre,
        tema_id: subtemaOrigen.tema_id
      },
      subtema_destino: {
        id: subtemaDestino.id,
        nombre: subtemaDestino.nombre,
        tema_id: subtemaDestino.tema_id
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
 * @param {number} desde - Subtema desde el cual buscar
 * @param {number} objetivo - Subtema objetivo a encontrar
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
  const siguientes = await SecuenciaSubtema.findAll({
    where: { subtema_origen_id: desde }
  });

  // Recursivamente buscar en cada siguiente
  for (const secuencia of siguientes) {
    if (await detectarCicloIndirecto(secuencia.subtema_destino_id, objetivo, visitados)) {
      return true;
    }
  }

  return false;
}

// Crear una secuencia de subtema
exports.createSecuenciaSubtema = async (req, res) => {
  try {
    const { subtema_origen_id, subtema_destino_id, descripcion, estado } = req.body;

    if (!subtema_origen_id || !subtema_destino_id) {
      return res.status(400).json({
        message: "Faltan campos requeridos",
        error: "subtema_origen_id y subtema_destino_id son obligatorios"
      });
    }

    console.log(`[CREATE] Creando ${subtema_origen_id} → ${subtema_destino_id}`);

    // Ejecutar validaciones exhaustivas
    const validacion = await validarSecuenciaSubtema(
      subtema_origen_id,
      subtema_destino_id,
      null
    );

    if (!validacion.valido) {
      console.log(`[CREATE] ❌ Validación fallida: ${validacion.error}`);
      return res.status(400).json({
        message: "Validación fallida",
        error: validacion.error,
        detalles: validacion.detalles,
        validacionesRealizadas: validacion.validacionesRealizadas
      });
    }

    // Crear la secuencia
    const nuevaSecuencia = await SecuenciaSubtema.create({
      subtema_origen_id,
      subtema_destino_id,
      descripcion: descripcion || null,
      estado: estado !== undefined ? estado : true
    });

    console.log(`[CREATE] ✅ Creada. ID: ${nuevaSecuencia.id}`);

    return res.status(201).json({
      message: "Secuencia creada correctamente",
      secuencia: nuevaSecuencia,
      validacionesRealizadas: validacion.validacionesRealizadas,
      detallesSubtemas: validacion.detalles
    });
  } catch (error) {
    console.error(`[CREATE] Error: ${error.message}`);
    res.status(500).json({
      message: "Error al crear secuencia",
      error: error.message
    });
  }
};

// Obtener subtemas ordenados por secuencia de un tema
exports.getSubtemasOrdenadosPorSecuencia = async (req, res) => {
  try {
    const { temaId } = req.params;

    // Obtener todos los subtemas del tema
    const subtemas = await Subtema.findAll({
      where: { tema_id: temaId }
    });

    if (subtemas.length === 0) {
      return res.json([]);
    }

    // Obtener todas las secuencias activas
    const secuencias = await SecuenciaSubtema.findAll({
      where: { estado: true }
    });

    // Crear mapa de secuencias
    const secuenciaMap = new Map();
    secuencias.forEach(sec => {
      if (!secuenciaMap.has(sec.subtema_origen_id)) {
        secuenciaMap.set(sec.subtema_origen_id, []);
      }
      secuenciaMap.get(sec.subtema_origen_id).push(sec.subtema_destino_id);
    });

    // Encontrar subtemas iniciales (que no son destino de ninguno)
    const subtemasDestinoIds = new Set();
    secuencias.forEach(s => subtemasDestinoIds.add(s.subtema_destino_id));

    const subtemasIniciales = subtemas.filter(s => !subtemasDestinoIds.has(s.id));

    // Construir la secuencia ordenada
    const ordenado = [];
    const visitados = new Set();

    const agregarSecuencia = (subtemaId) => {
      if (visitados.has(subtemaId)) return;
      
      const subtema = subtemas.find(s => s.id === subtemaId);
      if (subtema) {
        ordenado.push(subtema);
        visitados.add(subtemaId);

        const destinos = secuenciaMap.get(subtemaId);
        if (destinos && destinos.length > 0) {
          agregarSecuencia(destinos[0]);
        }
      }
    };

    // Agregar secuencias desde subtemas iniciales
    subtemasIniciales.forEach(s => agregarSecuencia(s.id));

    // Añadir subtemas no secuenciados al final
    const ids = new Set(ordenado.map(s => s.id));
    subtemas.forEach(s => {
      if (!ids.has(s.id)) {
        ordenado.push(s);
      }
    });

    res.json(ordenado);
  } catch (error) {
    console.error("Error al obtener subtemas ordenados:", error);
    res.status(500).json({ message: "Error al obtener subtemas ordenados", error });
  }
};

// Listar todas las secuencias de subtema
exports.getSecuenciasSubtema = async (req, res) => {
  try {
    const secuencias = await SecuenciaSubtema.findAll({
      include: [
        { 
          model: Subtema,
          as: 'origen',
          attributes: ['id', 'nombre', 'descripcion']
        },
        { 
          model: Subtema,
          as: 'destino',
          attributes: ['id', 'nombre', 'descripcion']
        }
      ]
    });
    res.json(secuencias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener las secuencias de subtema", error });
  }
};

// Obtener una secuencia de subtema por ID
exports.getSecuenciaSubtemaById = async (req, res) => {
  try {
    const secuencia = await SecuenciaSubtema.findByPk(req.params.id, {
      include: [
        { 
          model: Subtema,
          as: 'origen',
          attributes: ['id', 'nombre', 'descripcion']
        },
        { 
          model: Subtema,
          as: 'destino',
          attributes: ['id', 'nombre', 'descripcion']
        }
      ]
    });

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de subtema no encontrada" });
    }

    res.json(secuencia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener la secuencia de subtema", error });
  }
};

// Habilitar o inhabilitar una secuencia de subtema
exports.toggleEstadoSecuenciaSubtema = async (req, res) => {
  try {
    const secuencia = await SecuenciaSubtema.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de subtema no encontrada" });
    }

    // Alternar el estado
    await secuencia.update({ estado: !secuencia.estado });

    res.json({
      message: `Secuencia de subtema ${secuencia.estado ? 'habilitada' : 'inhabilitada'} correctamente`,
      secuencia
    });
  } catch (error) {
    res.status(500).json({ message: "Error al cambiar el estado de la secuencia de subtema", error });
  }
};

// Actualizar una secuencia de subtema
exports.updateSecuenciaSubtema = async (req, res) => {
  try {
    const secuencia = await SecuenciaSubtema.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({
        message: "Secuencia no encontrada"
      });
    }

    const { subtema_origen_id, subtema_destino_id, descripcion, estado } = req.body;

    // Usar valores actuales si no se envían nuevos
    const nuevoOrigen = subtema_origen_id || secuencia.subtema_origen_id;
    const nuevoDestino = subtema_destino_id || secuencia.subtema_destino_id;

    console.log(`[UPDATE] ID ${secuencia.id}: (${secuencia.subtema_origen_id}→${secuencia.subtema_destino_id}) a (${nuevoOrigen}→${nuevoDestino})`);

    // Validar si hay cambios en los subtemas
    if (subtema_origen_id || subtema_destino_id) {
      const validacion = await validarSecuenciaSubtema(
        nuevoOrigen,
        nuevoDestino,
        req.params.id
      );

      if (!validacion.valido) {
        console.log(`[UPDATE] ❌ Validación fallida: ${validacion.error}`);
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
      subtema_origen_id: nuevoOrigen,
      subtema_destino_id: nuevoDestino,
      descripcion: descripcion !== undefined ? descripcion : secuencia.descripcion,
      estado: estado !== undefined ? estado : secuencia.estado
    });

    console.log(`[UPDATE] ✅ ID ${secuencia.id} actualizada`);

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

// Reorganizar secuencias de subtemas (drag & drop)
exports.reorderSequences = async (req, res) => {
  try {
    const { subtemas } = req.body;

    if (!Array.isArray(subtemas) || subtemas.length < 2) {
      return res.status(400).json({ 
        message: "Se requiere un array de al menos 2 subtemas en el nuevo orden" 
      });
    }

    // Validar que todos los subtemas existan
    const subtemasValidos = await Subtema.findAll({
      where: { id: subtemas }
    });

    if (subtemasValidos.length !== subtemas.length) {
      return res.status(400).json({ 
        message: "Uno o más subtemas especificados no existen" 
      });
    }

    // Obtener todas las secuencias que involucren estos subtemas
    const secuenciasExistentes = await SecuenciaSubtema.findAll({
      where: {
        [Op.or]: [
          { subtema_origen_id: subtemas },
          { subtema_destino_id: subtemas }
        ]
      }
    });

    // Crear un map de secuencias actuales
    const secuenciaMap = new Map();
    secuenciasExistentes.forEach(seq => {
      secuenciaMap.set(`${seq.subtema_origen_id}-${seq.subtema_destino_id}`, seq.id);
    });

    // Construir las nuevas secuencias basadas en el orden proporcionado
    const secuenciasNuevas = [];
    for (let i = 0; i < subtemas.length - 1; i++) {
      const origenId = subtemas[i];
      const destinoId = subtemas[i + 1];

      secuenciasNuevas.push({
        subtema_origen_id: origenId,
        subtema_destino_id: destinoId,
        descripcion: null,
        estado: true
      });
    }

    // Eliminar todas las secuencias antiguas que ya no se necesitan
    const idsAntiguas = secuenciasExistentes
      .filter(seq => !secuenciasNuevas.some(
        newSeq => newSeq.subtema_origen_id === seq.subtema_origen_id && 
                  newSeq.subtema_destino_id === seq.subtema_destino_id
      ))
      .map(seq => seq.id);

    if (idsAntiguas.length > 0) {
      await SecuenciaSubtema.destroy({
        where: { id: idsAntiguas }
      });
    }

    // Actualizar o crear las nuevas secuencias
    const secuenciasGuardadas = [];
    for (const newSeq of secuenciasNuevas) {
      const key = `${newSeq.subtema_origen_id}-${newSeq.subtema_destino_id}`;
      const existingId = secuenciaMap.get(key);

      if (existingId) {
        const seq = await SecuenciaSubtema.findByPk(existingId);
        if (seq) {
          await seq.update({
            estado: true
          });
          secuenciasGuardadas.push(seq);
        }
      } else {
        const seq = await SecuenciaSubtema.create(newSeq);
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
      message: "Error al reordenar las secuencias de subtema", 
      error: error.message 
    });
  }
};

// Eliminar una secuencia de subtema con reconexión automática
exports.deleteSecuenciaSubtema = async (req, res) => {
  try {
    const secuencia = await SecuenciaSubtema.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de subtema no encontrada" });
    }

    const { prevSequenceId, nextSequenceId } = req.body;

    // Si se proporcionan secuencias adyacentes, reconectar antes de eliminar
    if (prevSequenceId && nextSequenceId) {
      const prevSeq = await SecuenciaSubtema.findByPk(prevSequenceId);
      const nextSeq = await SecuenciaSubtema.findByPk(nextSequenceId);

      if (prevSeq && nextSeq) {
        await prevSeq.update({
          subtema_origen_id: prevSeq.subtema_origen_id,
          subtema_destino_id: nextSeq.subtema_destino_id,
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
    res.status(500).json({ message: "Error al eliminar la secuencia de subtema", error });
  }
};
