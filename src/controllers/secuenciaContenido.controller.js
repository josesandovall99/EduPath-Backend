const { SecuenciaContenido, Contenido } = require('../models');

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

    // 🚫 Validación 2 (opcional): evitar que un contenido ya sea origen en otra secuencia
    const yaUsadoComoOrigen = await SecuenciaContenido.findOne({
      where: { contenido_origen_id }
    });

    if (yaUsadoComoOrigen) {
      return res.status(400).json({ message: "Este contenido ya está asignado como origen en otra secuencia" });
    }

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

    // 🚫 Validación 1: evitar relación inversa
    if (contenido_origen_id && contenido_destino_id) {
      const existeInversa = await SecuenciaContenido.findOne({
        where: {
          contenido_origen_id: contenido_destino_id,
          contenido_destino_id: contenido_origen_id
        }
      });

      if (existeInversa) {
        return res.status(400).json({ message: "No se puede crear una relación inversa entre contenidos" });
      }
    }

    // 🚫 Validación 2 (opcional): evitar que un contenido ya sea origen en otra secuencia
    if (contenido_origen_id) {
      const yaUsadoComoOrigen = await SecuenciaContenido.findOne({
        where: { contenido_origen_id }
      });

      if (yaUsadoComoOrigen && yaUsadoComoOrigen.id !== secuencia.id) {
        return res.status(400).json({ message: "Este contenido ya está asignado como origen en otra secuencia" });
      }
    }

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

