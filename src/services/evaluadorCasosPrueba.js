/**
 * Servicio para evaluar ejercicios Java usando exclusivamente Judge0.
 * Cada caso de prueba contiene:
 * - inputs: string con valores usados para los parámetros del método
 * - output: string con salida esperada
 */

const axios = require('axios');
const { codificar, decodificar, normalizarSalida, normalizarSalidaMvc } = require('../utils/juez');
const { wrapJavaCodeForJudge0 } = require('../utils/javaWrapper');

const JAVA_LANGUAGE_ID = 62;
const JUDGE0_TIMEOUT_MS = 15000;

class Judge0TechnicalError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'Judge0TechnicalError';
    this.isTechnicalExecutionError = true;
    this.statusCode = options.statusCode || 502;
    this.details = options.details;
  }
}

function validarEstructuraCasosPrueba(casosPrueba) {
  const errores = [];

  if (!Array.isArray(casosPrueba)) {
    errores.push('Los casos de prueba deben ser un array');
    return { valido: false, errores };
  }

  if (casosPrueba.length !== 3) {
    errores.push(`Se requieren exactamente 3 casos de prueba. Encontrados: ${casosPrueba.length}`);
  }

  casosPrueba.forEach((caso, indice) => {
    if (!caso || typeof caso !== 'object') {
      errores.push(`Caso ${indice + 1}: debe ser un objeto {inputs, output}`);
      return;
    }
    if (typeof caso.inputs !== 'string') {
      errores.push(`Caso ${indice + 1}: "inputs" debe ser un string`);
    }
    if (typeof caso.output !== 'string') {
      errores.push(`Caso ${indice + 1}: "output" debe ser un string`);
    }
  });

  return {
    valido: errores.length === 0,
    errores
  };
}

async function ejecutarCasoPrueba(codigo, inputs, lenguajeId, metodo) {
  if (lenguajeId !== JAVA_LANGUAGE_ID) {
    return {
      stdout: '',
      stderr: 'Solo se admite Java para la evaluacion automatica de ejercicios.',
      code: null,
      statusId: null,
      statusDescription: 'Lenguaje no soportado',
      success: false
    };
  }

  const codigoParaEnviar = wrapJavaCodeForJudge0(codigo, metodo, inputs);
  return ejecutarConJudge0(codigoParaEnviar, inputs);
}

/**
 * Convierte inputs del docente (comas o espacios) en stdin con saltos de línea
 * para que sc.nextInt(), sc.nextLine(), etc. lean correctamente en secuencia.
 * Ejemplo: "5,3"  →  "5\n3"
 *          "hola mundo" → "hola\nmundo"  (si hay espacios simples sin comas)
 *          "Hola Mundo,42" → "Hola Mundo\n42"  (líneas completas separadas por coma)
 */
function normalizarStdin(inputs) {
  const raw = (inputs || '').toString().trim();
  if (!raw) return '';
  // Si ya tiene saltos de línea, respetarlos
  if (/\r?\n/.test(raw)) {
    // Asegurar salto final para evitar NoSuchElementException en Scanner.nextLine()
    return raw.endsWith('\n') ? raw : raw + '\n';
  }
  // Separar por coma → cada token es una línea de stdin
  const out = raw.split(',').map((t) => t.trim()).filter(Boolean).join('\n');
  return out ? `${out}\n` : '';
}

/**
 * Reconstruye una salida "interactiva" agregando los valores de entrada
 * detrás de prompts que terminan en ":" para comparar con expected del docente.
 * Esto evita falsos negativos cuando Judge0 no hace echo del stdin.
 */
function interleaveInputsWithOutput(output, inputs) {
  const textoSalida = (output || '').toString();
  const textoInputs = (inputs || '').toString();
  if (!textoSalida || !textoInputs) return textoSalida;

  const inputValues = textoInputs
    .split(/,|\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (inputValues.length === 0) return textoSalida;

  let index = 0;
  return textoSalida
    .split('\n')
    .map((line) => {
      if (/:\s*$/.test(line.trimEnd()) && index < inputValues.length) {
        return line.trimEnd() + inputValues[index++];
      }
      return line;
    })
    .join('\n');
}

async function ejecutarCasoPruebaMvc(codigoFusionado, inputs) {
  const judge0Url = process.env.JUDGE0_URL?.trim();
  const judge0Key = process.env.JUDGE0_KEY?.trim();
  if (!judge0Url) {
    throw new Judge0TechnicalError('JUDGE0_URL no esta configurado.', { statusCode: 500 });
  }
  const url = `${judge0Url.replace(/\/+$/, '')}/submissions?base64_encoded=true&wait=true`;
  const headers = { 'Content-Type': 'application/json' };
  if (judge0Key) headers['X-Auth-Token'] = judge0Key;
  const payload = {
    source_code: codificar(codigoFusionado),
    language_id: JAVA_LANGUAGE_ID,
    stdin: codificar(normalizarStdin(inputs))
  };
  try {
    const response = await axios.post(url, payload, { headers, timeout: JUDGE0_TIMEOUT_MS });
    const data = response.data || {};
    const stdout = decodificar(data.stdout);
    const stderr = decodificar(data.stderr);
    const compileOutput = decodificar(data.compile_output);
    const statusId = typeof data.status?.id === 'number' ? data.status.id : null;
    const errorSalida = stderr || compileOutput;
    return { stdout, stderr: errorSalida, code: statusId, statusId, statusDescription: data.status?.description || '', success: statusId === 3 && !errorSalida };
  } catch (error) {
    const status = error.response?.status;
    let mensaje = error.code === 'ECONNABORTED' ? 'Judge0 excedio el tiempo limite.' : (error.message || 'Error desconocido');
    throw new Judge0TechnicalError(`Error tecnico en Judge0: ${mensaje}`, { statusCode: status >= 400 ? status : 502 });
  }
}

async function evaluarCasosPruebaMvc(codigoFusionado, casosPrueba) {
  const resultados = [];
  let casoFallido = null;
  let errorTecnico = false;

  for (let i = 0; i < casosPrueba.length; i++) {
    const caso = casosPrueba[i];
    const caseNum = i + 1;
    try {
      const ejecucion = await ejecutarCasoPruebaMvc(codigoFusionado, caso.inputs);
      // Normalizar, pero para ejercicios interactivos MVC solemos mostrar un bloque
      // de resultados. Extraemos el bloque de "RESULTADOS" si existe para comparar
      // únicamente la sección relevante y evitar fallos por prompts/eco de inputs.
      const extractResultsBlock = (texto) => {
        if (!texto) return '';
        const match = texto.match(/[-]*\s*RESULTADOS\s*[-]*/i);
        if (!match) return texto;
        const idx = texto.toUpperCase().indexOf(match[0].toUpperCase());
        return idx >= 0 ? texto.slice(idx) : texto;
      };

      const salidaObtenidaRaw = ejecucion.stdout || '';
      const salidaEsperadaRaw = caso.output || '';
      const salidaComparable = interleaveInputsWithOutput(salidaObtenidaRaw, caso.inputs);

      const salidaObtenida = normalizarSalidaMvc(extractResultsBlock(salidaComparable));
      const salidaEsperada = normalizarSalidaMvc(extractResultsBlock(salidaEsperadaRaw));
      const ejecucionExitosa = ejecucion.success && !ejecucion.stderr;
      const paso = ejecucionExitosa && salidaObtenida === salidaEsperada;
      resultados.push({
        caseNum, inputs: caso.inputs, outputEsperado: caso.output,
        outputObtenido: ejecucion.stdout, paso, code: ejecucion.code,
        error: ejecucionExitosa ? (salidaObtenida !== salidaEsperada ? 'Salida no coincide.' : null) : (ejecucion.stderr || ejecucion.statusDescription),
        ejecutado: true, omitido: false
      });
      if (!paso) {
        casoFallido = caseNum;
        completarCasosOmitidos(resultados, casosPrueba, i + 1, 'Caso omitido porque un caso anterior no cumplió.');
        break;
      }
    } catch (error) {
      casoFallido = caseNum;
      errorTecnico = !!error.isTechnicalExecutionError;
      resultados.push({
        caseNum, inputs: caso.inputs, outputEsperado: caso.output, outputObtenido: '', paso: false, code: null,
        error: error.message || 'Error de ejecucion', ejecutado: true, omitido: false
      });
      completarCasosOmitidos(resultados, casosPrueba, i + 1, 'Caso omitido por error tecnico.');
      break;
    }
  }

  const aprobado = resultados.length === casosPrueba.length && resultados.every((r) => r.paso);
  return {
    aprobado, cumple: aprobado, resultados, casoFallido, errorTecnico, errorConfiguracion: false,
    resumen: aprobado ? `Todos los casos (${casosPrueba.length}) aprobados.` : `Caso ${casoFallido} fallido de ${casosPrueba.length}.`
  };
}

async function ejecutarConJudge0(codigoParaEnviar, stdinRaw) {
  const judge0Url = process.env.JUDGE0_URL?.trim();
  const judge0Key = process.env.JUDGE0_KEY?.trim();

  if (!judge0Url) {
    throw new Judge0TechnicalError('JUDGE0_URL no esta configurado. Define JUDGE0_URL en el archivo .env.', {
      statusCode: 500
    });
  }

  const url = `${judge0Url.replace(/\/+$/, '')}/submissions?base64_encoded=true&wait=true`;
  const payload = {
    source_code: codificar(codigoParaEnviar),
    language_id: JAVA_LANGUAGE_ID,
    stdin: codificar(normalizarStdin(stdinRaw))
  };

  const headers = { 'Content-Type': 'application/json' };
  if (judge0Key) {
    headers['X-Auth-Token'] = judge0Key;
  }

  try {
    const response = await axios.post(url, payload, {
      headers,
      timeout: JUDGE0_TIMEOUT_MS
    });
    const data = response.data || {};

    const stdout = decodificar(data.stdout);
    const stderr = decodificar(data.stderr);
    const compileOutput = decodificar(data.compile_output);
    const statusId = typeof data.status?.id === 'number' ? data.status.id : null;
    const statusDescription = data.status?.description || 'Respuesta de Judge0';
    const errorSalida = stderr || compileOutput;
    const success = statusId === 3 && !errorSalida;

    return {
      stdout,
      stderr: errorSalida,
      code: statusId,
      statusId,
      statusDescription,
      success
    };
  } catch (error) {
    const status = error.response?.status;
    const serverData = error.response?.data;
    let mensaje = error.message || 'Error desconocido';

    if (error.code === 'ECONNABORTED') {
      mensaje = 'Judge0 excedio el tiempo limite de respuesta.';
    } else if (status === 401) {
      mensaje = 'Judge0 rechazo la autenticacion configurada para la API.';
    } else if (status >= 500) {
      mensaje = 'Judge0 reporto un error interno al procesar la ejecucion.';
    } else if (serverData) {
      mensaje = JSON.stringify(serverData);
    }

    throw new Judge0TechnicalError(`Error tecnico en Judge0: ${mensaje}`, {
      statusCode: status >= 400 ? status : 502,
      details: serverData
    });
  }
}

function completarCasosOmitidos(resultados, casosPrueba, indiceInicio, motivo) {
  for (let i = indiceInicio; i < casosPrueba.length; i++) {
    const caso = casosPrueba[i];
    resultados.push({
      caseNum: i + 1,
      inputs: caso.inputs,
      outputEsperado: caso.output,
      outputObtenido: '',
      paso: false,
      code: null,
      error: motivo,
      ejecutado: false,
      omitido: true
    });
  }
}

async function evaluarCasosPrueba(codigo, lenguajeId, casosPrueba, metodo) {
  const validacion = validarEstructuraCasosPrueba(casosPrueba);
  if (!validacion.valido) {
    return {
      aprobado: false,
      cumple: false,
      resultado: null,
      resultados: [],
      resumen: `Configuración inválida: ${validacion.errores.join('; ')}`,
      falloEjecucion: false,
      errorTecnico: true,
      errorConfiguracion: true,
      casoFallido: null
    };
  }

  const resultados = [];
  let casoFallido = null;
  let errorTecnico = false;

  for (let i = 0; i < casosPrueba.length; i++) {
    const caso = casosPrueba[i];
    const caseNum = i + 1;

    try {
      const ejecucion = await ejecutarCasoPrueba(codigo, caso.inputs, lenguajeId, metodo);
      const salidaObtenida = normalizarSalida(ejecucion.stdout);
      const salidaEsperada = normalizarSalida(caso.output);
      const ejecucionExitosa = ejecucion.success && !ejecucion.stderr;
      const paso = ejecucionExitosa && salidaObtenida === salidaEsperada;

      resultados.push({
        caseNum,
        inputs: caso.inputs,
        outputEsperado: caso.output,
        outputObtenido: ejecucion.stdout,
        paso,
        code: ejecucion.code,
        error: ejecucionExitosa
          ? (salidaObtenida !== salidaEsperada ? 'Salida no coincide con el resultado esperado.' : null)
          : (ejecucion.stderr || ejecucion.statusDescription || `Codigo de salida ${ejecucion.code}`),
        ejecutado: true,
        omitido: false
      });

      if (!paso) {
        casoFallido = caseNum;
        completarCasosOmitidos(
          resultados,
          casosPrueba,
          i + 1,
          'Caso omitido porque un caso anterior no cumplio.'
        );
        break;
      }
    } catch (error) {
      casoFallido = caseNum;
      errorTecnico = !!error.isTechnicalExecutionError;
      resultados.push({
        caseNum,
        inputs: caso.inputs,
        outputEsperado: caso.output,
        outputObtenido: '',
        paso: false,
        code: null,
        error: error.isTechnicalExecutionError
          ? `Error tecnico de ejecucion: ${error.message}`
          : (error.message || 'Error de ejecucion desconocido'),
        ejecutado: true,
        omitido: false
      });

      completarCasosOmitidos(
        resultados,
        casosPrueba,
        i + 1,
        'Caso omitido porque la evaluacion se detuvo en un caso anterior.'
      );
      break;
    }
  }

  const casosEjecutados = resultados.filter((resultado) => resultado.ejecutado);
  const todosPasan = !errorTecnico
    && casosEjecutados.length === 3
    && casosEjecutados.every((resultado) => resultado.paso);

  let resumen = 'CUMPLE';
  if (errorTecnico) {
    resumen = `Error tecnico al ejecutar Judge0 en el caso ${casoFallido}.`;
  } else if (!todosPasan) {
    resumen = `NO CUMPLE: fallo el caso ${casoFallido}.`;
  }

  return {
    aprobado: todosPasan,
    cumple: todosPasan,
    resultado: todosPasan ? 'CUMPLE' : 'NO CUMPLE',
    resultados,
    resumen,
    falloEjecucion: errorTecnico,
    errorTecnico,
    errorConfiguracion: false,
    casoFallido
  };
}

// Ejecución libre MVC con stdin personalizado (para botón "Ejecutar" del estudiante)
async function ejecutarMvcLibre(codigoFusionado, stdinRaw) {
  return ejecutarCasoPruebaMvc(codigoFusionado, stdinRaw);
}

module.exports = {
  Judge0TechnicalError,
  validarEstructuraCasosPrueba,
  ejecutarCasoPrueba,
  evaluarCasosPrueba,
  evaluarCasosPruebaMvc,
  ejecutarMvcLibre
};
