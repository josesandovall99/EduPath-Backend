const { sequelize, Ejercicio, Actividad, Contenido, TipoActividad, RespuestaEstudianteEjercicio, Evaluacion, Tema } = require('../models');
const evaluacionController = require('./evaluacion.controller');
// Bloqueos en memoria por envío en curso (clave: estudianteId:ejercicioId)
const submissionLocks = new Map();
const umlValidator = require('../services/umlValidator');

// Crear ejercicio con su actividad base (herencia con transacción)
exports.createEjercicio = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { actividad, ejercicio } = req.body;

    // Validar contenido
    const contenidoExistente = await Contenido.findByPk(ejercicio.contenido_id, {
      include: [{ model: Tema, attributes: ['area_id'] }]
    });
    if (!contenidoExistente) {
      await t.rollback();
      return res.status(400).json({ message: "El contenido especificado no existe" });
    }

    if (req.docenteAreaId) {
      const areaId = contenidoExistente.Tema?.area_id;
      if (!areaId || parseInt(areaId, 10) !== parseInt(req.docenteAreaId, 10)) {
        await t.rollback();
        return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
      }
    }

    // Validar tipo_actividad_id
    if (!actividad || !actividad.tipo_actividad_id) {
      await t.rollback();
      return res.status(400).json({ message: "tipo_actividad_id es requerido en actividad" });
    }
    const tipoActividad = await TipoActividad.findByPk(actividad.tipo_actividad_id);
    if (!tipoActividad) {
      await t.rollback();
      return res.status(400).json({ message: "El tipo_actividad_id especificado no existe" });
    }

    // Crear la actividad primero
    const nuevaActividad = await Actividad.create(actividad, { transaction: t });

    // Crear el ejercicio usando el mismo id de la actividad
    // Validar tipo_ejercicio
    const TIPOS_PERMITIDOS = ['Compilador', 'Diagramas UML', 'Preguntas', 'Opción única', 'Ordenar', 'Relacionar'];
    const tipo = ejercicio.tipo_ejercicio || 'Compilador';
    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      await t.rollback();
      return res.status(400).json({ message: `tipo_ejercicio inválido. Use uno de: ${TIPOS_PERMITIDOS.join(', ')}` });
    }

    // Definir configuración por defecto si no viene
    let configuracion = ejercicio.configuracion || null;
    if (!configuracion) {
      if (tipo === 'Compilador') {
        configuracion = { tipo: 'programacion', esperado: ejercicio.resultado_ejercicio || '' };
      } else if (tipo === 'Diagramas UML') {
        configuracion = { opciones: { minClasses: 2, requireRelationships: false, requireMultiplicities: false } };
      } else if (tipo === 'Opción única') {
        configuracion = { tipo: 'opcion-unica', enunciado: '', opciones: [], respuestaCorrecta: '' };
      } else if (tipo === 'Ordenar') {
        configuracion = { tipo: 'ordenar', enunciado: '', items: [] };
      } else if (tipo === 'Relacionar') {
        configuracion = { tipo: 'relacionar', enunciado: '', pares: [] };
      } else {
        configuracion = { tipo: 'cuestionario', preguntas: [] };
      }
    }

    const nuevoEjercicio = await Ejercicio.create(
      {
        id: nuevaActividad.id, // herencia: mismo PK que Actividad
        contenido_id: ejercicio.contenido_id,
        tipo_ejercicio: tipo,
        puntos: ejercicio.puntos,
        resultado_ejercicio: ejercicio.resultado_ejercicio,
        configuracion
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
    let ejercicios = [];

    if (req.docenteAreaId) {
      const temas = await Tema.findAll({
        where: { area_id: req.docenteAreaId },
        attributes: ['id']
      });
      const temaIds = temas.map((tema) => tema.id);

      if (temaIds.length === 0) {
        return res.json([]);
      }

      const contenidos = await Contenido.findAll({
        where: { tema_id: temaIds },
        attributes: ['id']
      });
      const contenidoIds = contenidos.map((contenido) => contenido.id);

      if (contenidoIds.length === 0) {
        return res.json([]);
      }

      ejercicios = await Ejercicio.findAll({
        where: { contenido_id: contenidoIds },
        include: [
          { model: Actividad, as: 'actividad' },
          { model: Contenido }
        ]
      });
    } else {
      ejercicios = await Ejercicio.findAll({
        include: [
          { model: Actividad, as: 'actividad' },
          { model: Contenido }
        ]
      });
    }

    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los ejercicios", error: error.message || error });
  }
};

// Obtener un ejercicio por ID
exports.getEjercicioById = async (req, res) => {
  try {
    let ejercicio = null;

    if (req.docenteAreaId) {
      ejercicio = await Ejercicio.findByPk(req.params.id, {
        include: [
          { model: Actividad, as: 'actividad' },
          { model: Contenido, include: [{ model: Tema, attributes: ['area_id'] }] }
        ]
      });
      if (ejercicio?.Contenido?.Tema) {
        const areaId = ejercicio.Contenido.Tema.area_id;
        if (parseInt(areaId, 10) !== parseInt(req.docenteAreaId, 10)) {
          return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
        }
      }
    } else {
      ejercicio = await Ejercicio.findByPk(req.params.id, {
        include: [
          { model: Actividad, as: 'actividad' },
          { model: Contenido }
        ]
      });
    }

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

    if (req.docenteAreaId) {
      const contenidoActual = await Contenido.findByPk(ejercicio.contenido_id, {
        include: [{ model: Tema, attributes: ['area_id'] }]
      });
      const areaId = contenidoActual?.Tema?.area_id;
      if (!areaId || parseInt(areaId, 10) !== parseInt(req.docenteAreaId, 10)) {
        await t.rollback();
        return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
      }
    }

    const actividad = await Actividad.findByPk(req.params.id);
    if (!actividad) {
      await t.rollback();
      return res.status(404).json({ message: "Actividad asociada no encontrada" });
    }

    // Validar contenido si se envía
    if (req.body.ejercicio?.contenido_id) {
      const contenidoExistente = await Contenido.findByPk(req.body.ejercicio.contenido_id, {
        include: [{ model: Tema, attributes: ['area_id'] }]
      });
      if (!contenidoExistente) {
        await t.rollback();
        return res.status(400).json({ message: "El contenido especificado no existe" });
      }

      if (req.docenteAreaId) {
        const areaId = contenidoExistente.Tema?.area_id;
        if (!areaId || parseInt(areaId, 10) !== parseInt(req.docenteAreaId, 10)) {
          await t.rollback();
          return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
        }
      }
    }

    // Actualizar actividad y ejercicio en conjunto
    if (req.body.actividad) {
      // Si se provee un nuevo tipo_actividad_id, validarlo
      if (req.body.actividad.tipo_actividad_id) {
        const tipoAct = await TipoActividad.findByPk(req.body.actividad.tipo_actividad_id);
        if (!tipoAct) {
          await t.rollback();
          return res.status(400).json({ message: "El tipo_actividad_id especificado no existe" });
        }
      }
      await actividad.update(req.body.actividad, { transaction: t });
    }
    if (req.body.ejercicio) {
      const data = { ...req.body.ejercicio };
      if (data.tipo_ejercicio) {
        const TIPOS_PERMITIDOS = ['Compilador', 'Diagramas UML', 'Preguntas'];
        if (!TIPOS_PERMITIDOS.includes(data.tipo_ejercicio)) {
          await t.rollback();
          return res.status(400).json({ message: `tipo_ejercicio inválido. Use uno de: ${TIPOS_PERMITIDOS.join(', ')}` });
        }
      }
      await ejercicio.update(data, { transaction: t });
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

    if (req.docenteAreaId) {
      const contenidoActual = await Contenido.findByPk(ejercicio.contenido_id, {
        include: [{ model: Tema, attributes: ['area_id'] }]
      });
      const areaId = contenidoActual?.Tema?.area_id;
      if (!areaId || parseInt(areaId, 10) !== parseInt(req.docenteAreaId, 10)) {
        await t.rollback();
        return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
      }
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
    const { respuesta, respuestas } = req.body; // 'respuestas' para cuestionarios

    // Buscar el ejercicio
    const ejercicio = await Ejercicio.findByPk(ejercicioId);
    if (!ejercicio) {
      return res.status(404).json({ message: "Ejercicio no encontrado" });
    }

    // Rama por tipo de ejercicio
    if (ejercicio.tipo_ejercicio === 'Compilador') {
      // Compatibilidad: comparación simple por texto si usan este endpoint
      const normalizarTexto = (texto) =>
        (texto || '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ');

      const respuestaEstudiante = normalizarTexto(respuesta);
      const esperado = normalizarTexto(
        (ejercicio.configuracion && ejercicio.configuracion.esperado) || ejercicio.resultado_ejercicio
      );
      const esCorrecta = respuestaEstudiante === esperado;
      return res.json({
        ejercicioId,
        esCorrecta,
        puntosObtenidos: esCorrecta ? ejercicio.puntos : 0,
        retroalimentacion: esCorrecta
          ? '¡Respuesta correcta! Bien hecho.'
          : `Respuesta incorrecta. La salida esperada es: ${esperado}`
      });
    }

    // Evaluación para Diagramas UML
    if (ejercicio.tipo_ejercicio === 'Diagramas UML') {
      const { diagram, respuesta: respuestaBody } = req.body || {};
      const diagramPayload = diagram || (respuestaBody && respuestaBody.diagram);
      const cfg = ejercicio.configuracion || {};

      // Validaciones mínimas de entrada y reglas configuradas por el administrador
      if (!diagramPayload) {
        return res.status(400).json({ message: 'El campo "diagram" es requerido para resolver ejercicios UML.' });
      }
      if (!cfg.opciones || typeof cfg.opciones !== 'object') {
        return res.status(400).json({ message: 'Este ejercicio UML no tiene reglas configuradas (configuracion.opciones). Solicite al administrador que las establezca.' });
      }

      // Aplicar exclusivamente las reglas configuradas por el administrador en el ejercicio
      // Ignoramos opciones del request para evitar que el cliente relaje las validaciones
      const result = umlValidator.validate(diagramPayload, cfg.opciones);
      const esCorrecta = !!result.success;
      const puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
      return res.status(esCorrecta ? 200 : 400).json({
        ejercicioId,
        esCorrecta,
        puntosObtenidos,
        detalle: { errors: result.errors, warnings: result.warnings }
      });
    }

    // Opción única
    if (ejercicio.tipo_ejercicio === 'Opción única') {
      const cfg = ejercicio.configuracion || { tipo: 'opcion-unica', opciones: [], respuestaCorrecta: '' };
      const norm = (t) => (t || '').toString().trim();
      const recibido = norm(req.body?.respuesta?.opcion ?? req.body?.respuesta ?? '');
      const esperado = norm(cfg.respuestaCorrecta ?? '');
      const esCorrecta = recibido === esperado;
      return res.status(esCorrecta ? 200 : 400).json({
        ejercicioId,
        esCorrecta,
        puntosObtenidos: esCorrecta ? ejercicio.puntos : 0,
        retroalimentacion: esCorrecta ? '¡Correcto!' : 'Respuesta incorrecta.'
      });
    }

    // Ordenar
    if (ejercicio.tipo_ejercicio === 'Ordenar') {
      const cfg = ejercicio.configuracion || { tipo: 'ordenar', items: [] };
      const orden = req.body?.respuesta?.orden || [];
      const normArr = (arr) => (arr || []).map(x => (x || '').toString().trim());
      const esCorrecta = JSON.stringify(normArr(orden)) === JSON.stringify(normArr(cfg.items));
      return res.status(esCorrecta ? 200 : 400).json({
        ejercicioId,
        esCorrecta,
        puntosObtenidos: esCorrecta ? ejercicio.puntos : 0,
        retroalimentacion: esCorrecta ? 'Orden correcto.' : 'El orden no es correcto.'
      });
    }

    // Relacionar
    if (ejercicio.tipo_ejercicio === 'Relacionar') {
      const cfg = ejercicio.configuracion || { tipo: 'relacionar', pares: [] };
      const conceptos = (cfg.pares || []).map(p => p.concepto);
      const definiciones = (cfg.pares || []).map(p => p.definicion);
      let ok = true;
      const parejas = req.body?.respuesta?.parejas;
      const matches = req.body?.respuesta?.matches;
      if (Array.isArray(parejas)) {
        for (const pr of parejas) { if (pr.conceptoIndex !== pr.definicionIndex) { ok = false; break; } }
      } else if (matches) {
        for (const [c, d] of Object.entries(matches)) {
          const idx = conceptos.findIndex(x => x === c);
          if (idx < 0 || definiciones[idx] !== d) { ok = false; break; }
        }
      } else {
        ok = false;
      }
      const esCorrecta = ok;
      return res.status(esCorrecta ? 200 : 400).json({
        ejercicioId,
        esCorrecta,
        puntosObtenidos: esCorrecta ? ejercicio.puntos : 0,
        retroalimentacion: esCorrecta ? 'Relaciones correctas.' : 'Relaciones incorrectas.'
      });
    }

    // Evaluación para Preguntas (cuestionario)
    const cfg = ejercicio.configuracion || { tipo: 'cuestionario', preguntas: [] };
    if (cfg.tipo !== 'cuestionario') {
      return res.status(400).json({ message: 'Configuración inválida para evaluación no programática.' });
    }

    // Esperamos 'respuestas' como { [preguntaId]: valor }
    const mapaRespuestas = respuestas || {};
    let total = cfg.preguntas?.length || 0;
    let correctas = 0;
    const detalle = [];

    (cfg.preguntas || []).forEach((p) => {
      const recibido = mapaRespuestas[p.id];
      let ok = false;
      if (p.tipo === 'opcion-multiple') {
        ok = recibido === p.respuesta_correcta;
      } else if (p.tipo === 'abierta') {
        const norm = (t) => (t || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
        ok = norm(recibido) === norm(p.respuesta_correcta);
      }
      if (ok) correctas += 1;
      detalle.push({ preguntaId: p.id, correcta: ok, recibido });
    });

    const esCorrecta = total > 0 && correctas === total;
    const puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
    return res.json({
      ejercicioId,
      esCorrecta,
      totalPreguntas: total,
      correctas,
      puntosObtenidos,
      detalle,
      retroalimentacion: esCorrecta
        ? '¡Excelente! Todas las respuestas son correctas.'
        : `Correctas ${correctas}/${total}. Revise las respuestas.`
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

// Enviar respuesta de estudiante: guarda intento y evalúa
exports.enviarRespuestaEjercicio = async (req, res) => {
  try {
    const { ejercicioId } = req.params;
    const { estudiante_id, respuesta } = req.body;

    const ejercicio = await Ejercicio.findByPk(ejercicioId);
    if (!ejercicio) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' });
    }

    const codigo = req.body?.codigo || req.body?.respuesta?.codigo || req.body?.respuesta?.texto;
    const respuestaVacia = typeof respuesta === 'undefined' || respuesta === null;
    if (!estudiante_id) {
      return res.status(400).json({ message: 'Faltan campos: estudiante_id' });
    }
    if (ejercicio.tipo_ejercicio !== 'Compilador' && respuestaVacia) {
      return res.status(400).json({ message: 'Faltan campos: respuesta' });
    }
    if (ejercicio.tipo_ejercicio === 'Compilador' && !codigo) {
      return res.status(400).json({ message: 'Faltan campos: codigo' });
    }

    const key = `${estudiante_id}:${ejercicioId}`;
    if (submissionLocks.get(key)) {
      return res.status(429).json({ message: 'Evaluación en curso, intenta nuevamente en unos segundos.' });
    }
    submissionLocks.set(key, true);

    // Bloquear nuevos intentos si ya está aprobado
    const evaluacionAprobada = await Evaluacion.findOne({
      where: { estudiante_id, ejercicio_id: parseInt(ejercicioId, 10), estado: 'Aprobado' }
    });
    if (evaluacionAprobada) {
      submissionLocks.delete(key);
      return res.status(409).json({
        message: 'Ejercicio ya aprobado para el estudiante',
        evaluacionId: evaluacionAprobada.id
      });
    }

    // Para compilador, delegamos en el controlador de evaluación
    if (ejercicio.tipo_ejercicio === 'Compilador') {
      if (!req.body.ejercicio_id) req.body.ejercicio_id = parseInt(ejercicioId, 10);
      submissionLocks.delete(key);
      return evaluacionController.evaluarCompilador(req, res);
    }

    // Normalizar respuesta para evaluación (se guarda sólo si es correcta)
    const respuestaPayload = typeof respuesta === 'string' ? { texto: respuesta } : respuesta;

    // Evaluar usando la misma lógica de resolver
    let esCorrecta = false;
    let puntosObtenidos = 0;
    let detalle = undefined;
    let retroalimentacion = undefined;

    if (ejercicio.tipo_ejercicio === 'Diagramas UML') {
      const diagramPayload = req.body.diagram || respuestaPayload?.diagram;
      const cfg = ejercicio.configuracion || {};
      if (!diagramPayload) {
        submissionLocks.delete(key);
        return res.status(400).json({ message: 'El campo "diagram" es requerido para resolver ejercicios UML.' });
      }
      if (!cfg.opciones || typeof cfg.opciones !== 'object') {
        submissionLocks.delete(key);
        return res.status(400).json({ message: 'Este ejercicio UML no tiene reglas configuradas (configuracion.opciones). Solicite al administrador que las establezca.' });
      }
      const result = require('../services/umlValidator').validate(diagramPayload, cfg.opciones);
      esCorrecta = !!result.success;
      puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
      detalle = { errors: result.errors, warnings: result.warnings };
    } else if (ejercicio.tipo_ejercicio === 'Opción única') {
      // Config: { enunciado, opciones: string[], respuestaCorrecta: string }
      const cfg = ejercicio.configuracion || { tipo: 'opcion-unica', opciones: [], respuestaCorrecta: '' };
      const norm = (t) => (t || '').toString().trim();
      const recibido = norm(respuestaPayload?.opcion ?? respuestaPayload?.respuesta ?? '');
      const esperado = norm(cfg.respuestaCorrecta ?? '');
      esCorrecta = recibido === esperado;
      puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
      retroalimentacion = esCorrecta ? '¡Correcto!' : 'Respuesta incorrecta.';
    } else if (ejercicio.tipo_ejercicio === 'Ordenar') {
      // Config: { enunciado, items: string[] } en orden correcto
      const cfg = ejercicio.configuracion || { tipo: 'ordenar', items: [] };
      const orden = respuestaPayload?.orden || [];
      const normArr = (arr) => (arr || []).map(x => (x || '').toString().trim());
      esCorrecta = JSON.stringify(normArr(orden)) === JSON.stringify(normArr(cfg.items));
      puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
      retroalimentacion = esCorrecta ? 'Orden correcto.' : 'El orden no es correcto.';
    } else if (ejercicio.tipo_ejercicio === 'Relacionar') {
      // Config: { enunciado, pares: [{ concepto, definicion }] }
      const cfg = ejercicio.configuracion || { tipo: 'relacionar', pares: [] };
      const conceptos = (cfg.pares || []).map(p => p.concepto);
      const definiciones = (cfg.pares || []).map(p => p.definicion);
      let ok = true;
      if (Array.isArray(respuestaPayload?.parejas)) {
        // Parejas de índices: correcto si conceptoIndex === definicionIndex para cada par
        for (const pr of respuestaPayload.parejas) {
          if (pr.conceptoIndex !== pr.definicionIndex) { ok = false; break; }
        }
      } else if (respuestaPayload?.matches) {
        // matches: { concepto: definicion }
        for (const [c, d] of Object.entries(respuestaPayload.matches)) {
          const idx = conceptos.findIndex(x => x === c);
          if (idx < 0 || definiciones[idx] !== d) { ok = false; break; }
        }
      } else {
        ok = false;
      }
      esCorrecta = ok;
      puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
      retroalimentacion = esCorrecta ? 'Relaciones correctas.' : 'Relaciones incorrectas.';
    } else {
      // Preguntas (cuestionario)
      const cfg = ejercicio.configuracion || { tipo: 'cuestionario', preguntas: [] };
      if (cfg.tipo !== 'cuestionario') {
        submissionLocks.delete(key);
        return res.status(400).json({ message: 'Configuración inválida para evaluación no programática.' });
      }
      const mapaRespuestas = (respuestaPayload && respuestaPayload.respuestas) || {};
      let total = cfg.preguntas?.length || 0;
      let correctas = 0;
      detalle = [];
      (cfg.preguntas || []).forEach((p) => {
        const recibido = mapaRespuestas[p.id];
        let ok = false;
        if (p.tipo === 'opcion-multiple') {
          ok = recibido === p.respuesta_correcta;
        } else if (p.tipo === 'abierta') {
          const norm = (t) => (t || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
          ok = norm(recibido) === norm(p.respuesta_correcta);
        }
        if (ok) correctas += 1;
        detalle.push({ preguntaId: p.id, correcta: ok, recibido });
      });
      esCorrecta = total > 0 && correctas === total;
      puntosObtenidos = esCorrecta ? ejercicio.puntos : 0;
      retroalimentacion = esCorrecta
        ? '¡Excelente! Todas las respuestas son correctas.'
        : `Correctas ${correctas}/${total}. Revise las respuestas.`;
    }

    if (esCorrecta) {
      // Guardar intento solo si es correcto y registrar evaluación Aprobado
      const intento = await RespuestaEstudianteEjercicio.create({
        respuesta: respuestaPayload,
        estudiante_id,
        ejercicio_id: parseInt(ejercicioId, 10),
        estado: 'ENVIADO'
      });
      const evalWhere = { estudiante_id, ejercicio_id: parseInt(ejercicioId, 10) };
      const existenteEval = await Evaluacion.findOne({ where: evalWhere });
      const payloadEval = {
        calificacion: puntosObtenidos,
        retroalimentacion: retroalimentacion || null,
        estudiante_id,
        ejercicio_id: parseInt(ejercicioId, 10),
        estado: 'Aprobado'
      };
      if (existenteEval) {
        await existenteEval.update(payloadEval);
      } else {
        await Evaluacion.create(payloadEval);
      }
      submissionLocks.delete(key);
      return res.status(200).json({
        intentoId: intento.id,
        ejercicioId,
        esCorrecta,
        puntosObtenidos,
        detalle,
        retroalimentacion
      });
    }

    // Incorrecta: no se persiste intento ni evaluación; se libera el lock y se permite reintentar
    submissionLocks.delete(key);
    return res.status(400).json({
      ejercicioId,
      esCorrecta,
      puntosObtenidos,
      detalle,
      retroalimentacion
    });
  } catch (error) {
    // Liberar lock en caso de error
    try {
      const { ejercicioId } = req.params;
      const { estudiante_id } = req.body || {};
      if (estudiante_id && ejercicioId) submissionLocks.delete(`${estudiante_id}:${ejercicioId}`);
    } catch {}
    res.status(500).json({
      message: 'Error al enviar la respuesta del ejercicio',
      error: error.message || error
    });
  }
};

