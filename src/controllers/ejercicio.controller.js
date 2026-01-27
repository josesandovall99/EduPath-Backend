const { sequelize, Ejercicio, Actividad, Contenido } = require('../models');

// Crear ejercicio con su actividad base (herencia con transacción)
exports.createEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { actividad, ejercicio } = req.body;

    // Validar contenido
    const contenidoExistente = await Contenido.findByPk(ejercicio.contenido_id);
    if (!contenidoExistente) {
      await t.rollback();
      return res.status(400).json({ message: "El contenido especificado no existe" });
    }

    // Crear la actividad primero
    const nuevaActividad = await Actividad.create(actividad, { transaction: t });

    // Crear el ejercicio usando el mismo id de la actividad
    const nuevoEjercicio = await Ejercicio.create(
      {
        id: nuevaActividad.id, // herencia: mismo PK que Actividad
        contenido_id: ejercicio.contenido_id,
        puntos: ejercicio.puntos,
        resultado_ejercicio: ejercicio.resultado_ejercicio
      },
      { transaction: t }
    );

    // Confirmar transacción
    await t.commit();

    res.status(201).json({
      actividad: nuevaActividad,
      ejercicio: nuevoEjercicio
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al crear el ejercicio", error: error.message || error });
  }
};

// Listar ejercicios con su actividad y contenido
exports.getEjercicios = async (req, res) => {
  try {
    const ejercicios = await Ejercicio.findAll({
      include: [
        { model: Actividad, as: 'actividad' },
        { model: Contenido }
      ]
    });
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los ejercicios", error: error.message || error });
  }
};

// Obtener un ejercicio por ID
exports.getEjercicioById = async (req, res) => {
  try {
    const ejercicio = await Ejercicio.findByPk(req.params.id, {
      include: [
        { model: Actividad, as: 'actividad' },
        { model: Contenido }
      ]
    });
    if (!ejercicio) return res.status(404).json({ message: "Ejercicio no encontrado" });
    res.json(ejercicio);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el ejercicio", error: error.message || error });
  }
};

// Actualizar ejercicio y su actividad (transacción)
exports.updateEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ejercicio = await Ejercicio.findByPk(req.params.id);
    if (!ejercicio) {
      await t.rollback();
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    const actividad = await Actividad.findByPk(req.params.id);
    if (!actividad) {
      await t.rollback();
      return res.status(404).json({ message: "Actividad asociada no encontrada" });
    }

    // Validar contenido si se envía
    if (req.body.ejercicio?.contenido_id) {
      const contenidoExistente = await Contenido.findByPk(req.body.ejercicio.contenido_id);
      if (!contenidoExistente) {
        await t.rollback();
        return res.status(400).json({ message: "El contenido especificado no existe" });
      }
    }

    // Actualizar actividad y ejercicio en conjunto
    if (req.body.actividad) {
      await actividad.update(req.body.actividad, { transaction: t });
    }
    if (req.body.ejercicio) {
      await ejercicio.update(req.body.ejercicio, { transaction: t });
    }

    await t.commit();
    res.json({ actividad, ejercicio });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al actualizar el ejercicio", error: error.message || error });
  }
};

// Eliminar ejercicio y su actividad (transacción)
exports.deleteEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ejercicio = await Ejercicio.findByPk(req.params.id);
    if (!ejercicio) {
      await t.rollback();
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    const actividad = await Actividad.findByPk(req.params.id);

    // Eliminar ambos
    await ejercicio.destroy({ transaction: t });
    if (actividad) {
      await actividad.destroy({ transaction: t });
    }

    await t.commit();
    res.json({ message: "Ejercicio y actividad eliminados correctamente" });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Error al eliminar el ejercicio", error: error.message || error });
  }
};



// Resolver un ejercicio y verificar la respuesta
exports.resolverEjercicio = async (req, res) => {
  try {
    const { ejercicioId } = req.params;
    const { respuesta } = req.body;

    // Buscar el ejercicio
    const ejercicio = await Ejercicio.findByPk(ejercicioId);
    if (!ejercicio) {
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    // Función para normalizar texto
    const normalizarTexto = (texto) =>
      texto
        .toLowerCase()              // ignorar mayúsculas/minúsculas
        .trim()                     // quitar espacios al inicio y final
        .replace(/\s+/g, " ");      // convertir múltiples espacios en uno solo

    // Normalizar respuestas
    const respuestaEstudiante = normalizarTexto(respuesta);
    const respuestaCorrecta = normalizarTexto(ejercicio.resultado_ejercicio);

    // Comparar respuestas
    const esCorrecta = respuestaEstudiante === respuestaCorrecta;

    // Preparar retroalimentación
    const retroalimentacion = esCorrecta
      ? "¡Respuesta correcta! Bien hecho."
      : `Respuesta incorrecta. La respuesta correcta es: ${ejercicio.resultado_ejercicio}`;

    res.json({
      ejercicioId,
      esCorrecta,
      puntosObtenidos: esCorrecta ? ejercicio.puntos : 0,
      retroalimentacion
    });

  } catch (error) {
    res.status(500).json({
      message: "Error al resolver el ejercicio",
      error: error.message || error
    });
  }
};


// Obtener la retroalimentación de un ejercicio
exports.getRetroalimentacionEjercicio = async (req, res) => {
  try {
    const { ejercicioId } = req.params;

    const ejercicio = await Ejercicio.findByPk(ejercicioId);
    if (!ejercicio) {
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    res.json({
      ejercicioId,
      retroalimentacion: `La respuesta correcta es: ${ejercicio.resultado_ejercicio}`
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la retroalimentación del ejercicio",
      error: error.message || error
    });
  }
};

