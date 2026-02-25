const { RespuestaEstudianteMiniproyecto, Estudiante, Miniproyecto, Evaluacion } = require("../models");

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

const extractDates = (text = '') => {
  const matches = text.toString().match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/g) || [];
  return matches
    .map((value) => {
      if (/\d{4}-\d{2}-\d{2}/.test(value)) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      }
      if (/\d{2}\/\d{2}\/\d{4}/.test(value)) {
        const [day, month, year] = value.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        return Number.isNaN(date.getTime()) ? null : date;
      }
      return null;
    })
    .filter(Boolean);
};

const normalizeNumberString = (value = '') => {
  let normalized = value.replace(/[^0-9.,]/g, '');
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount > 1) {
      normalized = normalized.replace(/\./g, '');
    } else if (dotCount === 1 && /\d+\.\d{3}$/.test(normalized)) {
      normalized = normalized.replace(/\./g, '');
    }
  }
  return normalized;
};

const normalizeIntegerString = (value = '') =>
  value.replace(/[^0-9]/g, '');

const extractLabeledNumber = (text = '', label = '') => {
  const safeText = text.toString().replace(/\u00A0/g, ' ');
  const regex = new RegExp(`${label}\s*:?\s*[\$€£]?\s*([0-9.,]+)`, 'i');
  const match = safeText.match(regex);
  if (!match || !match[1]) return null;
  const normalized = normalizeNumberString(match[1]);
  const value = Number(normalized);
  return Number.isNaN(value) ? null : value;
};

const extractNumbersFromText = (text = '') => {
  const safeText = text.toString().replace(/\u00A0/g, ' ');
  const matches = safeText.match(/[0-9][0-9.,]*/g) || [];
  return matches
    .map((value) => Number(normalizeNumberString(value)))
    .filter((value) => !Number.isNaN(value));
};

const numberWithinTolerance = (expected, actual, toleranceRatio = 0.2) => {
  if (expected === null || actual === null) return false;
  if (expected === 0) return actual === 0;
  const diff = Math.abs(expected - actual);
  return diff / expected <= toleranceRatio;
};

const daysBetween = (a, b) => Math.abs(Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));

const datesAreConcordant = (expectedText = '', studentText = '', toleranceDays = 3) => {
  const expectedDates = extractDates(expectedText);
  const studentDates = extractDates(studentText);
  if (expectedDates.length === 0 || studentDates.length === 0) return false;

  const expectedStart = expectedDates[0];
  const expectedEnd = expectedDates[1];
  const studentStart = studentDates[0];
  const studentEnd = studentDates[1];

  const startOk = expectedStart && studentStart
    ? daysBetween(expectedStart, studentStart) <= toleranceDays
    : false;
  const endOk = expectedEnd && studentEnd
    ? daysBetween(expectedEnd, studentEnd) <= toleranceDays
    : false;

  if (expectedStart && expectedEnd && studentStart && studentEnd) {
    if (expectedStart > expectedEnd) return false;
    return startOk && endOk;
  }

  return startOk || endOk;
};

const isTotalLine = (text = '') => normalizeText(text).includes('total general');

const extractTotalGeneral = (items = []) => {
  const totalLine = items.find(item => typeof item === 'string' && isTotalLine(item));
  if (!totalLine) return null;
  const safeText = totalLine.toString().replace(/\u00A0/g, ' ');
  const regex = /total\s*general\s*:?\s*[\$€£]?\s*([0-9.,]+)/i;
  const match = safeText.match(regex);
  if (!match || !match[1]) return null;
  const normalized = normalizeIntegerString(match[1]);
  const value = Number(normalized);
  return Number.isNaN(value) ? null : value;
};

const computeCostsTotal = (items = []) => {
  let total = 0;
  let hasAny = false;
  items.forEach((item) => {
    if (!item || isTotalLine(item)) return;
    if (typeof item === 'object') {
      const qtyRaw = item.quantity ?? item.cantidad ?? null;
      const unitRaw = item.unitCost ?? item.costoUnitario ?? null;
      const qty = qtyRaw !== null ? Number(normalizeNumberString(String(qtyRaw))) : null;
      const unit = unitRaw !== null ? Number(normalizeNumberString(String(unitRaw))) : null;
      if (qty !== null && unit !== null && !Number.isNaN(qty) && !Number.isNaN(unit)) {
        total += qty * unit;
        hasAny = true;
        return;
      }
      if (typeof item.descripcion === 'string') {
        const parsed = parseCostItem(item.descripcion);
        if (parsed.quantity !== null && parsed.unit !== null) {
          total += parsed.quantity * parsed.unit;
          hasAny = true;
        } else {
          const numbers = extractNumbersFromText(item.descripcion);
          if (numbers.length >= 2) {
            total += numbers[0] * numbers[1];
            hasAny = true;
          }
        }
      }
      return;
    }
    const subtotal = extractLabeledNumber(item, 'Subtotal');
    if (subtotal !== null) {
      total += subtotal;
      hasAny = true;
      return;
    }
    const qty = extractLabeledNumber(item, 'Cantidad');
    const unit = extractLabeledNumber(item, 'Costo unitario');
    if (qty !== null && unit !== null) {
      total += qty * unit;
      hasAny = true;
      return;
    }
    const numbers = extractNumbersFromText(item);
    if (numbers.length >= 2) {
      total += numbers[0] * numbers[1];
      hasAny = true;
    }
  });
  return hasAny ? total : null;
};

const computeCostsTotalFromText = (text = '') => {
  if (!text) return null;
  const lines = text.toString().split(/\n|,/).map(t => t.trim()).filter(Boolean);
  return computeCostsTotal(lines);
};

const normalizeCostItemsToStrings = (items = []) =>
  items.map((item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    const qty = item.quantity ?? item.cantidad ?? '';
    const unit = item.unitCost ?? item.costoUnitario ?? '';
    const concept = item.concept ?? item.concepto ?? item.descripcion ?? '';
    return `Concepto: ${concept} | Cantidad: ${qty} | Costo unitario: ${unit}`;
  }).filter(Boolean);

const computeCostsTotalSafe = (items = []) => {
  const normalizedItems = normalizeCostItemsToStrings(items);
  let total = extractTotalGeneral(normalizedItems) ?? computeCostsTotal(normalizedItems);
  if (total === null) {
    total = computeCostsTotalFromText(normalizedItems.join(', '));
  }
  if (total !== null && total < 1000) {
    const fallback = computeCostsTotalFromText(normalizedItems.join(', '));
    if (fallback && fallback >= 1000) {
      total = fallback;
    }
  }
  return total;
};

const parseCostItem = (text = '') => {
  const normalized = normalizeText(text);
  const concept = normalized
    .replace(/costo\s*\d*:?/g, '')
    .split('|')[0]
    .replace(/tipo:.*/g, '')
    .trim();
  const type = normalized.includes('material') ? 'material'
    : normalized.includes('humano') ? 'humano'
    : null;
  const quantity = extractLabeledNumber(text, 'Cantidad');
  const unit = extractLabeledNumber(text, 'Costo unitario');
  return { concept, type, quantity, unit };
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
      const expectedArray = Array.isArray(section.expected) ? section.expected : null;
      const studentArray = Array.isArray(section.student) ? section.student : null;

      if (expectedArray && studentArray) {
        const expectedItems = expectedArray
          .map(item => item?.toString?.() ?? '')
          .filter(Boolean)
          .filter(item => !(section.label === 'Costos y recursos' && isTotalLine(item)));
        const studentItems = studentArray
          .map(item => item?.toString?.() ?? '')
          .filter(Boolean)
          .filter(item => !(section.label === 'Costos y recursos' && isTotalLine(item)));

        const matchesPerItem = expectedItems.map((expectedItem) => {
          const keywords = extractKeywords(expectedItem);
          if (keywords.length === 0) return false;
          return studentItems.some((studentItem) => {
            const normalizedStudent = normalizeText(studentItem);
            const matches = keywords.filter(keyword => normalizedStudent.includes(keyword)).length;
            const minRequired = Math.ceil((keywords.length || 0) * 0.5);
            const keywordMatch = matches >= minRequired && minRequired > 0;

            if (section.label === 'Cronograma del proyecto') {
              const expectedDates = extractDates(expectedItem);
              const studentDates = extractDates(studentItem);
              if (expectedDates.length === 0 || studentDates.length === 0) {
                return keywordMatch;
              }
              if (expectedDates.length >= 2 && expectedDates[0] > expectedDates[1]) {
                return keywordMatch;
              }
              const dateMatch = datesAreConcordant(expectedItem, studentItem, 3);
              return keywordMatch && dateMatch;
            }

            return keywordMatch;
          });
        });

        const matchedCount = matchesPerItem.filter(Boolean).length;
        const requiredItems = Math.max(1, Math.ceil(expectedItems.length * 0.7));

        if (section.label === 'Costos y recursos') {
          const expectedRaw = expectedArray.filter(Boolean);
          const studentRaw = studentArray.filter(Boolean);
          const expectedTotal = computeCostsTotalSafe(expectedRaw);
          const studentTotal = computeCostsTotalSafe(studentRaw);
          if (expectedTotal !== null && studentTotal !== null) {
            const diffRatio = Math.abs(expectedTotal - studentTotal) / expectedTotal;
            console.log('[COSTOS] Total esperado vs estudiante:', {
              esperado: expectedTotal,
              estudiante: studentTotal,
              diferencia: diffRatio
            });
            if (diffRatio > 0.30) {
              return { criterio: section.label, cumplido: false };
            }
          } else {
            console.log('[COSTOS] Total no disponible para validar:', {
              esperado: expectedTotal,
              estudiante: studentTotal,
              esperadoRaw: expectedRaw,
              estudianteRaw: studentRaw
            });
          }

          let conceptMisses = 0;
          let unitMisses = 0;

          expectedItems.forEach((expectedItem) => {
            const expectedParsedItem = parseCostItem(expectedItem);
            const expectedConceptKeywords = extractKeywords(expectedParsedItem.concept);
            const bestMatch = studentItems.find((studentItem) => {
              const studentParsedItem = parseCostItem(studentItem);
              const conceptMatches = expectedConceptKeywords.filter(keyword => studentParsedItem.concept.includes(keyword)).length;
              const conceptRequired = Math.ceil((expectedConceptKeywords.length || 0) * 0.5);
              return expectedConceptKeywords.length === 0 ? true : conceptMatches >= conceptRequired;
            });

            if (!bestMatch) {
              console.log('[COSTOS] Concepto NO coincide:', { esperado: expectedItem });
              conceptMisses += 1;
              unitMisses += 1;
              return;
            }

            const studentParsedItem = parseCostItem(bestMatch);
            console.log('[COSTOS] Concepto OK:', {
              esperado: expectedItem,
              estudiante: bestMatch
            });
            if (expectedParsedItem.unit !== null) {
              if (studentParsedItem.unit === null || !numberWithinTolerance(expectedParsedItem.unit, studentParsedItem.unit, 0.2)) {
                console.log('[COSTOS] Costo unitario NO coincide:', {
                  esperado: expectedParsedItem.unit,
                  estudiante: studentParsedItem.unit
                });
                unitMisses += 1;
              } else {
                console.log('[COSTOS] Costo unitario OK:', {
                  esperado: expectedParsedItem.unit,
                  estudiante: studentParsedItem.unit
                });
              }
            }
          });

          if (conceptMisses >= 2 || unitMisses >= 2) {
            return { criterio: section.label, cumplido: false };
          }
        }

        return { criterio: section.label, cumplido: matchedCount >= requiredItems };
      }

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

const upsertEvaluacionMiniproyecto = async ({ estudianteId, miniproyectoId, evaluacion, estadoSolicitud }) => {
  if (!evaluacion || !estudianteId || !miniproyectoId) return;
  if (estadoSolicitud !== 'COMPLETADO') return;

  const calificacion = Number.isFinite(evaluacion.puntaje) ? evaluacion.puntaje : 0;
  const estadoEvaluacion = calificacion >= 70 ? 'APROBADO' : 'REPROBADO';

  const existing = await Evaluacion.findOne({
    where: { estudiante_id: estudianteId, miniproyecto_id: miniproyectoId }
  });

  if (existing) {
    await existing.update({
      calificacion,
      estado: estadoEvaluacion,
      fecha_evaluacion: new Date()
    });
    return;
  }

  await Evaluacion.create({
    calificacion,
    estado: estadoEvaluacion,
    estudiante_id: estudianteId,
    miniproyecto_id: miniproyectoId
  });
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

    const evalExistente = await Evaluacion.findOne({
      where: { estudiante_id, miniproyecto_id, estado: 'APROBADO' }
    });
    if (evalExistente) {
      return res.status(409).json({
        mensaje: 'Miniproyecto ya aprobado para el estudiante'
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
        studentResponseValue.requisitosNoFuncionales,
        studentResponseValue.alcance,
        studentResponseValue.cronograma,
        studentResponseValue.costos
      ]
        .filter(Boolean)
        .join(' ');
    } else {
      studentResponseText = studentResponseValue || '';
    }

    const evaluacion = evaluateResponse(studentResponseValue, miniproyecto.respuesta_miniproyecto);
    await upsertEvaluacionMiniproyecto({
      estudianteId: estudiante_id,
      miniproyectoId: miniproyecto_id,
      evaluacion,
      estadoSolicitud: estado
    });
    const respuestaPayload = JSON.stringify({
      respuestaEstudiante: studentResponseValue,
      resumen: studentResponseText,
      evaluacion
    });

    if (respuestaExistente) {
      const contadorActual = Number.isFinite(respuestaExistente.contador)
        ? respuestaExistente.contador
        : 0;
      await respuestaExistente.update({
        respuesta: respuestaPayload,
        estado,
        contador: contadorActual + 1
      });
      return res.status(200).json(respuestaExistente);
    }

    const nuevaRespuesta = await RespuestaEstudianteMiniproyecto.create({
      respuesta: respuestaPayload,
      estudiante_id,
      miniproyecto_id,
      estado,
      contador: 1,
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
          studentResponseValue.requisitosNoFuncionales,
          studentResponseValue.alcance,
          studentResponseValue.cronograma,
          studentResponseValue.costos
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
      const targetEstudianteId = estudiante_id || respuestaRegistro.estudiante_id;
      const estadoSolicitud = estado || respuestaRegistro.estado;
      await upsertEvaluacionMiniproyecto({
        estudianteId: targetEstudianteId,
        miniproyectoId: targetMiniproyectoId,
        evaluacion,
        estadoSolicitud
      });
      respuestaPayload = JSON.stringify({
        respuestaEstudiante: studentResponseValue,
        resumen: studentResponseText,
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


module.exports = {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
  verificarMiniproyectoCompletado
};
