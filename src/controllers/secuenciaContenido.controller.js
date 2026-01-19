const { SecuenciaContenido, Contenido } = require('../models');
const { Op } = require('sequelize');

// Crear una secuencia de contenido
exports.createSecuenciaContenido = async (req, res) => {
  try {
    const { contenido_origen_id, contenido_destino_id, descripcion, estado } = req.body;

    // Validar que ambos contenidos existan
    const contenidoOrigen = await Contenido.findByPk(contenido_origen_id);
    if (!contenidoOrigen) {
      return res.status(400).json({ message: "El contenido origen especificado no existe" });
    }

    const contenidoDestino = await Contenido.findByPk(contenido_destino_id);
    if (!contenidoDestino) {
      return res.status(400).json({ message: "El contenido destino especificado no existe" });
    }

    // Validar que no sea la misma relación (origen === destino)
    if (contenido_origen_id === contenido_destino_id) {
      return res.status(400).json({ message: "El contenido origen no puede ser el mismo que el destino" });
    }

    // 🚫 Validación 1: evitar relación inversa
    const existeInversa = await SecuenciaContenido.findOne({
      where: {
        contenido_origen_id: contenido_destino_id,
        contenido_destino_id: contenido_origen_id
      }
    });

    if (existeInversa) {
      return res.status(400).json({ message: "No se puede crear una relación inversa entre contenidos" });
    }

    // ✅ VALIDACIÓN 2 ELIMINADA para permitir reorganización de secuencias
    // Ahora un contenido puede ser origen en múltiples secuencias
    // Esto permite insertar secuencias en el medio y reorganizar el orden

    // ✅ Crear la secuencia de contenido
    const nuevaSecuencia = await SecuenciaContenido.create({
      contenido_origen_id,
      contenido_destino_id,
      descripcion,
      estado: estado !== undefined ? estado : true
    });

    res.status(201).json(nuevaSecuencia);
  } catch (error) {
    console.error("Error al crear secuencia:", error);
    res.status(500).json({ message: "Error al crear la secuencia de contenido", error });
  }
};

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
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    const { contenido_origen_id, contenido_destino_id, descripcion, estado } = req.body;

    // Validar que los contenidos existan si se envían
    if (contenido_origen_id) {
      const contenidoOrigen = await Contenido.findByPk(contenido_origen_id);
      if (!contenidoOrigen) {
        return res.status(400).json({ message: "El contenido origen especificado no existe" });
      }
    }

    if (contenido_destino_id) {
      const contenidoDestino = await Contenido.findByPk(contenido_destino_id);
      if (!contenidoDestino) {
        return res.status(400).json({ message: "El contenido destino especificado no existe" });
      }
    }

    // Validar que no sea la misma relación (origen === destino)
    if (contenido_origen_id && contenido_destino_id && contenido_origen_id === contenido_destino_id) {
      return res.status(400).json({ message: "El contenido origen no puede ser el mismo que el destino" });
    }

    // 🚫 Validación 1: evitar relación inversa
    if (contenido_origen_id && contenido_destino_id) {
      const existeInversa = await SecuenciaContenido.findOne({
        where: {
          contenido_origen_id: contenido_destino_id,
          contenido_destino_id: contenido_origen_id,
          id: { [Op.ne]: secuencia.id } // Excluir la secuencia actual
        }
      });

      if (existeInversa) {
        return res.status(400).json({ message: "No se puede crear una relación inversa entre contenidos" });
      }
    }

    // ✅ VALIDACIÓN 2 ELIMINADA para permitir reorganización de secuencias
    // Ahora un contenido puede ser origen en múltiples secuencias
    // Esto permite actualizar secuencias sin restricciones de cascada

    // ✅ Actualizar la secuencia
    await secuencia.update({
      contenido_origen_id: contenido_origen_id || secuencia.contenido_origen_id,
      contenido_destino_id: contenido_destino_id || secuencia.contenido_destino_id,
      descripcion: descripcion !== undefined ? descripcion : secuencia.descripcion,
      estado: estado !== undefined ? estado : secuencia.estado
    });

    res.json(secuencia);
  } catch (error) {
    console.error("Error al actualizar secuencia:", error);
    res.status(500).json({ message: "Error al actualizar la secuencia de contenido", error });
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

    // Validar que todos los contenidos existan
    const contenidosValidos = await Contenido.findAll({
      where: { id: contenidos }
    });

    if (contenidosValidos.length !== contenidos.length) {
      return res.status(400).json({ 
        message: "Uno o más contenidos especificados no existen" 
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

    // ✅ Eliminar la secuencia solicitada
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
