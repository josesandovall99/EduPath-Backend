const { SecuenciaContenido, Contenido } = require('../models');

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
  const { Op } = require('sequelize');
  const resultado = {
    valido: true,
    error: null,
    detalles: {},
    validacionesRealizadas: []
  };

  try {
    // ========== VALIDACIÓN 1: Existencia de contenidos ==========
    const contenidoOrigen = await Contenido.findByPk(contenido_origen_id);
    if (!contenidoOrigen) {
      resultado.valido = false;
      resultado.error = `Contenido origen con ID ${contenido_origen_id} no existe`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V1: Existencia de contenidos');

    const contenidoDestino = await Contenido.findByPk(contenido_destino_id);
    if (!contenidoDestino) {
      resultado.valido = false;
      resultado.error = `Contenido destino con ID ${contenido_destino_id} no existe`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V2: Contenido destino existe');

    // ========== VALIDACIÓN 2: Relación consigo mismo ==========
    if (contenido_origen_id === contenido_destino_id) {
      resultado.valido = false;
      resultado.error = `No se permite A → A. Origen y destino son el mismo contenido (ID: ${contenido_origen_id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V3: No es relación consigo mismo');

    // ========== VALIDACIÓN 3: Duplicados exactos ==========
    const whereClauseDuplicados = {
      contenido_origen_id,
      contenido_destino_id
    };
    if (excludeSecuenciaId) {
      whereClauseDuplicados.id = { [Op.ne]: excludeSecuenciaId };
    }

    const secuenciaDuplicada = await SecuenciaContenido.findOne({
      where: whereClauseDuplicados
    });

    if (secuenciaDuplicada) {
      resultado.valido = false;
      resultado.error = `Ya existe secuencia duplicada ${contenido_origen_id} → ${contenido_destino_id} (ID: ${secuenciaDuplicada.id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V4: No hay duplicados');

    // ========== VALIDACIÓN 4: Relaciones inversas directas ==========
    const secuenciaInversa = await SecuenciaContenido.findOne({
      where: {
        contenido_origen_id: contenido_destino_id,
        contenido_destino_id: contenido_origen_id
      }
    });

    if (secuenciaInversa) {
      resultado.valido = false;
      resultado.error = `No se permite relación inversa. Ya existe ${contenido_destino_id} → ${contenido_origen_id} (ID: ${secuenciaInversa.id})`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V5: No hay relación inversa');

    // ========== VALIDACIÓN 5: Múltiples salidas desde un contenido ==========
    const whereClauseSalidas = {
      contenido_origen_id
    };
    if (excludeSecuenciaId) {
      whereClauseSalidas.id = { [Op.ne]: excludeSecuenciaId };
    }

    const salidasExistentes = await SecuenciaContenido.findAll({
      where: whereClauseSalidas
    });

    if (salidasExistentes && salidasExistentes.length > 0) {
      resultado.valido = false;
      const destinos = salidasExistentes.map(s => `${s.contenido_destino_id} (ID:${s.id})`).join(', ');
      resultado.error = `Contenido ${contenido_origen_id} ya tiene salidas a: ${destinos}. No se permiten múltiples salidas`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V6: Sin múltiples salidas');

    // ========== VALIDACIÓN 6: Múltiples entradas hacia un contenido ==========
    const whereClaseEntradas = {
      contenido_destino_id
    };
    if (excludeSecuenciaId) {
      whereClaseEntradas.id = { [Op.ne]: excludeSecuenciaId };
    }

    const entradasExistentes = await SecuenciaContenido.findAll({
      where: whereClaseEntradas
    });

    if (entradasExistentes && entradasExistentes.length > 0) {
      resultado.valido = false;
      const origenes = entradasExistentes.map(s => `${s.contenido_origen_id} (ID:${s.id})`).join(', ');
      resultado.error = `Contenido ${contenido_destino_id} ya recibe desde: ${origenes}. No se permiten múltiples entradas`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V7: Sin múltiples entradas');

    // ========== VALIDACIÓN 7: Ciclos indirectos ==========
    const existeCiclo = await detectarCicloIndirecto(contenido_destino_id, contenido_origen_id);
    if (existeCiclo) {
      resultado.valido = false;
      resultado.error = `Ciclo detectado: ${contenido_destino_id} → ... → ${contenido_origen_id}. Crear ${contenido_origen_id} → ${contenido_destino_id} formaría bucle`;
      return resultado;
    }
    resultado.validacionesRealizadas.push('✅ V8: Sin ciclos indirectos');

    // ========== VALIDACIÓN 8: Pertenencia al mismo subtema ==========
    if (validarSubtema) {
      if (contenidoOrigen.subtema_id !== contenidoDestino.subtema_id) {
        resultado.valido = false;
        resultado.error = `Contenidos en diferente subtema. Origen subtema_id: ${contenidoOrigen.subtema_id}, Destino subtema_id: ${contenidoDestino.subtema_id}`;
        return resultado;
      }
      resultado.validacionesRealizadas.push('✅ V9: Mismo subtema');
    }

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
      console.log(`[CREATE] ❌ Validación fallida: ${validacion.error}`);
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

    console.log(`[CREATE] ✅ Creada. ID: ${nuevaSecuencia.id}`);

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

// ...existing code...

// Obtener contenidos ordenados por secuencia de un subtema
exports.getContenidosOrdenadosPorSecuencia = async (req, res) => {
  try {
    const { subtemaId } = req.params;

    // Obtener todos los contenidos del subtema
    const contenidos = await Contenido.findAll({
      where: { subtema_id: subtemaId }
    });

    if (contenidos.length === 0) {
      return res.json([]);
    }

    // Obtener todas las secuencias activas
    const secuencias = await SecuenciaContenido.findAll({
      where: { estado: true }
    });

    // Crear mapa de secuencias
    const secuenciaMap = new Map();
    secuencias.forEach(sec => {
      secuenciaMap.set(sec.contenido_origen_id, sec.contenido_destino_id);
    });

    // Encontrar el contenido inicial (que no es destino de ninguno)
    let contenidoInicialId = null;
    for (const contenido of contenidos) {
      const esDestino = secuencias.some(s => s.contenido_destino_id === contenido.id);
      if (!esDestino) {
        contenidoInicialId = contenido.id;
        break;
      }
    }

    // Si no hay inicial, comenzar con el primero
    if (!contenidoInicialId && contenidos.length > 0) {
      contenidoInicialId = contenidos[0].id;
    }

    // Construir la secuencia ordenada
    const ordenado = [];
    let actual = contenidoInicialId;

    while (actual !== null && actual !== undefined) {
      const contenido = contenidos.find(c => c.id === actual);
      if (contenido) {
        ordenado.push(contenido);
      }
      actual = secuenciaMap.get(actual);
    }

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

// ...existing code...

// Listar todas las secuencias de contenido
exports.getSecuenciasContenido = async (req, res) => {
  try {
    const secuencias = await SecuenciaContenido.findAll({
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
    console.error(error); // 👈 importante para ver el error real en consola
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

    // Validar si hay cambios en los contenidos
    if (contenido_origen_id || contenido_destino_id) {
      const validacion = await validarSecuenciaContenido(
        nuevoOrigen,
        nuevoDestino,
        req.params.id,  // Excluir esta secuencia
        true
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
      contenido_origen_id: nuevoOrigen,
      contenido_destino_id: nuevoDestino,
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


// Eliminar una secuencia de contenido con lógica de cascada
exports.deleteSecuenciaContenido = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    // 🚫 Buscar secuencias que dependan del destino de la secuencia eliminada
    const dependientes = await SecuenciaContenido.findAll({
      where: { contenido_origen_id: secuencia.contenido_destino_id }
    });

    // Eliminar todas las secuencias dependientes
    for (const dep of dependientes) {
      await dep.destroy();
    }

    // ✅ Eliminar la secuencia original
    await secuencia.destroy();

    res.json({ 
      message: "Secuencia eliminada correctamente junto con sus dependencias",
      eliminadas: [secuencia.id, ...dependientes.map(d => d.id)]
    });
  } catch (error) {
    console.error("Error al eliminar secuencia:", error);
    res.status(500).json({ message: "Error al eliminar la secuencia de contenido", error });
  }
};

