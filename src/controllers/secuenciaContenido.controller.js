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

    // Crear la secuencia de contenido
    const nuevaSecuencia = await SecuenciaContenido.create({
      contenido_origen_id,
      contenido_destino_id,
      descripcion,
      estado: estado !== undefined ? estado : true
    });

    res.status(201).json(nuevaSecuencia);
  } catch (error) {
    res.status(500).json({ message: "Error al crear la secuencia de contenido", error });
  }
};

// Listar todas las secuencias de contenido
exports.getSecuenciasContenido = async (req, res) => {
  try {
    const secuencias = await SecuenciaContenido.findAll({
      include: [
        { 
          association: 'origen',
          model: Contenido,
          attributes: ['id', 'titulo', 'descripcion']
        },
        { 
          association: 'destino',
          model: Contenido,
          attributes: ['id', 'titulo', 'descripcion']
        }
      ]
    });
    res.json(secuencias);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las secuencias de contenido", error });
  }
};

// Obtener una secuencia de contenido por ID
exports.getSecuenciaContenidoById = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id, {
      include: [
        { 
          association: 'origen',
          model: Contenido,
          attributes: ['id', 'titulo', 'descripcion']
        },
        { 
          association: 'destino',
          model: Contenido,
          attributes: ['id', 'titulo', 'descripcion']
        }
      ]
    });

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    res.json(secuencia);
  } catch (error) {
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

    // Si se envía contenido_origen_id o contenido_destino_id, validar que existan
    if (req.body.contenido_origen_id) {
      const contenidoOrigen = await Contenido.findByPk(req.body.contenido_origen_id);
      if (!contenidoOrigen) {
        return res.status(400).json({ message: "El contenido origen especificado no existe" });
      }
    }

    if (req.body.contenido_destino_id) {
      const contenidoDestino = await Contenido.findByPk(req.body.contenido_destino_id);
      if (!contenidoDestino) {
        return res.status(400).json({ message: "El contenido destino especificado no existe" });
      }
    }

    await secuencia.update(req.body);
    res.json(secuencia);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la secuencia de contenido", error });
  }
};

// Eliminar una secuencia de contenido
exports.deleteSecuenciaContenido = async (req, res) => {
  try {
    const secuencia = await SecuenciaContenido.findByPk(req.params.id);

    if (!secuencia) {
      return res.status(404).json({ message: "Secuencia de contenido no encontrada" });
    }

    await secuencia.destroy();
    res.json({ message: "Secuencia de contenido eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la secuencia de contenido", error });
  }
};
