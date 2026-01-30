const { RespuestaEstudianteMiniproyecto, Estudiante, Miniproyecto } = require("../models");

const normalizeText = (text = '') => text
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const buildCriteriaFromExpected = (expected = '') => {
  const raw = expected.toString();
  const parts = raw
    .split(/\n|•|\-|\d+\.|\r/g)
    .map(p => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts;

  return raw
    .split(/[.!?]/)
    .map(p => p.trim())
    .filter(Boolean);
};

const extractKeywords = (criteriaText = '') => {
  return normalizeText(criteriaText)
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length >= 4);
};

const tryParseJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const evaluateResponse = (studentResponseValue = '', expectedResponseValue = '') => {
  if (!expectedResponseValue) return null;

  const expectedParsed = tryParseJson(expectedResponseValue);
  const studentParsed = typeof studentResponseValue === 'string'
    ? tryParseJson(studentResponseValue)
    : studentResponseValue;

  const hasStructuredExpected = expectedParsed && typeof expectedParsed === 'object' && (
    expectedParsed.stakeholders || expectedParsed.requisitosFuncionales || expectedParsed.requisitosNoFuncionales ||
    expectedParsed.alcance || expectedParsed.cronograma || expectedParsed.costos
  );

  if (hasStructuredExpected) {
    const sections = [
      {
        label: 'Stakeholders',
        expected: expectedParsed.stakeholders,
        student: studentParsed?.stakeholders
      },
      {
        label: 'Requisitos funcionales',
        expected: expectedParsed.requisitosFuncionales,
        student: studentParsed?.requisitosFuncionales
      },
      {
        label: 'Requisitos no funcionales',
        expected: expectedParsed.requisitosNoFuncionales,
        student: studentParsed?.requisitosNoFuncionales
      },
      {
        label: 'Alcance del proyecto',
        expected: expectedParsed.alcance,
        student: studentParsed?.alcance
      },
      {
        label: 'Cronograma del proyecto',
        expected: expectedParsed.cronograma,
        student: studentParsed?.cronograma
      },
      {
        label: 'Costos y recursos',
        expected: expectedParsed.costos,
        student: studentParsed?.costos
      }
    ].filter(section => section.expected);

    if (sections.length === 0) return null;

    const results = sections.map((section) => {
      const keywords = extractKeywords(section.expected);
      const normalizedStudent = normalizeText(section.student || '');
      const matches = keywords.filter(keyword => normalizedStudent.includes(keyword)).length;
      const minRequired = Math.min(3, keywords.length || 0);
      const ratioRequired = Math.ceil((keywords.length || 0) * 0.5);
      const matched = matches >= minRequired && matches >= ratioRequired && minRequired > 0;
      return { criterio: section.label, cumplido: matched };
    });

    const cumplidos = results.filter(r => r.cumplido).length;
    const puntaje = Math.round((cumplidos / results.length) * 100);

    return {
      puntaje,
      totalCriterios: results.length,
      criteriosCumplidos: cumplidos,
      criterios: results
    };
  }

  const expectedText = expectedParsed?.toString?.() ?? expectedResponseValue?.toString?.() ?? '';
  const criteria = buildCriteriaFromExpected(expectedText);
  if (criteria.length === 0) return null;

  const normalizedStudent = normalizeText(studentParsed || '');
  const results = criteria.map((criterion) => {
    const keywords = extractKeywords(criterion);
    const matches = keywords.filter(keyword => normalizedStudent.includes(keyword)).length;
    const minRequired = Math.min(3, keywords.length || 0);
    const ratioRequired = Math.ceil((keywords.length || 0) * 0.5);
    const matched = matches >= minRequired && matches >= ratioRequired && minRequired > 0;
    return { criterio: criterion, cumplido: matched };
  });

  const cumplidos = results.filter(r => r.cumplido).length;
  const puntaje = Math.round((cumplidos / results.length) * 100);

  return {
    puntaje,
    totalCriterios: results.length,
    criteriosCumplidos: cumplidos,
    criterios: results
  };
};

/* =========================
   CREAR RESPUESTA
========================= */
const crearRespuestaMiniproyecto = async (req, res) => {
  try {
    const { respuesta, estudiante_id, miniproyecto_id, estado } = req.body;

    // Validar existencia de Estudiante
    const estudiante = await Estudiante.findByPk(estudiante_id);
    if (!estudiante) {
      return res.status(400).json({
        mensaje: `No existe un estudiante con id ${estudiante_id}`,
      });
    }

    // Validar existencia de Miniproyecto
    const miniproyecto = await Miniproyecto.findByPk(miniproyecto_id);
    if (!miniproyecto) {
      return res.status(400).json({
        mensaje: `No existe un miniproyecto con id ${miniproyecto_id}`,
      });
    }

    const respuestaExistente = await RespuestaEstudianteMiniproyecto.findOne({
      where: {
        estudiante_id,
        miniproyecto_id,
      }
    });

    let studentResponseText = '';
    let studentResponseValue = '';
    try {
      const parsed = typeof respuesta === 'string' ? JSON.parse(respuesta) : respuesta;
      studentResponseValue = parsed?.respuestaEstudiante || '';
    } catch (e) {
      studentResponseValue = typeof respuesta === 'string' ? respuesta : '';
    }

    if (studentResponseValue && typeof studentResponseValue === 'object') {
      studentResponseText = [
        studentResponseValue.stakeholders,
        studentResponseValue.requisitosFuncionales,
        studentResponseValue.requisitosNoFuncionales
      ]
        .filter(Boolean)
        .join(' ');
    } else {
      studentResponseText = studentResponseValue || '';
    }

    const evaluacion = evaluateResponse(studentResponseValue, miniproyecto.respuesta_miniproyecto);
    const respuestaPayload = JSON.stringify({
      respuestaEstudiante: studentResponseText,
      evaluacion
    });

    if (respuestaExistente) {
      await respuestaExistente.update({ respuesta: respuestaPayload, estado });
      return res.status(200).json(respuestaExistente);
    }

    const nuevaRespuesta = await RespuestaEstudianteMiniproyecto.create({
      respuesta: respuestaPayload,
      estudiante_id,
      miniproyecto_id,
      estado,
    });

    res.status(201).json(nuevaRespuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER TODAS
========================= */
const obtenerRespuestasMiniproyecto = async (req, res) => {
  try {
    const respuestas = await RespuestaEstudianteMiniproyecto.findAll({
      include: [
        { model: Estudiante, as: "estudiante" },
        { model: Miniproyecto, as: "miniproyecto" },
      ],
    });
    res.json(respuestas);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener respuestas del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerRespuestaMiniproyectoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteMiniproyecto.findByPk(id, {
      include: [
        { model: Estudiante, as: "estudiante" },
        { model: Miniproyecto, as: "miniproyecto" },
      ],
    });

    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de miniproyecto no encontrada",
      });
    }

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarRespuestaMiniproyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const { estudiante_id, miniproyecto_id, respuesta: respuestaBody } = req.body;

    const respuestaRegistro = await RespuestaEstudianteMiniproyecto.findByPk(id);
    if (!respuestaRegistro) {
      return res.status(404).json({
        mensaje: "Respuesta de miniproyecto no encontrada",
      });
    }

    // Validar llaves foráneas si vienen en el body
    if (estudiante_id) {
      const estudiante = await Estudiante.findByPk(estudiante_id);
      if (!estudiante) {
        return res.status(400).json({
          mensaje: `No existe un estudiante con id ${estudiante_id}`,
        });
      }
    }

    if (miniproyecto_id) {
      const miniproyecto = await Miniproyecto.findByPk(miniproyecto_id);
      if (!miniproyecto) {
        return res.status(400).json({
          mensaje: `No existe un miniproyecto con id ${miniproyecto_id}`,
        });
      }
    }

    let respuestaPayload = respuestaBody;
    if (respuestaBody !== undefined) {
      let studentResponseText = '';
      let studentResponseValue = '';
      try {
        const parsed = typeof respuestaBody === 'string' ? JSON.parse(respuestaBody) : respuestaBody;
        studentResponseValue = parsed?.respuestaEstudiante || '';
      } catch (e) {
        studentResponseValue = typeof respuestaBody === 'string' ? respuestaBody : '';
      }

      if (studentResponseValue && typeof studentResponseValue === 'object') {
        studentResponseText = [
          studentResponseValue.stakeholders,
          studentResponseValue.requisitosFuncionales,
          studentResponseValue.requisitosNoFuncionales
        ]
          .filter(Boolean)
          .join(' ');
      } else {
        studentResponseText = studentResponseValue || '';
      }

      const targetMiniproyectoId = miniproyecto_id || respuestaRegistro.miniproyecto_id;
      const miniproyecto = targetMiniproyectoId
        ? await Miniproyecto.findByPk(targetMiniproyectoId)
        : null;
      const evaluacion = evaluateResponse(studentResponseValue, miniproyecto?.respuesta_miniproyecto);
      respuestaPayload = JSON.stringify({
        respuestaEstudiante: studentResponseText,
        evaluacion
      });
    }

    await respuestaRegistro.update({
      ...req.body,
      ...(respuestaBody !== undefined && { respuesta: respuestaPayload })
    });

    res.json({
      mensaje: "Respuesta actualizada correctamente",
      respuesta: respuestaRegistro,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarRespuestaMiniproyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const respuesta = await RespuestaEstudianteMiniproyecto.findByPk(id);
    if (!respuesta) {
      return res.status(404).json({
        mensaje: "Respuesta de miniproyecto no encontrada",
      });
    }

    await respuesta.destroy();

    res.json({
      mensaje: "Respuesta de miniproyecto eliminada correctamente",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al eliminar la respuesta del miniproyecto",
      error: error.message,
    });
  }
};

/* =========================
   VERIFICAR MINIPROYECTO COMPLETADO
========================= */
const verificarMiniproyectoCompletado = async (req, res) => {
  try {
    const { miniproyecto_id, estudiante_id } = req.query;

    if (!miniproyecto_id || !estudiante_id) {
      return res.status(400).json({
        message: "miniproyecto_id y estudiante_id son requeridos como parámetros de query"
      });
    }

    // Convertir a números
    const mId = parseInt(miniproyecto_id, 10);
    const esId = parseInt(estudiante_id, 10);

    // Validar que sean números válidos
    if (isNaN(mId) || isNaN(esId)) {
      return res.status(400).json({
        message: "miniproyecto_id y estudiante_id deben ser números válidos"
      });
    }

    // Buscar respuesta completada para este estudiante y miniproyecto
    const respuesta = await RespuestaEstudianteMiniproyecto.findOne({
      where: {
        estudiante_id: esId,
        miniproyecto_id: mId,
        estado: 'Completado'
      }
    });

    if (respuesta) {
      return res.json({
        completado: true,
        miniproyecto_id: mId,
        estudiante_id: esId,
        estado: 'Completado',
        fecha_respuesta: respuesta.createdAt,
        mensaje: "El miniproyecto ha sido completado"
      });
    }

    // Si no está completado, retornar que no está completado
    res.json({
      completado: false,
      miniproyecto_id: mId,
      estudiante_id: esId,
      estado: 'No completado',
      mensaje: "El miniproyecto no ha sido completado"
    });

  } catch (error) {
    console.error('Error en verificarMiniproyectoCompletado:', error);
    res.status(500).json({
      message: "Error al verificar estado del miniproyecto",
      error: error.message || error
    });
  }
};


Estudiante.hasMany(RespuestaEstudianteMiniproyecto, {
  foreignKey: "estudiante_id",
  as: "respuestasMiniproyecto",
});

RespuestaEstudianteMiniproyecto.belongsTo(Estudiante, {
  foreignKey: "estudiante_id",
  as: "estudiante",
});

Miniproyecto.hasMany(RespuestaEstudianteMiniproyecto, {
  foreignKey: "miniproyecto_id",
  as: "respuestasEstudiante",
});

RespuestaEstudianteMiniproyecto.belongsTo(Miniproyecto, {
  foreignKey: "miniproyecto_id",
  as: "miniproyecto",
});


module.exports = {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
  verificarMiniproyectoCompletado
};
