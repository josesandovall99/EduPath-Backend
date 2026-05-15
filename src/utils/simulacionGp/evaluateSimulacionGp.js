const { VARIANTES } = require('./defaults');

const CUADRANTES = ['gestionar_cerca', 'mantener_satisfecho', 'mantener_informado', 'monitorear'];

/**
 * @param {object} ejercicio - fila Ejercicio Sequelize o equivalente { configuracion, puntos }
 * @param {object} answerObj - payload del estudiante (sin envolver en respuesta)
 */
function evaluateSimulacionGp(ejercicio, answerObj) {
  const cfg = ejercicio.configuracion || {};
  const variante = cfg.variante;
  const spec = cfg.spec || {};
  const puntosEjercicio = Number(ejercicio.puntos) || 0;

  if (cfg.tipo !== 'simulacion-gp' || !VARIANTES.includes(variante)) {
    return {
      esCorrecta: false,
      puntosObtenidos: 0,
      retroalimentacion:
        'El ejercicio no está configurado como simulación GP válida (tipo simulacion-gp y variante esperada).',
      detalle: { configuracionInvalida: true },
    };
  }

  const answer = answerObj && typeof answerObj === 'object' ? answerObj : {};

  try {
    if (variante === 'mapa_poder') {
      const placements = answer.placements || {};
      const expected = spec.solucion || {};
      const ids = Array.isArray(spec.stakeholders)
        ? spec.stakeholders.map((s) => String(s.id))
        : Object.keys(expected);
      const errores = [];

      for (const id of ids) {
        const got = placements[id];
        const exp = expected[id];
        if (exp == null) continue;
        if (!CUADRANTES.includes(got)) {
          errores.push({ id, mensaje: `Cuadrante inválido o faltante para ${id}.` });
          continue;
        }
        if (got !== exp) {
          const fb =
            (spec.feedback && spec.feedback[id] && spec.feedback[id][got]) ||
            `Ejerce de nuevo el mapa de poder/interés: la posición de "${id}" no es la adecuada.`;
          errores.push({ id, mensaje: fb });
        }
      }

      const esCorrecta = errores.length === 0;
      return {
        esCorrecta,
        puntosObtenidos: esCorrecta ? puntosEjercicio : 0,
        retroalimentacion: esCorrecta
          ? '¡Excelente! Todos los interesados están en el cuadrante correcto.'
          : errores.map((e) => e.mensaje).join(' '),
        detalle: { errores },
      };
    }

    if (variante === 'edt') {
      const tareas = spec.tareas || [];
      const errores = [];
      const slotFill = answer.slotFill && typeof answer.slotFill === 'object' ? answer.slotFill : {};
      const useSlots = Object.keys(slotFill).length > 0;

      if (useSlots) {
        for (const t of tareas) {
          if (!t || t.parentCorrect == null) continue;
          const tid = String(t.id);
          const got = slotFill[tid] != null ? String(slotFill[tid]) : '';
          if (got !== tid) {
            errores.push({
              id: tid,
              mensaje: `En la casilla de la EDT que corresponde a «${t.titulo || tid}» no está el paquete o entregable correcto.`,
            });
          }
        }
      } else {
        const parentById = answer.parentById || {};
        for (const t of tareas) {
          if (!t || t.parentCorrect == null) continue;
          const tid = String(t.id);
          const got = parentById[tid] != null ? String(parentById[tid]) : '';
          const exp = String(t.parentCorrect);
          if (got !== exp) {
            errores.push({
              id: tid,
              mensaje: `La tarea "${t.titulo || tid}" debe colgarse bajo el entregable/padre correcto según la EDT.`,
            });
          }
        }
      }

      const esCorrecta = errores.length === 0;
      return {
        esCorrecta,
        puntosObtenidos: esCorrecta ? puntosEjercicio : 0,
        retroalimentacion: esCorrecta
          ? 'Estructura EDT correcta (jerarquía alineada al proyecto).'
          : errores.map((e) => e.mensaje).join(' '),
        detalle: { errores, modo: useSlots ? 'slotFill' : 'parentById' },
      };
    }
  } catch (e) {
    return {
      esCorrecta: false,
      puntosObtenidos: 0,
      retroalimentacion: 'Error evaluando la simulación.',
      detalle: { error: String(e && e.message ? e.message : e) },
    };
  }

  return {
    esCorrecta: false,
    puntosObtenidos: 0,
    retroalimentacion: 'Variante no reconocida.',
    detalle: {},
  };
}

module.exports = {
  evaluateSimulacionGp,
  extractSimulacionAnswer(reqBody) {
    if (!reqBody || typeof reqBody !== 'object') return {};
    if (reqBody.respuesta && typeof reqBody.respuesta === 'object') return reqBody.respuesta;
    return reqBody;
  },
};
