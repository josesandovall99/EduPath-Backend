const db = require('../models');
const {
  Actividad,
  Miniproyecto,
  TipoActividad,
  Area,
  Evaluacion,
  Estudiante,
  RespuestaEstudianteMiniproyecto,
  Contenido,
  Tema,
  Ejercicio,
  Chatbot,
  sequelize
} = db;
const evaluacionController = require('./evaluacion.controller');
const { isNonEmptyString, sanitizePlainText, sanitizeRichText } = require('../utils/inputSecurity');
const { enrichMiniproyectoResponse } = require('../utils/miniproyectoRubric');
const { normalizarConfiguracionCompilador, validarConfiguracionCompilador } = require('../utils/compilerExercise');
const umlValidator = require('../services/umlValidator');

const CONFIGURABLE_EXERCISE_TYPES = new Set(['Compilador', 'Diagramas UML', 'Preguntas', 'Opción única', 'Ordenar', 'Relacionar']);
const configurableSubmissionLocks = new Map();

const canViewInactiveMiniproyectos = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);
const isMiniproyectoActivo = (registro) => {
  const actividad = registro?.Actividad || registro?.actividad;
  return actividad?.estado !== false;
};

const parseMiniproyectoPayload = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const createDefaultUmlOptions = () => ({
  minClasses: 2,
  requireRelationships: false,
  requireMultiplicities: false,
});

const normalizeUmlConfig = (configuracion = {}) => ({
  ...configuracion,
  opciones: {
    ...createDefaultUmlOptions(),
    ...(configuracion?.opciones || {}),
  },
});

const sanitizeEmbeddedQuestion = (question, index) => {
  const questionId = isNonEmptyString(question?.id)
    ? sanitizePlainText(question.id)
    : `pregunta_${index + 1}`;

  const questionType = String(question?.tipo || '').trim().toLowerCase() === 'abierta'
    ? 'abierta'
    : 'opcion-multiple';

  const options = Array.isArray(question?.opciones)
    ? question.opciones.map((option) => sanitizePlainText(option)).filter(Boolean)
    : [];

  const rawCorrectAnswer = question?.respuesta_correcta;
  const normalizedCorrectAnswer = questionType === 'abierta'
    ? sanitizePlainText(rawCorrectAnswer)
    : sanitizePlainText(rawCorrectAnswer);

  return {
    id: questionId,
    enunciado: sanitizePlainText(question?.enunciado),
    tipo: questionType,
    ...(questionType === 'opcion-multiple' ? { opciones: options } : {}),
    respuesta_correcta: normalizedCorrectAnswer,
  };
};

const normalizeEmbeddedConfig = (exercise) => {
  const tipo = exercise.tipo_ejercicio;
  const configuracion = exercise.configuracion || {};
  const resultado = exercise.resultado_ejercicio || '';

  if (tipo === 'Compilador') {
    if (configuracion?.tipo === 'mvc') {
      const casos_prueba = Array.isArray(configuracion.casos_prueba)
        ? configuracion.casos_prueba.map((c) => ({
            inputs: (c.inputs || '').toString().trim(),
            output: (c.output || '').toString().trim(),
          }))
        : [];
      return {
        configuracion: {
          ...configuracion,
          tipo: 'mvc',
          lenguajesPermitidos: [62],
          casos_prueba,
        },
        resultado_ejercicio: resultado || '',
        codigoEstructura: null,
      };
    }

    const normalizedCompilerConfig = normalizarConfiguracionCompilador({
      configuracion,
      codigoEstructura: exercise.codigoEstructura,
      resultadoEjercicio: resultado,
    });

    return {
      configuracion: normalizedCompilerConfig,
      resultado_ejercicio: normalizedCompilerConfig?.esperado || resultado,
      codigoEstructura: normalizedCompilerConfig?.metodo?.plantilla || exercise.codigoEstructura || null,
    };
  }

  if (tipo === 'Diagramas UML') {
    return {
      configuracion: normalizeUmlConfig(configuracion),
      resultado_ejercicio: resultado || 'Diagrama UML evaluable',
      codigoEstructura: null,
    };
  }

  if (tipo === 'Opción única') {
    const opciones = Array.isArray(configuracion.opciones)
      ? configuracion.opciones.map((option) => sanitizePlainText(option)).filter(Boolean)
      : [];
    const respuestaCorrecta = sanitizePlainText(configuracion.respuestaCorrecta);
    return {
      configuracion: {
        tipo: 'opcion-unica',
        enunciado: sanitizePlainText(configuracion.enunciado),
        opciones,
        respuestaCorrecta,
      },
      resultado_ejercicio: respuestaCorrecta,
      codigoEstructura: null,
    };
  }

  if (tipo === 'Ordenar') {
    return {
      configuracion: {
        tipo: 'ordenar',
        enunciado: sanitizePlainText(configuracion.enunciado),
        items: Array.isArray(configuracion.items)
          ? configuracion.items.map((item) => sanitizePlainText(item)).filter(Boolean)
          : [],
      },
      resultado_ejercicio: 'Orden correcto',
      codigoEstructura: null,
    };
  }

  if (tipo === 'Relacionar') {
    return {
      configuracion: {
        tipo: 'relacionar',
        enunciado: sanitizePlainText(configuracion.enunciado),
        pares: Array.isArray(configuracion.pares)
          ? configuracion.pares.map((pair) => ({
              concepto: sanitizePlainText(pair?.concepto),
              definicion: sanitizePlainText(pair?.definicion),
            })).filter((pair) => pair.concepto && pair.definicion)
          : [],
      },
      resultado_ejercicio: 'Relaciones correctas',
      codigoEstructura: null,
    };
  }

  const preguntas = Array.isArray(configuracion.preguntas)
    ? configuracion.preguntas.map((question, index) => sanitizeEmbeddedQuestion(question, index))
    : [];

  return {
    configuracion: {
      tipo: 'cuestionario',
      preguntas,
    },
    resultado_ejercicio: 'Cuestionario estructurado',
    codigoEstructura: null,
  };
};

const normalizeEmbeddedExercise = (exercise, index) => {
  const tipo = CONFIGURABLE_EXERCISE_TYPES.has(exercise?.tipo_ejercicio)
    ? exercise.tipo_ejercicio
    : null;

  if (!tipo) {
    throw new Error(`El ejercicio embebido ${index + 1} tiene un tipo no válido.`);
  }

  const normalizedConfig = normalizeEmbeddedConfig(exercise);

  return {
    id: isNonEmptyString(exercise?.id)
      ? sanitizePlainText(exercise.id)
      : `embedded_${index + 1}`,
    titulo: sanitizePlainText(exercise?.titulo || `Ejercicio ${index + 1}`),
    descripcion: sanitizeRichText(exercise?.descripcion || ''),
    tipo_ejercicio: tipo,
    puntos: Number.isFinite(Number(exercise?.puntos)) ? Math.max(1, Number(exercise.puntos)) : 100,
    resultado_ejercicio: normalizedConfig.resultado_ejercicio,
    codigoEstructura: normalizedConfig.codigoEstructura,
    configuracion: normalizedConfig.configuracion,
  };
};

const validateEmbeddedExercise = (exercise, index) => {
  if (!isNonEmptyString(exercise?.titulo)) {
    throw new Error(`El ejercicio ${index + 1} debe tener un título.`);
  }

  if (exercise.tipo_ejercicio === 'Compilador') {
    const cfg = exercise.configuracion || {};

    if (cfg.tipo === 'mvc') {
      return;
    }

    const codigoEstructura = exercise.codigoEstructura || null;
    const validation = validarConfiguracionCompilador({
      configuracion: exercise.configuracion,
      codigoEstructura,
    });

    if (!validation.ok) {
      throw new Error(`Configuración inválida en el ejercicio ${exercise.titulo}: ${validation.errores.join(', ')}`);
    }
    return;
  }

  if (exercise.tipo_ejercicio === 'Diagramas UML') {
    if (!exercise.configuracion?.opciones || typeof exercise.configuracion.opciones !== 'object') {
      throw new Error(`El ejercicio ${exercise.titulo} debe definir opciones de validación UML.`);
    }
    return;
  }

  if (exercise.tipo_ejercicio === 'Opción única') {
    if (!Array.isArray(exercise.configuracion?.opciones) || exercise.configuracion.opciones.length < 2) {
      throw new Error(`El ejercicio ${exercise.titulo} debe tener al menos dos opciones.`);
    }
    if (!isNonEmptyString(exercise.configuracion?.respuestaCorrecta)) {
      throw new Error(`El ejercicio ${exercise.titulo} debe indicar la respuesta correcta.`);
    }
    return;
  }

  if (exercise.tipo_ejercicio === 'Ordenar') {
    if (!Array.isArray(exercise.configuracion?.items) || exercise.configuracion.items.length < 2) {
      throw new Error(`El ejercicio ${exercise.titulo} debe tener al menos dos ítems para ordenar.`);
    }
    return;
  }

  if (exercise.tipo_ejercicio === 'Relacionar') {
    if (!Array.isArray(exercise.configuracion?.pares) || exercise.configuracion.pares.length < 2) {
      throw new Error(`El ejercicio ${exercise.titulo} debe tener al menos dos pares para relacionar.`);
    }
    return;
  }

  if (!Array.isArray(exercise.configuracion?.preguntas) || exercise.configuracion.preguntas.length === 0) {
    throw new Error(`El ejercicio ${exercise.titulo} debe tener al menos una pregunta.`);
  }
};

const parseConfigurableResponseProgress = (record) => {
  if (!record?.respuesta) {
    return { mode: 'configurable', exercises: {}, evaluation: {} };
  }

  try {
    const parsed = JSON.parse(record.respuesta);
    if (parsed && typeof parsed === 'object' && parsed.mode === 'configurable') {
      return {
        mode: 'configurable',
        exercises: parsed.exercises && typeof parsed.exercises === 'object' ? parsed.exercises : {},
        evaluation: parsed.evaluation && typeof parsed.evaluation === 'object' ? parsed.evaluation : {},
      };
    }
  } catch (error) {
    // Ignore malformed legacy payloads.
  }

  return { mode: 'configurable', exercises: {}, evaluation: {} };
};

const buildConfigurableProgressPayload = (progress, evaluation = {}) => JSON.stringify({
  mode: 'configurable',
  exercises: progress,
  evaluation,
});

const normalizeText = (value) => (value || '').toString().trim();

const summarizeConfigurableMiniproyecto = ({ embeddedExercises, progress, evaluation = {} }) => {
  const exerciseSummaries = embeddedExercises.map((exercise) => {
    const current = progress?.[exercise.id] || {};
    const intentos = Number(current.intentos || 0);
    const esCorrecta = Boolean(current.esCorrecta ?? current.aprobado);
    const puntosObtenidos = esCorrecta ? Number(current.puntosObtenidos || 0) : 0;

    return {
      id: exercise.id,
      titulo: exercise.titulo,
      tipo_ejercicio: exercise.tipo_ejercicio,
      respondido: intentos > 0,
      esCorrecta,
      aprobado: esCorrecta,
      intentos,
      puntosObtenidos,
      retroalimentacion: current.retroalimentacion || '',
    };
  });

  const totalEjercicios = exerciseSummaries.length;
  const ejerciciosRespondidos = exerciseSummaries.filter((item) => item.respondido).length;
  const ejerciciosCorrectos = exerciseSummaries.filter((item) => item.esCorrecta).length;
  const totalPuntos = embeddedExercises.reduce((sum, exercise) => sum + Number(exercise.puntos || 0), 0);
  const puntosObtenidos = exerciseSummaries.reduce((sum, item) => sum + Number(item.puntosObtenidos || 0), 0);
  const listoParaEvaluar = totalEjercicios > 0 && ejerciciosRespondidos === totalEjercicios;
  const aprobado = Boolean(evaluation?.aprobado);
  const calificacion = totalPuntos > 0
    ? Math.round((puntosObtenidos / totalPuntos) * 100)
    : (ejerciciosCorrectos === totalEjercicios && totalEjercicios > 0 ? 100 : 0);

  const retroalimentacionGeneral = aprobado
    ? 'El miniproyecto configurable aprobó todos sus ejercicios.'
    : !listoParaEvaluar
      ? `Faltan ${totalEjercicios - ejerciciosRespondidos} ejercicios por enviar antes de evaluar el miniproyecto.`
      : `El miniproyecto tiene ${ejerciciosCorrectos} de ${totalEjercicios} ejercicios correctos.`;

  return {
    ejercicios: exerciseSummaries,
    totalEjercicios,
    ejerciciosRespondidos,
    ejerciciosCorrectos,
    totalPuntos,
    puntosObtenidos,
    listoParaEvaluar,
    aprobado,
    calificacion,
    retroalimentacionGeneral,
    fechaEvaluacion: evaluation?.fechaEvaluacion || null,
  };
};

const evaluateEmbeddedExercise = async ({ exercise, reqBody }) => {
  if (exercise.tipo_ejercicio === 'Compilador') {
    const cfg = exercise.configuracion || {};

    // MVC path: merge 3 files and run with stdin per test case
    if (cfg.tipo === 'mvc') {
      const archivos = reqBody?.archivos;
      if (!archivos || !archivos.main || !archivos.modelo || !archivos.consolaIO) {
        return { status: 400, payload: { message: 'Se requieren los archivos main, modelo y consolaIO para este ejercicio.' } };
      }
      const { mergeMvcFiles } = require('../utils/javaMultiFileCompiler');
      const evaluadorCasos = require('../services/evaluadorCasosPrueba');
      const codigoFusionado = mergeMvcFiles(archivos.main, archivos.modelo, archivos.consolaIO);
      const casosPrueba = Array.isArray(cfg.casos_prueba) && cfg.casos_prueba.length > 0
        ? cfg.casos_prueba
        : [{ inputs: '', output: (cfg.esperado || exercise.resultado_ejercicio || '').trim() }];

      const resultadoEvaluacion = await evaluadorCasos.evaluarCasosPruebaMvc(codigoFusionado, casosPrueba);
      const esCorrecta = resultadoEvaluacion.aprobado;

      return {
        status: esCorrecta ? 200 : 400,
        payload: {
          ejercicioId: exercise.id,
          esCorrecta,
          puntosObtenidos: esCorrecta ? exercise.puntos : 0,
          retroalimentacion: resultadoEvaluacion.resumen,
          casos: resultadoEvaluacion.resultados || [],
          stdout: resultadoEvaluacion.resultados?.[0]?.outputObtenido || '',
          stderr: resultadoEvaluacion.resultados?.find((r) => r.error)?.error || '',
        }
      };
    }

    // Legacy path: single-file method + test cases
    const codigo = reqBody?.codigo || reqBody?.respuesta?.codigo || reqBody?.respuesta?.texto || '';
    const lenguaje_id = reqBody?.lenguaje_id || reqBody?.respuesta?.lenguaje_id || 62;

    if (!codigo || !lenguaje_id) {
      return { status: 400, payload: { message: 'Faltan campos: lenguaje_id, codigo' } };
    }

    const evaluacion = await evaluacionController.evaluateCompilerSubmission({
      codigo,
      lenguaje_id,
      configuracion: exercise.configuracion,
      esperado: exercise.configuracion?.esperado || exercise.resultado_ejercicio || '',
    });

    if (!evaluacion || evaluacion.status >= 500) {
      return { status: 500, payload: { message: evaluacion?.message || 'Error ejecutando el ejercicio embebido' } };
    }

    const passedCases = Array.isArray(evaluacion?.data?.casosPrueba)
      ? evaluacion.data.casosPrueba.filter((item) => item?.paso).length
      : 0;
    const totalCases = Array.isArray(evaluacion?.data?.casosPrueba) ? evaluacion.data.casosPrueba.length : 0;
    const esCorrecta = totalCases > 0 && passedCases === totalCases;

    return {
      status: esCorrecta ? 200 : 400,
      payload: {
        ejercicioId: exercise.id,
        esCorrecta,
        puntosObtenidos: esCorrecta ? exercise.puntos : 0,
        retroalimentacion: evaluacion?.data?.resumen || (esCorrecta ? 'Todos los casos fueron correctos.' : 'Algunos casos de prueba fallaron.'),
        casos: evaluacion?.data?.casosPrueba || [],
        stdout: evaluacion?.data?.stdout || '',
        stderr: evaluacion?.data?.stderr || '',
      }
    };
  }

  if (exercise.tipo_ejercicio === 'Diagramas UML') {
    const diagramPayload = reqBody?.diagram || reqBody?.respuesta?.diagram || reqBody?.respuesta?.diagrama;
    if (!diagramPayload) {
      return { status: 400, payload: { message: 'El campo diagram es requerido para este ejercicio.' } };
    }

    const result = umlValidator.validate(diagramPayload, normalizeUmlConfig(exercise.configuracion).opciones);
    const esCorrecta = Boolean(result.success);

    return {
      status: esCorrecta ? 200 : 400,
      payload: {
        ejercicioId: exercise.id,
        esCorrecta,
        puntosObtenidos: esCorrecta ? exercise.puntos : 0,
        detalle: { errors: result.errors, warnings: result.warnings },
        retroalimentacion: esCorrecta ? 'Diagrama válido.' : 'El diagrama no cumple todas las reglas configuradas.',
      }
    };
  }

  if (exercise.tipo_ejercicio === 'Opción única') {
    const recibido = normalizeText(reqBody?.respuesta?.opcion ?? reqBody?.respuesta ?? '');
    const esperado = normalizeText(exercise.configuracion?.respuestaCorrecta);
    const esCorrecta = recibido === esperado;
    return {
      status: esCorrecta ? 200 : 400,
      payload: {
        ejercicioId: exercise.id,
        esCorrecta,
        puntosObtenidos: esCorrecta ? exercise.puntos : 0,
        retroalimentacion: esCorrecta ? '¡Correcto!' : 'Respuesta incorrecta.',
      }
    };
  }

  if (exercise.tipo_ejercicio === 'Ordenar') {
    const orden = reqBody?.respuesta?.orden || [];
    const normArr = (arr) => (arr || []).map((item) => normalizeText(item));
    const esCorrecta = JSON.stringify(normArr(orden)) === JSON.stringify(normArr(exercise.configuracion?.items || []));
    return {
      status: esCorrecta ? 200 : 400,
      payload: {
        ejercicioId: exercise.id,
        esCorrecta,
        puntosObtenidos: esCorrecta ? exercise.puntos : 0,
        retroalimentacion: esCorrecta ? 'Orden correcto.' : 'El orden no es correcto.',
      }
    };
  }

  if (exercise.tipo_ejercicio === 'Relacionar') {
    const conceptos = (exercise.configuracion?.pares || []).map((pair) => pair.concepto);
    const definiciones = (exercise.configuracion?.pares || []).map((pair) => pair.definicion);
    let ok = true;
    const parejas = reqBody?.respuesta?.parejas;
    const matches = reqBody?.respuesta?.matches;

    if (Array.isArray(parejas)) {
      for (const pair of parejas) {
        if (pair.conceptoIndex !== pair.definicionIndex) {
          ok = false;
          break;
        }
      }
    } else if (matches && typeof matches === 'object') {
      for (const [concepto, definicion] of Object.entries(matches)) {
        const index = conceptos.findIndex((item) => item === concepto);
        if (index < 0 || definiciones[index] !== definicion) {
          ok = false;
          break;
        }
      }
    } else {
      ok = false;
    }

    return {
      status: ok ? 200 : 400,
      payload: {
        ejercicioId: exercise.id,
        esCorrecta: ok,
        puntosObtenidos: ok ? exercise.puntos : 0,
        retroalimentacion: ok ? 'Relaciones correctas.' : 'Relaciones incorrectas.',
      }
    };
  }

  const respuestas = reqBody?.respuestas || reqBody?.respuesta?.respuestas || {};
  const questions = exercise.configuracion?.preguntas || [];
  let correctas = 0;
  const detalle = [];

  questions.forEach((question) => {
    const recibido = respuestas[question.id];
    let ok = false;

    if (question.tipo === 'abierta') {
      ok = normalizeText(recibido).toLowerCase() === normalizeText(question.respuesta_correcta).toLowerCase();
    } else {
      ok = normalizeText(recibido) === normalizeText(question.respuesta_correcta);
    }

    if (ok) correctas += 1;
    detalle.push({ preguntaId: question.id, correcta: ok, recibido });
  });

  const total = questions.length;
  const esCorrecta = total > 0 && correctas === total;
  return {
    status: esCorrecta ? 200 : 400,
    payload: {
      ejercicioId: exercise.id,
      esCorrecta,
      puntosObtenidos: esCorrecta ? exercise.puntos : 0,
      detalle,
      retroalimentacion: esCorrecta
        ? '¡Excelente! Todas las respuestas son correctas.'
        : `Correctas ${correctas}/${total}. Revise las respuestas.`,
    }
  };
};

const upsertConfigurableExerciseProgress = async ({ estudianteId, miniproyecto, exercise, evaluationResult }) => {
  const record = await RespuestaEstudianteMiniproyecto.findOne({
    where: {
      estudiante_id: estudianteId,
      miniproyecto_id: miniproyecto.id,
    }
  });

  const existingProgress = parseConfigurableResponseProgress(record);
  const currentExerciseProgress = existingProgress.exercises?.[exercise.id] || { intentos: 0 };
  const existingEvaluation = await Evaluacion.findOne({
    where: { estudiante_id: estudianteId, miniproyecto_id: miniproyecto.id }
  });

  if (String(existingEvaluation?.estado || '').toUpperCase() === 'APROBADO') {
    return { conflict: true, progress: existingProgress.exercises, summary: existingProgress.evaluation || {} };
  }

  const nextProgress = {
    ...existingProgress.exercises,
    [exercise.id]: {
      id: exercise.id,
      titulo: exercise.titulo,
      tipo_ejercicio: exercise.tipo_ejercicio,
      aprobado: Boolean(evaluationResult.payload?.esCorrecta),
      esCorrecta: Boolean(evaluationResult.payload?.esCorrecta),
      intentos: Number(currentExerciseProgress.intentos || 0) + 1,
      puntosObtenidos: Number(evaluationResult.payload?.puntosObtenidos || 0),
      retroalimentacion: evaluationResult.payload?.retroalimentacion || '',
      updatedAt: new Date().toISOString(),
    }
  };

  const configurablePayload = normalizeConfigurableMiniproyectoPayload(miniproyecto.respuesta_miniproyecto);
  const embeddedExercises = Array.isArray(configurablePayload?.exercises) ? configurablePayload.exercises : [];
  const summary = summarizeConfigurableMiniproyecto({
    embeddedExercises,
    progress: nextProgress,
    evaluation: existingProgress.evaluation,
  });

  if (record) {
    await record.update({
      respuesta: buildConfigurableProgressPayload(nextProgress, existingProgress.evaluation),
      estado: 'EN_PROGRESO',
      contador: Number(record.contador || 0) + 1,
    });
  } else {
    await RespuestaEstudianteMiniproyecto.create({
      respuesta: buildConfigurableProgressPayload(nextProgress, existingProgress.evaluation),
      estudiante_id: estudianteId,
      miniproyecto_id: miniproyecto.id,
      estado: 'EN_PROGRESO',
      contador: 1,
    });
  }

  return { conflict: false, progress: nextProgress, completed: false, summary };
};

const normalizeConfigurableMiniproyectoPayload = (value) => {
  const parsed = parseMiniproyectoPayload(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const tipo = String(parsed.tipo || '').trim().toLowerCase();
  if (tipo !== 'configurable') return null;

  const rawExerciseIds = Array.isArray(parsed.exerciseIds)
    ? parsed.exerciseIds
    : Array.isArray(parsed.ejercicios)
      ? parsed.ejercicios
      : [];

  const exerciseIds = Array.from(new Set(
    rawExerciseIds
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  ));

  const exercises = Array.isArray(parsed.exercises)
    ? parsed.exercises.map((exercise, index) => normalizeEmbeddedExercise(exercise, index))
    : [];

  const chatbotEnabled = Boolean(parsed.chatbot?.enabled);
  const chatbotId = Number(parsed.chatbot?.chatbotId);

  return {
    ...parsed,
    tipo: 'configurable',
    modo: 'ejercicios',
    exercises,
    exerciseIds,
    chatbot: {
      enabled: chatbotEnabled,
      chatbotId: chatbotEnabled && Number.isInteger(chatbotId) && chatbotId > 0 ? chatbotId : null,
    },
  };
};

const validateConfigurableExercises = async (_areaId, exerciseIds) => {
  if (Array.isArray(exerciseIds?.exercises)) {
    if (exerciseIds.exercises.length === 0) {
      throw new Error('Debes crear al menos un ejercicio para el miniproyecto configurable.');
    }

    const ids = new Set();
    exerciseIds.exercises.forEach((exercise, index) => {
      if (ids.has(exercise.id)) {
        throw new Error('Cada ejercicio embebido debe tener un identificador único.');
      }
      ids.add(exercise.id);
      validateEmbeddedExercise(exercise, index);
    });

    return exerciseIds.exercises;
  }

  if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
    throw new Error('Debes seleccionar al menos un ejercicio para el miniproyecto configurable.');
  }

  const ejercicios = await Ejercicio.findAll({
    where: { id: exerciseIds },
    include: [
      { model: Actividad, as: 'actividad' },
      {
        model: Contenido,
        as: 'contenido',
        include: [{ model: Tema, attributes: ['area_id', 'estado'] }],
      },
    ],
  });

  if (ejercicios.length !== exerciseIds.length) {
    throw new Error('Uno o más ejercicios seleccionados no existen.');
  }

  ejercicios.forEach((ejercicio) => {
    if (ejercicio?.actividad?.estado === false || ejercicio?.contenido?.estado === false || ejercicio?.contenido?.Tema?.estado === false) {
      throw new Error('No puedes usar ejercicios inactivos dentro del miniproyecto configurable.');
    }
  });

  return ejercicios;
};

const validateSelectedChatbot = async (areaId, chatbotId, currentMiniproyectoId = null) => {
  if (!Number.isInteger(Number(chatbotId)) || Number(chatbotId) <= 0) {
    return null;
  }

  const chatbot = await Chatbot.findByPk(chatbotId);
  if (!chatbot) {
    throw new Error('El chatbot seleccionado no existe.');
  }

  if (chatbot.estado === false) {
    throw new Error('El chatbot seleccionado está inactivo.');
  }

  if (Number(chatbot.area_id) !== Number(areaId)) {
    throw new Error('El chatbot seleccionado no pertenece al área del miniproyecto.');
  }

  if (chatbot.miniproyecto_id && Number(chatbot.miniproyecto_id) !== Number(currentMiniproyectoId)) {
    throw new Error('El chatbot seleccionado ya está asignado a otro miniproyecto.');
  }

  return chatbot;
};

const syncSelectedChatbot = async ({ areaId, miniproyectoId, chatbotId, transaction }) => {
  const currentChatbots = await Chatbot.findAll({
    where: { miniproyecto_id: miniproyectoId },
    transaction,
  });

  for (const chatbot of currentChatbots) {
    if (Number(chatbot.id) === Number(chatbotId)) continue;
    await chatbot.update({
      tipo: 'GENERAL',
      area_id: areaId,
      miniproyecto_id: null,
    }, { transaction });
  }

  if (!Number.isInteger(Number(chatbotId)) || Number(chatbotId) <= 0) {
    return;
  }

  const selectedChatbot = await Chatbot.findByPk(chatbotId, { transaction });
  if (!selectedChatbot) {
    throw new Error('No fue posible enlazar el chatbot seleccionado.');
  }

  await selectedChatbot.update({
    tipo: 'MINIPROYECTO',
    area_id: areaId,
    miniproyecto_id: miniproyectoId,
  }, { transaction });
};

const loadProgrammingMiniproyectoConfig = (miniproyecto) => {
  let esperado = miniproyecto?.respuesta_miniproyecto || '';
  let configuracion = {};

  if (miniproyecto?.respuesta_miniproyecto) {
    try {
      const parsed = JSON.parse(miniproyecto.respuesta_miniproyecto);
      if (parsed && typeof parsed === 'object') {
        if (parsed.tipo === 'programacion' || parsed.esperado || parsed.lenguajesPermitidos || parsed.sintaxis || parsed.casos_prueba || parsed.metodo) {
          configuracion = normalizarConfiguracionCompilador({
            configuracion: parsed,
            codigoEstructura: parsed?.metodo?.plantilla || parsed?.plantillaMetodo,
            resultadoEjercicio: parsed?.esperado || esperado
          });
          esperado = configuracion.esperado || esperado;
        }
      }
    } catch (err) {
      // Si no es JSON, se deja como texto esperado.
    }
  }

  return { esperado, configuracion };
};

const isProgrammingMiniproyecto = (miniproyecto) => {
  const { configuracion } = loadProgrammingMiniproyectoConfig(miniproyecto);

  return Boolean(
    configuracion?.tipo === 'programacion' ||
    configuracion?.metodo?.plantilla ||
    (Array.isArray(configuracion?.casos_prueba) && configuracion.casos_prueba.length > 0) ||
    (Array.isArray(configuracion?.lenguajesPermitidos) && configuracion.lenguajesPermitidos.length > 0) ||
    (Array.isArray(configuracion?.sintaxis) && configuracion.sintaxis.length > 0) ||
    configuracion?.esperado
  );
};

// Función auxiliar para validar FKs (Evita repetir código)
const validarRelaciones = async (tipo_id, area_id) => {
  if (tipo_id) {
    const existe = await TipoActividad.findByPk(tipo_id);
    if (!existe) throw new Error(`El tipo_actividad_id (${tipo_id}) no existe.`);
  }
  if (area_id) {
    const existe = await Area.findByPk(area_id);
    if (!existe) throw new Error(`El area_id (${area_id}) no existe.`);
    if (existe.estado === false) throw new Error(`El area_id (${area_id}) está inactivo.`);
  }
};

const buildRespuestaMiniproyectoPayload = ({ respuestaMiniproyecto, titulo, descripcion, entregable }) => {
  const configurablePayload = normalizeConfigurableMiniproyectoPayload(respuestaMiniproyecto);
  if (configurablePayload) {
    return JSON.stringify(configurablePayload);
  }

  return enrichMiniproyectoResponse(respuestaMiniproyecto, { titulo, descripcion, entregable });
};

const getAuthenticatedStudentId = (req) => {
  const estudianteId = Number(req.estudianteId);
  return Number.isFinite(estudianteId) ? estudianteId : null;
};

const resolveConfigurableStudentId = (req, candidateStudentId) => {
  if (req.tipoUsuario === 'ESTUDIANTE') {
    const estudianteId = getAuthenticatedStudentId(req);
    if (!estudianteId) {
      throw Object.assign(new Error('Solo los estudiantes autenticados pueden responder este miniproyecto.'), { status: 403 });
    }
    if (candidateStudentId !== undefined && candidateStudentId !== null && Number(candidateStudentId) !== estudianteId) {
      throw Object.assign(new Error('No puedes responder miniproyectos de otro estudiante.'), { status: 403 });
    }
    return estudianteId;
  }

  const parsed = Number(candidateStudentId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error('El estudiante_id es obligatorio.'), { status: 400 });
  }
  return parsed;
};

const loadConfigurableMiniproyecto = async (id) => {
  const miniproyecto = await Miniproyecto.findByPk(id, {
    include: [{ model: Actividad }]
  });

  if (!miniproyecto || !isMiniproyectoActivo(miniproyecto)) {
    throw Object.assign(new Error('Miniproyecto no encontrado'), { status: 404 });
  }

  const payload = normalizeConfigurableMiniproyectoPayload(miniproyecto.respuesta_miniproyecto);
  if (!payload || !Array.isArray(payload.exercises) || payload.exercises.length === 0) {
    throw Object.assign(new Error('El miniproyecto no tiene ejercicios embebidos configurados.'), { status: 400 });
  }

  return { miniproyecto, payload };
};

const getPublishedMiniproyectoId = (areaLike) => {
  const parsed = Number(areaLike?.miniproyecto_publicado_id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const serializeMiniproyectoSelection = (registro) => {
  const payload = typeof registro?.toJSON === 'function' ? registro.toJSON() : registro;
  const publishedId = getPublishedMiniproyectoId(payload?.Area || payload?.area);

  return {
    ...payload,
    seleccionadoParaEstudiantes: publishedId !== null && Number(payload?.id) === publishedId,
  };
};

const filterStudentVisibleMiniproyectos = (items) => {
  const publishedByArea = new Map();

  items.forEach((item) => {
    const payload = typeof item?.toJSON === 'function' ? item.toJSON() : item;
    const areaId = Number(payload?.Area?.id ?? payload?.area_id);
    const publishedId = getPublishedMiniproyectoId(payload?.Area || payload?.area);

    if (Number.isInteger(areaId) && areaId > 0 && publishedId !== null) {
      publishedByArea.set(areaId, publishedId);
    }
  });

  return items.filter((item) => {
    const payload = typeof item?.toJSON === 'function' ? item.toJSON() : item;
    const areaId = Number(payload?.Area?.id ?? payload?.area_id);
    const publishedId = publishedByArea.get(areaId);

    return Number.isInteger(Number(publishedId)) && Number(payload?.id) === Number(publishedId);
  });
};

const ensureStudentCanAccessPublishedMiniproyecto = async (req, miniproyecto) => {
  if (canViewInactiveMiniproyectos(req)) {
    return;
  }

  const area = miniproyecto?.Area || await Area.findByPk(miniproyecto.area_id, {
    attributes: ['id', 'miniproyecto_publicado_id'],
  });
  const publishedId = getPublishedMiniproyectoId(area);

  if (publishedId === null || Number(miniproyecto.id) !== publishedId) {
    throw Object.assign(new Error('Miniproyecto no encontrado'), { status: 404 });
  }
};

const clearPublishedMiniproyectoIfMatches = async ({ areaId, miniproyectoId, transaction }) => {
  const area = await Area.findByPk(areaId, {
    attributes: ['id', 'miniproyecto_publicado_id'],
    transaction,
  });

  if (!area) {
    return;
  }

  if (getPublishedMiniproyectoId(area) === Number(miniproyectoId)) {
    await area.update({ miniproyecto_publicado_id: null }, { transaction });
  }
};

const syncPublishedMiniproyectoOnAreaChange = async ({ previousAreaId, nextAreaId, miniproyectoId, transaction }) => {
  if (Number(previousAreaId) === Number(nextAreaId)) {
    return;
  }

  await clearPublishedMiniproyectoIfMatches({
    areaId: previousAreaId,
    miniproyectoId,
    transaction,
  });
};

const findEmbeddedExercise = (payload, exerciseKey) => {
  const normalizedKey = String(exerciseKey || '').trim();
  const exercise = (payload.exercises || []).find((item, index) => (
    item.id === normalizedKey || String(index) === normalizedKey
  ));

  if (!exercise) {
    throw Object.assign(new Error('Ejercicio embebido no encontrado.'), { status: 404 });
  }

  return exercise;
};

const lockConfigurableSubmission = async (lockKey, handler) => {
  if (configurableSubmissionLocks.has(lockKey)) {
    throw Object.assign(new Error('Ya se está procesando una respuesta para este ejercicio.'), { status: 409 });
  }

  configurableSubmissionLocks.set(lockKey, true);
  try {
    return await handler();
  } finally {
    configurableSubmissionLocks.delete(lockKey);
  }
};
 
exports.create = async (req, res) => {
  try {
    if (!isNonEmptyString(req.body.titulo)) {
      return res.status(400).json({ error: 'El titulo es obligatorio' });
    }

    // 1. Validar existencia de FKs antes de iniciar
    await validarRelaciones(req.body.tipo_actividad_id, req.body.area_id);

    if (req.docenteAreaId && parseInt(req.body.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

    const configurablePayload = normalizeConfigurableMiniproyectoPayload(req.body.respuesta_miniproyecto);
    if (configurablePayload) {
      await validateConfigurableExercises(req.body.area_id, configurablePayload.exercises.length > 0 ? configurablePayload : configurablePayload.exerciseIds);
      if (configurablePayload.chatbot?.enabled) {
        await validateSelectedChatbot(req.body.area_id, configurablePayload.chatbot.chatbotId);
      }
      req.body.respuesta_miniproyecto = configurablePayload;
    }

    const titulo = sanitizePlainText(req.body.titulo);
    const descripcion = sanitizeRichText(req.body.descripcion);
    const entregable = sanitizePlainText(req.body.entregable);
    const respuestaMiniproyecto = buildRespuestaMiniproyectoPayload({
      respuestaMiniproyecto: req.body.respuesta_miniproyecto,
      titulo,
      descripcion,
      entregable
    });

    const t = await sequelize.transaction();
    try {
      const nuevaActividad = await Actividad.create({
        titulo,
        descripcion,
        nivel_dificultad: req.body.nivel_dificultad,
        fecha_creacion: req.body.fecha_creacion || new Date(),
        tipo_actividad_id: req.body.tipo_actividad_id
      }, { transaction: t });

      const nuevoMiniproyecto = await Miniproyecto.create({
        id: nuevaActividad.id,
        actividad_id: nuevaActividad.id,
        area_id: req.body.area_id,
        entregable,
        respuesta_miniproyecto: respuestaMiniproyecto
      }, { transaction: t });

      if (configurablePayload) {
        const selectedChatbotId = configurablePayload.chatbot?.enabled ? configurablePayload.chatbot.chatbotId : null;
        await syncSelectedChatbot({
          areaId: Number(req.body.area_id),
          miniproyectoId: Number(nuevoMiniproyecto.id),
          chatbotId: selectedChatbotId,
          transaction: t,
        });
      }

      await t.commit();
      res.status(201).json({
        message: "Creado exitosamente",
        data: { ...nuevaActividad.toJSON(), ...nuevoMiniproyecto.toJSON() }
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // 1. Validar FKs solo si vienen en el body
    await validarRelaciones(req.body.tipo_actividad_id, req.body.area_id);

    // 2. Verificar si el registro existe antes de editar
    const miniproyecto = await Miniproyecto.findByPk(req.params.id);
    if (!miniproyecto) return res.status(404).json({ message: "Miniproyecto no encontrado" });

    const actividadActual = await Actividad.findByPk(miniproyecto.actividad_id);
    if (!actividadActual) return res.status(404).json({ message: 'Actividad asociada no encontrada' });

    if (req.docenteAreaId && parseInt(miniproyecto.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

    if (req.docenteAreaId && req.body.area_id !== undefined && parseInt(req.body.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

    const targetAreaId = req.body.area_id !== undefined ? Number(req.body.area_id) : Number(miniproyecto.area_id);

    const mergedTitulo = req.body.titulo !== undefined
      ? sanitizePlainText(req.body.titulo)
      : actividadActual.titulo;
    const mergedDescripcion = req.body.descripcion !== undefined
      ? sanitizeRichText(req.body.descripcion)
      : actividadActual.descripcion;
    const mergedEntregable = req.body.entregable !== undefined
      ? sanitizePlainText(req.body.entregable)
      : miniproyecto.entregable;
    const shouldRefreshRespuestaMiniproyecto = (
      req.body.respuesta_miniproyecto !== undefined ||
      req.body.titulo !== undefined ||
      req.body.descripcion !== undefined ||
      req.body.entregable !== undefined
    );
    const mergedRespuestaMiniproyecto = shouldRefreshRespuestaMiniproyecto
      ? buildRespuestaMiniproyectoPayload({
          respuestaMiniproyecto: req.body.respuesta_miniproyecto !== undefined
            ? req.body.respuesta_miniproyecto
            : miniproyecto.respuesta_miniproyecto,
          titulo: mergedTitulo,
          descripcion: mergedDescripcion,
          entregable: mergedEntregable
        })
      : undefined;

    const configurablePayload = normalizeConfigurableMiniproyectoPayload(
      mergedRespuestaMiniproyecto !== undefined ? mergedRespuestaMiniproyecto : miniproyecto.respuesta_miniproyecto
    );

    if (configurablePayload) {
      await validateConfigurableExercises(targetAreaId, configurablePayload.exercises.length > 0 ? configurablePayload : configurablePayload.exerciseIds);
      if (configurablePayload.chatbot?.enabled) {
        await validateSelectedChatbot(targetAreaId, configurablePayload.chatbot.chatbotId, miniproyecto.id);
      }
    }

    const t = await sequelize.transaction();
    try {
      const actividadPayload = {
        ...(req.body.titulo !== undefined && { titulo: mergedTitulo }),
        ...(req.body.descripcion !== undefined && { descripcion: mergedDescripcion }),
        ...(req.body.nivel_dificultad !== undefined && { nivel_dificultad: req.body.nivel_dificultad }),
        ...(req.body.fecha_creacion !== undefined && { fecha_creacion: req.body.fecha_creacion }),
        ...(req.body.tipo_actividad_id !== undefined && { tipo_actividad_id: req.body.tipo_actividad_id })
      };

      const miniproyectoPayload = {
        ...(req.body.area_id !== undefined && { area_id: req.body.area_id }),
        ...(req.body.entregable !== undefined && { entregable: mergedEntregable }),
        ...(mergedRespuestaMiniproyecto !== undefined && { respuesta_miniproyecto: mergedRespuestaMiniproyecto })
      };

      // Actualizar tabla padre (Actividad)
      if (Object.keys(actividadPayload).length > 0) {
        await Actividad.update(actividadPayload, {
          where: { id: miniproyecto.actividad_id },
          transaction: t
        });
      }

      // Actualizar tabla hija (Miniproyecto)
      if (Object.keys(miniproyectoPayload).length > 0) {
        await Miniproyecto.update(miniproyectoPayload, {
          where: { id: req.params.id },
          transaction: t
        });
      }

      if (configurablePayload) {
        const selectedChatbotId = configurablePayload.chatbot?.enabled ? configurablePayload.chatbot.chatbotId : null;
        await syncSelectedChatbot({
          areaId: targetAreaId,
          miniproyectoId: Number(req.params.id),
          chatbotId: selectedChatbotId,
          transaction: t,
        });
      }

      await syncPublishedMiniproyectoOnAreaChange({
        previousAreaId: Number(miniproyecto.area_id),
        nextAreaId: targetAreaId,
        miniproyectoId: Number(req.params.id),
        transaction: t,
      });

      await t.commit();
      res.json({ message: 'Actualizado correctamente' });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ... findAll, findOne y delete se mantienen igual ...

exports.findAll = async (req, res) => {
  try {
    const { area_id } = req.query;
    const where = {};

    if (req.docenteAreaId) {
      where.area_id = parseInt(req.docenteAreaId, 10);
    } else if (area_id !== undefined) {
      const parsedAreaId = parseInt(area_id, 10);
      if (isNaN(parsedAreaId)) {
        return res.status(400).json({ error: 'area_id debe ser un número válido' });
      }
      where.area_id = parsedAreaId;
    }

    const data = await Miniproyecto.findAll({
      where,
      attributes: { exclude: ['area_id'] },
      include: [
        { model: Area },
        {
          model: Chatbot,
          as: 'chatbots',
          attributes: ['id', 'nombre', 'tipo', 'estado', 'area_id', 'miniproyecto_id']
        },
        { 
          model: Actividad,
          attributes: { exclude: ['tipo_actividad_id'] },
          include: [{ model: TipoActividad, as: 'tipo' }] 
        }
      ]
    });

    const visibleRecords = canViewInactiveMiniproyectos(req)
      ? data
      : filterStudentVisibleMiniproyectos(data.filter(isMiniproyectoActivo));

    res.json(visibleRecords.map(serializeMiniproyectoSelection));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const attributes = req.docenteAreaId ? undefined : { exclude: ['area_id'] };
    const data = await Miniproyecto.findByPk(req.params.id, {
      attributes,
      include: [
        { model: Area },
        {
          model: Chatbot,
          as: 'chatbots',
          attributes: ['id', 'nombre', 'tipo', 'estado', 'area_id', 'miniproyecto_id']
        },
        { 
          model: Actividad,
          attributes: { exclude: ['tipo_actividad_id'] },
          include: [{ model: TipoActividad, as: 'tipo' }]
        }
      ]
    });
    if (!data) return res.status(404).json({ message: "Miniproyecto no encontrado" });

    if (!canViewInactiveMiniproyectos(req) && !isMiniproyectoActivo(data)) {
      return res.status(404).json({ message: 'Miniproyecto no encontrado' });
    }

    await ensureStudentCanAccessPublishedMiniproyecto(req, data);

    if (req.docenteAreaId && parseInt(data.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
    }

    if (req.docenteAreaId) {
      const payload = serializeMiniproyectoSelection(data);
      delete payload.area_id;
      return res.json(payload);
    }

    res.json(serializeMiniproyectoSelection(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const miniproyecto = await Miniproyecto.findByPk(req.params.id);
    if (!miniproyecto) return res.status(404).json({ message: "Registro no encontrado" });

    if (req.docenteAreaId) {
      if (parseInt(miniproyecto.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
        return res.status(403).json({ error: "Acceso denegado: área fuera de tu alcance" });
      }
    }

    const actividad = await Actividad.findByPk(req.params.id);
    if (!actividad) return res.status(404).json({ message: 'Actividad asociada no encontrada' });

    if (actividad.estado === false) {
      return res.json({ message: 'Miniproyecto ya estaba inhabilitado' });
    }

    const t = await sequelize.transaction();
    try {
      await actividad.update({ estado: false }, { transaction: t });
      await clearPublishedMiniproyectoIfMatches({
        areaId: Number(miniproyecto.area_id),
        miniproyectoId: Number(miniproyecto.id),
        transaction: t,
      });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }

    res.json({ message: 'Miniproyecto inhabilitado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleEstado = async (req, res) => {
  try {
    const miniproyecto = await Miniproyecto.findByPk(req.params.id);
    if (!miniproyecto) return res.status(404).json({ message: 'Miniproyecto no encontrado' });

    if (req.docenteAreaId && parseInt(miniproyecto.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: 'Acceso denegado: área fuera de tu alcance' });
    }

    const actividad = await Actividad.findByPk(req.params.id);
    if (!actividad) return res.status(404).json({ message: 'Actividad asociada no encontrada' });

    const nuevoEstado = actividad.estado === false;
    const t = await sequelize.transaction();
    try {
      await actividad.update({ estado: nuevoEstado }, { transaction: t });

      if (!nuevoEstado) {
        await clearPublishedMiniproyectoIfMatches({
          areaId: Number(miniproyecto.area_id),
          miniproyectoId: Number(miniproyecto.id),
          transaction: t,
        });
      }

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }

    res.json({
      message: `Miniproyecto ${nuevoEstado ? 'habilitado' : 'inhabilitado'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.ejecutarMiniproyectoProgramacion = async (req, res) => {
  try {
    const { id } = req.params;
    const lenguaje_id = req.body?.lenguaje_id || req.body?.respuesta?.lenguaje_id || 62;

    const archivos = req.body?.archivos;
    const stdinManual = req.body?.stdin_manual;

    let codigo;
    if (archivos && typeof archivos === 'object') {
      const { mergeMvcFiles } = require('../utils/javaMultiFileCompiler');
      codigo = mergeMvcFiles(archivos.main, archivos.modelo, archivos.consolaIO);

      // Ejecución libre: el estudiante provee su propio stdin
      if (typeof stdinManual === 'string') {
        const evaluadorCasos = require('../services/evaluadorCasosPrueba');
        const ejecucion = await evaluadorCasos.ejecutarMvcLibre(codigo, stdinManual);
        return res.status(200).json({
          modo: 'ejecucion_libre',
          stdout: ejecucion.stdout || '',
          stderr: ejecucion.stderr || '',
          exito: ejecucion.success,
        });
      }
    } else {
      codigo = req.body?.codigo || req.body?.respuesta?.codigo || req.body?.respuesta?.texto || '';
    }

    if (!codigo || !lenguaje_id) {
      return res.status(400).json({ message: 'Faltan campos: lenguaje_id, codigo' });
    }

    const miniproyecto = await Miniproyecto.findByPk(id, {
      include: [{ model: Actividad }]
    });
    if (!miniproyecto || !isMiniproyectoActivo(miniproyecto)) {
      return res.status(404).json({ message: 'Miniproyecto no encontrado' });
    }

    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);

    if (!isProgrammingMiniproyecto(miniproyecto)) {
      return res.status(400).json({ message: 'El miniproyecto no es de programacion' });
    }

    const { configuracion } = loadProgrammingMiniproyectoConfig(miniproyecto);

    // Ruta MVC: el código ya tiene main (programa completo fusionado).
    // Usar evaluarCasosPruebaMvc en lugar del path de extracción de métodos.
    const isMvcCode = /public\s+static\s+void\s+main\s*\(/.test(codigo);
    const casosPruebaConfigured = (configuracion?.casos_prueba || []).filter(c => c.output?.trim());

    if (isMvcCode && casosPruebaConfigured.length > 0) {
      const evaluadorCasos = require('../services/evaluadorCasosPrueba');
      const resultado = await evaluadorCasos.evaluarCasosPruebaMvc(codigo, casosPruebaConfigured);
      if (resultado.errorTecnico) {
        return res.status(502).json({ message: resultado.resumen || 'Error técnico al ejecutar.' });
      }
      return res.status(200).json({
        modo: 'ejecucion',
        message: 'Ejecución completada.',
        resumen: resultado.resumen,
        casos: resultado.resultados || [],
        stdout: '',
        stderr: ''
      });
    }

    const evaluacion = await evaluacionController.evaluateCompilerSubmission({
      codigo,
      lenguaje_id,
      configuracion,
      esperado: configuracion?.esperado || miniproyecto.respuesta_miniproyecto || ''
    });

    if (!evaluacion || evaluacion.status >= 500) {
      return res.status(500).json({ message: evaluacion?.message || 'Error ejecutando el miniproyecto' });
    }

    return res.status(200).json({
      modo: 'ejecucion',
      message: 'Ejecucion completada.',
      resumen: evaluacion?.data?.resumen || evaluacion?.data?.estado || 'Codigo ejecutado sin calificar.',
      casos: evaluacion?.data?.casosPrueba || [],
      stdout: evaluacion?.data?.stdout || '',
      stderr: evaluacion?.data?.stderr || '',
      esperado: evaluacion?.data?.esperado || '',
      obtenido: evaluacion?.data?.obtenido || ''
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error ejecutando miniproyecto', error: err.message || err });
  }
};

// Enviar respuesta para miniproyecto de programacion
exports.enviarMiniproyectoProgramacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estudiante_id } = req.body || {};
    const lenguaje_id = req.body?.lenguaje_id || req.body?.respuesta?.lenguaje_id;

    const archivos = req.body?.archivos;
    let codigo;
    if (archivos && typeof archivos === 'object') {
      const { mergeMvcFiles } = require('../utils/javaMultiFileCompiler');
      codigo = mergeMvcFiles(archivos.main, archivos.modelo, archivos.consolaIO);
    } else {
      codigo = req.body?.codigo || req.body?.respuesta?.codigo || req.body?.respuesta?.texto || '';
    }

    if (!estudiante_id || !codigo || !lenguaje_id) {
      return res.status(400).json({ message: 'Faltan campos: estudiante_id, lenguaje_id, codigo' });
    }

    const estudiante = await Estudiante.findByPk(estudiante_id);
    if (!estudiante) {
      return res.status(400).json({ message: `El estudiante_id (${estudiante_id}) no existe.` });
    }

    const miniproyecto = await Miniproyecto.findByPk(id, {
      include: [{ model: Actividad }]
    });
    if (!miniproyecto) {
      return res.status(404).json({ message: 'Miniproyecto no encontrado' });
    }

    if (!isMiniproyectoActivo(miniproyecto)) {
      return res.status(404).json({ message: 'Miniproyecto no encontrado' });
    }

    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);

    if (!isProgrammingMiniproyecto(miniproyecto)) {
      return res.status(400).json({ message: 'El miniproyecto no es de programacion' });
    }

    const evalExistente = await Evaluacion.findOne({
      where: { estudiante_id, miniproyecto_id: parseInt(id, 10), estado: 'APROBADO' }
    });
    if (evalExistente) {
      return res.status(409).json({ message: 'Miniproyecto ya aprobado para el estudiante' });
    }

    const { esperado, configuracion } = loadProgrammingMiniproyectoConfig(miniproyecto);

    // Ruta MVC: el código ya tiene main (programa completo fusionado).
    // Usar evaluarCasosPruebaMvc en lugar del path de extracción de métodos.
    const isMvcCodeEnviar = /public\s+static\s+void\s+main\s*\(/.test(codigo);
    const casosPruebaEnviar = (configuracion?.casos_prueba || []).filter(c => c.output?.trim());

    if (isMvcCodeEnviar && casosPruebaEnviar.length > 0) {
      const evaluadorCasos = require('../services/evaluadorCasosPrueba');
      const resultado = await evaluadorCasos.evaluarCasosPruebaMvc(codigo, casosPruebaEnviar);

      if (resultado.errorTecnico) {
        return res.status(502).json({ message: resultado.resumen || 'Error técnico al ejecutar.' });
      }

      const aprobado = resultado.aprobado;
      const respuestaPayload = JSON.stringify({ codigo, lenguaje_id, casosPrueba: resultado.resultados });

      const existenteRespuesta = await RespuestaEstudianteMiniproyecto.findOne({
        where: { estudiante_id, miniproyecto_id: parseInt(id, 10) }
      });
      if (existenteRespuesta) {
        await existenteRespuesta.update({
          respuesta: respuestaPayload,
          estado: aprobado ? 'COMPLETADO' : 'REPROBADO',
          contador: (Number.isFinite(existenteRespuesta.contador) ? existenteRespuesta.contador : 0) + 1
        });
      } else {
        await RespuestaEstudianteMiniproyecto.create({
          respuesta: respuestaPayload,
          estudiante_id,
          miniproyecto_id: parseInt(id, 10),
          estado: aprobado ? 'COMPLETADO' : 'REPROBADO',
          contador: 1
        });
      }

      const evalPayload = {
        calificacion: aprobado ? 100 : 0,
        retroalimentacion: resultado.resumen,
        estudiante_id,
        miniproyecto_id: parseInt(id, 10),
        estado: aprobado ? 'APROBADO' : 'REPROBADO'
      };
      const evalPrev = await Evaluacion.findOne({ where: { estudiante_id, miniproyecto_id: parseInt(id, 10) } });
      if (evalPrev) {
        await evalPrev.update(evalPayload);
      } else {
        await Evaluacion.create(evalPayload);
      }

      return res.status(aprobado ? 200 : 400).json({
        esCorrecta: aprobado,
        puntosObtenidos: aprobado ? 100 : 0,
        casos: resultado.resultados || [],
        resumen: resultado.resumen
      });
    }

    const evaluacion = await evaluacionController.evaluateCompilerSubmission({
      codigo,
      lenguaje_id,
      configuracion,
      esperado
    });

    if (!evaluacion || evaluacion.status >= 500) {
      return res.status(500).json({ message: evaluacion?.message || 'Error evaluando el miniproyecto' });
    }

    if (evaluacion.status !== 200) {
      const respuestaPayload = JSON.stringify({
        codigo,
        lenguaje_id,
        stdout: evaluacion.data?.stdout || '',
        stderr: evaluacion.data?.stderr || '',
        esperado: evaluacion.data?.esperado,
        obtenido: evaluacion.data?.obtenido
      });

      const existenteRespuesta = await RespuestaEstudianteMiniproyecto.findOne({
        where: { estudiante_id, miniproyecto_id: parseInt(id, 10) }
      });

      if (existenteRespuesta) {
        const contadorActual = Number.isFinite(existenteRespuesta.contador)
          ? existenteRespuesta.contador
          : 0;
        await existenteRespuesta.update({
          respuesta: respuestaPayload,
          estado: 'REPROBADO',
          contador: contadorActual + 1
        });
      } else {
        await RespuestaEstudianteMiniproyecto.create({
          respuesta: respuestaPayload,
          estudiante_id,
          miniproyecto_id: parseInt(id, 10),
          estado: 'REPROBADO',
          contador: 1
        });
      }

      const evalPayload = {
        calificacion: 0,
        retroalimentacion: evaluacion.data?.estado || evaluacion.message || 'Respuesta incorrecta',
        estudiante_id,
        miniproyecto_id: parseInt(id, 10),
        estado: 'REPROBADO'
      };
      const evalPrev = await Evaluacion.findOne({ where: { estudiante_id, miniproyecto_id: parseInt(id, 10) } });
      if (evalPrev) {
        await evalPrev.update(evalPayload);
      } else {
        await Evaluacion.create(evalPayload);
      }

      return res.status(400).json({
        esCorrecta: false,
        ...evaluacion.data,
        message: evaluacion.message || 'Respuesta incorrecta'
      });
    }

    const respuestaPayload = JSON.stringify({
      codigo,
      lenguaje_id,
      stdout: evaluacion.data?.stdout || ''
    });

    const existenteRespuesta = await RespuestaEstudianteMiniproyecto.findOne({
      where: { estudiante_id, miniproyecto_id: parseInt(id, 10) }
    });

    if (existenteRespuesta) {
      const contadorActual = Number.isFinite(existenteRespuesta.contador)
        ? existenteRespuesta.contador
        : 0;
      await existenteRespuesta.update({
        respuesta: respuestaPayload,
        estado: 'COMPLETADO',
        contador: contadorActual + 1
      });
    } else {
      await RespuestaEstudianteMiniproyecto.create({
        respuesta: respuestaPayload,
        estudiante_id,
        miniproyecto_id: parseInt(id, 10),
        estado: 'COMPLETADO',
        contador: 1
      });
    }

    const evalPayload = {
      calificacion: 100,
      retroalimentacion: 'Aprobado automaticamente. Salida y sintaxis correctas.',
      estudiante_id,
      miniproyecto_id: parseInt(id, 10),
      estado: 'APROBADO'
    };
    const evalPrev = await Evaluacion.findOne({ where: { estudiante_id, miniproyecto_id: parseInt(id, 10) } });
    if (evalPrev) {
      await evalPrev.update(evalPayload);
    } else {
      await Evaluacion.create(evalPayload);
    }

    return res.status(200).json({
      esCorrecta: true,
      puntosObtenidos: 100,
      ...evaluacion.data
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error al evaluar miniproyecto', error: err.message || err });
  }
};

exports.obtenerProgresoConfigurable = async (req, res) => {
  try {
    const estudianteId = resolveConfigurableStudentId(req, req.query?.estudiante_id);
    const { miniproyecto, payload } = await loadConfigurableMiniproyecto(req.params.id);
    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);
    const record = await RespuestaEstudianteMiniproyecto.findOne({
      where: {
        estudiante_id: estudianteId,
        miniproyecto_id: miniproyecto.id,
      }
    });

    const parsedProgress = parseConfigurableResponseProgress(record);
    const summary = summarizeConfigurableMiniproyecto({
      embeddedExercises: payload.exercises,
      progress: parsedProgress.exercises,
      evaluation: parsedProgress.evaluation,
    });

    res.json({
      estudiante_id: estudianteId,
      miniproyecto_id: miniproyecto.id,
      completado: Boolean(parsedProgress.evaluation?.aprobado),
      listoParaEvaluar: summary.listoParaEvaluar,
      ejerciciosRespondidos: summary.ejerciciosRespondidos,
      ejerciciosCorrectos: summary.ejerciciosCorrectos,
      calificacion: parsedProgress.evaluation?.calificacion ?? summary.calificacion,
      retroalimentacionGeneral: parsedProgress.evaluation?.retroalimentacionGeneral || summary.retroalimentacionGeneral,
      fechaEvaluacion: parsedProgress.evaluation?.fechaEvaluacion || null,
      ejercicios: summary.ejercicios,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'No fue posible obtener el progreso.' });
  }
};

exports.ejecutarEjercicioConfigurable = async (req, res) => {
  try {
    const { miniproyecto, payload } = await loadConfigurableMiniproyecto(req.params.id);
    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);
    const exercise = findEmbeddedExercise(payload, req.params.exerciseKey);
    const evaluationResult = await evaluateEmbeddedExercise({ exercise, reqBody: req.body });
    return res.status(evaluationResult.status).json(evaluationResult.payload);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Error ejecutando el ejercicio embebido.' });
  }
};

exports.enviarEjercicioConfigurable = async (req, res) => {
  try {
    const estudianteId = resolveConfigurableStudentId(req, req.body?.estudiante_id);
    const estudiante = await Estudiante.findByPk(estudianteId);
    if (!estudiante) {
      return res.status(400).json({ message: `El estudiante_id (${estudianteId}) no existe.` });
    }

    const { miniproyecto, payload } = await loadConfigurableMiniproyecto(req.params.id);
    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);
    const exercise = findEmbeddedExercise(payload, req.params.exerciseKey);
    const lockKey = `${miniproyecto.id}:${exercise.id}:${estudianteId}`;

    const result = await lockConfigurableSubmission(lockKey, async () => {
      const evaluationResult = await evaluateEmbeddedExercise({ exercise, reqBody: req.body });
      const persistence = await upsertConfigurableExerciseProgress({
        estudianteId,
        miniproyecto,
        exercise,
        evaluationResult,
      });

      if (persistence.conflict) {
        return { status: 409, payload: { message: 'Este miniproyecto ya fue aprobado.' } };
      }

      return {
        status: evaluationResult.status,
        payload: {
          ...evaluationResult.payload,
          progreso: persistence.progress,
          resumenMiniproyecto: persistence.summary,
          miniproyectoCompletado: Boolean(persistence.summary?.aprobado),
        }
      };
    });

    return res.status(result.status).json(result.payload);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Error enviando el ejercicio embebido.' });
  }
};

exports.obtenerRetroalimentacionEjercicioConfigurable = async (req, res) => {
  try {
    const estudianteId = resolveConfigurableStudentId(req, req.query?.estudiante_id);
    const { miniproyecto, payload } = await loadConfigurableMiniproyecto(req.params.id);
    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);
    const exercise = findEmbeddedExercise(payload, req.params.exerciseKey);
    const record = await RespuestaEstudianteMiniproyecto.findOne({
      where: {
        estudiante_id: estudianteId,
        miniproyecto_id: miniproyecto.id,
      }
    });
    const progress = parseConfigurableResponseProgress(record).exercises;
    const feedback = progress?.[exercise.id]?.retroalimentacion;

    res.json({
      ejercicioId: exercise.id,
      retroalimentacion: feedback || 'Aún no hay retroalimentación registrada para este ejercicio.',
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'No fue posible obtener la retroalimentación.' });
  }
};

exports.evaluarMiniproyectoConfigurable = async (req, res) => {
  try {
    const estudianteId = resolveConfigurableStudentId(req, req.body?.estudiante_id ?? req.query?.estudiante_id);
    const { miniproyecto, payload } = await loadConfigurableMiniproyecto(req.params.id);
    await ensureStudentCanAccessPublishedMiniproyecto(req, miniproyecto);
    const respuestas = req.body?.respuestas && typeof req.body.respuestas === 'object' ? req.body.respuestas : {};
    const record = await RespuestaEstudianteMiniproyecto.findOne({
      where: {
        estudiante_id: estudianteId,
        miniproyecto_id: miniproyecto.id,
      }
    });

    const parsedProgress = parseConfigurableResponseProgress(record);

    const existingEvaluation = await Evaluacion.findOne({
      where: { estudiante_id: estudianteId, miniproyecto_id: miniproyecto.id }
    });

    if (String(existingEvaluation?.estado || '').toUpperCase() === 'APROBADO') {
      return res.status(409).json({ message: 'Este miniproyecto ya fue aprobado.' });
    }

    const nextProgress = { ...parsedProgress.exercises };

    for (const exercise of payload.exercises) {
      const responseBody = respuestas?.[exercise.id];
      if (!responseBody || typeof responseBody !== 'object') {
        return res.status(400).json({ message: `Falta la respuesta del ejercicio ${exercise.titulo || exercise.id}.` });
      }

      const evaluationResult = await evaluateEmbeddedExercise({ exercise, reqBody: responseBody });
      const previousExercise = parsedProgress.exercises?.[exercise.id] || {};

      nextProgress[exercise.id] = {
        id: exercise.id,
        titulo: exercise.titulo,
        tipo_ejercicio: exercise.tipo_ejercicio,
        aprobado: Boolean(evaluationResult.payload?.esCorrecta),
        esCorrecta: Boolean(evaluationResult.payload?.esCorrecta),
        intentos: Number(previousExercise.intentos || 0) + 1,
        puntosObtenidos: Number(evaluationResult.payload?.puntosObtenidos || 0),
        retroalimentacion: evaluationResult.payload?.retroalimentacion || '',
        updatedAt: new Date().toISOString(),
      };
    }

    const summary = summarizeConfigurableMiniproyecto({
      embeddedExercises: payload.exercises,
      progress: nextProgress,
      evaluation: parsedProgress.evaluation,
    });

    if (summary.totalEjercicios === 0) {
      return res.status(400).json({ message: 'Este miniproyecto configurable no tiene ejercicios para evaluar.' });
    }

    const approved = summary.ejerciciosCorrectos === summary.totalEjercicios;
    const evaluationPayload = {
      aprobado: approved,
      calificacion: approved ? 100 : summary.calificacion,
      retroalimentacionGeneral: approved
        ? 'El miniproyecto configurable fue aprobado porque todos los ejercicios quedaron correctos.'
        : `El miniproyecto configurable no aprueba todavía. Solo ${summary.ejerciciosCorrectos} de ${summary.totalEjercicios} ejercicios quedaron correctos.`,
      fechaEvaluacion: new Date().toISOString(),
    };

    if (record) {
      await record.update({
        respuesta: buildConfigurableProgressPayload(nextProgress, evaluationPayload),
        estado: approved ? 'COMPLETADO' : 'EN_PROGRESO',
        contador: Number(record.contador || 0) + 1,
      });
    } else {
      await RespuestaEstudianteMiniproyecto.create({
        respuesta: buildConfigurableProgressPayload(nextProgress, evaluationPayload),
        estudiante_id: estudianteId,
        miniproyecto_id: miniproyecto.id,
        estado: approved ? 'COMPLETADO' : 'EN_PROGRESO',
        contador: 1,
      });
    }

    if (existingEvaluation) {
      await existingEvaluation.update({
        calificacion: evaluationPayload.calificacion,
        estado: approved ? 'APROBADO' : 'REPROBADO',
        fecha_evaluacion: new Date(),
      });
    } else {
      await Evaluacion.create({
        calificacion: evaluationPayload.calificacion,
        estado: approved ? 'APROBADO' : 'REPROBADO',
        estudiante_id: estudianteId,
        miniproyecto_id: miniproyecto.id,
      });
    }

    return res.status(approved ? 200 : 400).json({
      message: evaluationPayload.retroalimentacionGeneral,
      completado: approved,
      resumen: {
        ...summary,
        aprobado: approved,
        calificacion: evaluationPayload.calificacion,
        retroalimentacionGeneral: evaluationPayload.retroalimentacionGeneral,
        fechaEvaluacion: evaluationPayload.fechaEvaluacion,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'No fue posible evaluar el miniproyecto configurable.' });
  }
};

exports.updateStudentPublication = async (req, res) => {
  try {
    const miniproyecto = await Miniproyecto.findByPk(req.params.id, {
      include: [{ model: Actividad }, { model: Area }],
    });

    if (!miniproyecto) {
      return res.status(404).json({ message: 'Miniproyecto no encontrado' });
    }

    if (req.docenteAreaId && parseInt(miniproyecto.area_id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ error: 'Acceso denegado: área fuera de tu alcance' });
    }

    const shouldPublish = req.body?.visibleParaEstudiantes !== false;

    if (shouldPublish && !isMiniproyectoActivo(miniproyecto)) {
      return res.status(400).json({ message: 'Solo puedes publicar miniproyectos activos.' });
    }

    const t = await sequelize.transaction();
    try {
      const area = await Area.findByPk(miniproyecto.area_id, {
        attributes: ['id', 'miniproyecto_publicado_id'],
        transaction: t,
      });

      if (!area) {
        throw new Error('Área no encontrada.');
      }

      const publishedId = getPublishedMiniproyectoId(area);

      if (shouldPublish) {
        await area.update({ miniproyecto_publicado_id: miniproyecto.id }, { transaction: t });
      } else if (publishedId === Number(miniproyecto.id)) {
        await area.update({ miniproyecto_publicado_id: null }, { transaction: t });
      }

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }

    return res.json({
      message: shouldPublish
        ? 'Miniproyecto asignado al área para estudiantes.'
        : 'El miniproyecto ya no está asignado como miniproyecto del área.',
      area_id: Number(miniproyecto.area_id),
      miniproyecto_id: Number(miniproyecto.id),
      seleccionadoParaEstudiantes: shouldPublish,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'No fue posible actualizar la asignación del miniproyecto del área.' });
  }
};