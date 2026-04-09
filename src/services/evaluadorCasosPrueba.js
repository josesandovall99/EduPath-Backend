/**
 * Servicio para evaluar ejercicios Java usando exclusivamente Judge0.
 * Cada caso de prueba contiene:
 * - inputs: string con valores usados para los parámetros del método
 * - output: string con salida esperada
 */

const axios = require('axios');
const { codificar, decodificar, normalizarSalida } = require('../utils/juez');
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
  return ejecutarConJudge0(codigoParaEnviar);
}

async function ejecutarConJudge0(codigoParaEnviar) {
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
    stdin: codificar('')
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

module.exports = {
  Judge0TechnicalError,
  validarEstructuraCasosPrueba,
  ejecutarCasoPrueba,
  evaluarCasosPrueba
};
