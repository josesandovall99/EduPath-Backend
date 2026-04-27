const axios = require('axios');
const acorn = require('acorn');
const db = require('../models');
const { Evaluacion, Estudiante, Ejercicio, Miniproyecto, RespuestaEstudianteEjercicio } = db;
const evaluadorCasos = require('../services/evaluadorCasosPrueba');
const { normalizarCodigoJavaEstudiante, tieneMainJava } = require('../utils/javaWrapper');
const { normalizarConfiguracionCompilador, validarConfiguracionCompilador } = require('../utils/compilerExercise');

const JUDGE0_URL = process.env.JUDGE0_URL;
const JUDGE0_KEY = process.env.JUDGE0_KEY;

// Función auxiliar de validación
const validarFKs = async (estudiante_id, ejercicio_id, miniproyecto_id) => {
  if (estudiante_id) {
    const existe = await Estudiante.findByPk(estudiante_id);
    if (!existe) throw new Error(`El estudiante_id (${estudiante_id}) no existe.`);
  }
  if (ejercicio_id) {
    const existe = await Ejercicio.findByPk(ejercicio_id);
    if (!existe) throw new Error(`El ejercicio_id (${ejercicio_id}) no existe.`);
  }
  if (miniproyecto_id) {
    const existe = await Miniproyecto.findByPk(miniproyecto_id);
    if (!existe) throw new Error(`El miniproyecto_id (${miniproyecto_id}) no existe.`);
  }
};

function obtenerCodigoCompilador(body = {}) {
  if (typeof body?.codigo === 'string' && body.codigo.trim()) {
    return body.codigo;
  }

  if (typeof body?.respuesta?.codigo === 'string' && body.respuesta.codigo.trim()) {
    return body.respuesta.codigo;
  }

  if (typeof body?.respuesta?.texto === 'string' && body.respuesta.texto.trim()) {
    return body.respuesta.texto;
  }

  if (typeof body?.respuesta === 'string' && body.respuesta.trim()) {
    return body.respuesta;
  }

  return '';
}

async function guardarIntentoYEvaluacion({ estudiante_id, ejercicio_id, codigo, lenguajeIdNum, resultadoEvaluacion, puntosEjercicio = 100, estadoIntentoOverride = null }) {
  try {
    if (!estudiante_id) return null;

    const erroresCount = Array.isArray(resultadoEvaluacion?.resultados)
      ? resultadoEvaluacion.resultados.filter((r) => r.ejecutado && !r.paso).length
      : 0;

    const respuestaPayload = {
      codigo,
      lenguaje_id: lenguajeIdNum,
      resultado: resultadoEvaluacion?.resultado || (resultadoEvaluacion?.aprobado ? 'CUMPLE' : 'NO CUMPLE'),
      esCorrecta: !!resultadoEvaluacion?.aprobado,
      casosPrueba: resultadoEvaluacion?.resultados || [],
      resumen: resultadoEvaluacion?.resumen || '',
      errores: erroresCount
    };

    const existenteRespuesta = await RespuestaEstudianteEjercicio.findOne({ where: { estudiante_id, ejercicio_id } });
    if (existenteRespuesta) {
      const nuevoContador = (existenteRespuesta.contador || 0) + 1;
      await existenteRespuesta.update({
        respuesta: respuestaPayload,
        estado: estadoIntentoOverride || (resultadoEvaluacion?.aprobado ? 'APROBADO' : 'REPROBADO'),
        contador: nuevoContador
      });
    } else {
      await RespuestaEstudianteEjercicio.create({
        respuesta: respuestaPayload,
        estudiante_id,
        ejercicio_id,
        estado: estadoIntentoOverride || (resultadoEvaluacion?.aprobado ? 'APROBADO' : 'REPROBADO'),
        contador: 1
      });
    }

    // Registrar/actualizar Evaluacion (guardar calificación y estado)
    const payloadEval = {
      calificacion: resultadoEvaluacion?.aprobado ? (puntosEjercicio || 0) : 0,
      retroalimentacion: resultadoEvaluacion?.resumen || '',
      estudiante_id,
      ejercicio_id,
      estado: resultadoEvaluacion?.aprobado ? 'Aprobado' : 'Reprobado'
    };

    const existenteEval = await Evaluacion.findOne({ where: { estudiante_id, ejercicio_id } });
    if (existenteEval) {
      await existenteEval.update(payloadEval);
    } else {
      await Evaluacion.create(payloadEval);
    }

    return true;
  } catch (err) {
    console.error('guardarIntentoYEvaluacion error:', err && err.message);
    return null;
  }
}

function esMvcConfig(cfg) {
  // Detecta MVC aunque tipo haya sido sobreescrito a 'programacion' por el normalizador legacy
  return cfg.tipo === 'mvc'
    || (typeof cfg.templateMain === 'string' && cfg.templateMain.trim().length > 0)
    || (typeof cfg.nombreModelo === 'string' && cfg.nombreModelo.trim().length > 0
        && Array.isArray(cfg.casos_prueba) && !cfg.metodo?.nombre);
}

async function cargarEjercicioCompilador(ejercicio_id) {
  const ejercicio = await Ejercicio.findByPk(ejercicio_id);
  if (!ejercicio) {
    return { error: { status: 404, message: 'Ejercicio no encontrado' } };
  }

  if (ejercicio.tipo_ejercicio !== 'Compilador') {
    return { error: { status: 400, message: 'El ejercicio no es de tipo Compilador' } };
  }

  const rawCfg = ejercicio.configuracion || {};

  // Ejercicios MVC: no usan plantilla de método ni validación legacy
  // Detectamos por tipo='mvc' O por presencia de templateMain (resiste normalización anterior)
  if (esMvcConfig(rawCfg)) {
    return { ejercicio, configuracion: { ...rawCfg, tipo: 'mvc' } };
  }

  const configuracion = normalizarConfiguracionCompilador({
    configuracion: rawCfg,
    codigoEstructura: ejercicio.codigoEstructura,
    resultadoEjercicio: ejercicio.resultado_ejercicio
  });

  const validacionConfiguracion = validarConfiguracionCompilador({
    configuracion,
    codigoEstructura: ejercicio.codigoEstructura
  });

  if (!validacionConfiguracion.ok) {
    return {
      error: {
        status: 500,
        message: `Configuracion invalida del ejercicio: ${validacionConfiguracion.errores.join('; ')}`
      }
    };
  }

  return { ejercicio, configuracion };
}

exports.create = async (req, res) => {
  try {
    await validarFKs(req.body.estudiante_id, req.body.ejercicio_id, req.body.miniproyecto_id);
    const data = await Evaluacion.create(req.body);
    res.status(201).json({ message: "Evaluación creada con éxito", data: data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const data = await Evaluacion.findAll({
      attributes: { exclude: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id'] },
      include: [
        { model: Estudiante },
        { model: Ejercicio },
        { model: Miniproyecto }
      ]
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ESTAS SON LAS QUE FALTABAN:
exports.findOne = async (req, res) => {
  try {
    const data = await Evaluacion.findByPk(req.params.id, {
      attributes: { exclude: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id'] },
      include: [{ model: Estudiante }, { model: Ejercicio }, { model: Miniproyecto }]
    });
    if (!data) return res.status(404).json({ message: "No se encontró la evaluación" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    await validarFKs(req.body.estudiante_id, req.body.ejercicio_id, req.body.miniproyecto_id);
    const [updated] = await Evaluacion.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ message: "No se encontró el registro" });
    res.json({ message: 'Evaluación actualizada correctamente' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await Evaluacion.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ message: "No se encontró el registro" });
    res.json({ message: 'Evaluación eliminada correctamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Búsqueda por query params: estudiante_id, ejercicio_id, miniproyecto_id
exports.findBy = async (req, res) => {
  try {
    const { estudiante_id, ejercicio_id, miniproyecto_id } = req.query;
    const where = {};
    if (req.tipoUsuario === 'ESTUDIANTE') {
      const authenticatedStudentId = Number(req.estudianteId);
      if (!Number.isFinite(authenticatedStudentId)) {
        return res.status(403).json({ error: 'Solo los estudiantes autenticados pueden consultar sus evaluaciones.' });
      }
      where.estudiante_id = authenticatedStudentId;
    } else if (estudiante_id) {
      where.estudiante_id = parseInt(estudiante_id, 10);
    }
    if (ejercicio_id) where.ejercicio_id = parseInt(ejercicio_id, 10);
    if (miniproyecto_id) where.miniproyecto_id = parseInt(miniproyecto_id, 10);

    const data = await Evaluacion.findAll({
      where,
      attributes: { exclude: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id'] },
      include: [{ model: Estudiante }, { model: Ejercicio }, { model: Miniproyecto }]
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/* ============================================================
   UTILIDADES COMPILADOR
============================================================ */
const codificar = (texto) => Buffer.from(texto || '').toString('base64');

const decodificar = (base64) => {
  if (!base64) return '';
  try {
    return Buffer.from(base64, 'base64').toString('utf-8').trim();
  } catch (e) {
    return base64;
  }
};

const normalizarSalida = (texto) =>
  (texto || '')
    .toString()
    .replace(/[\n\r]/g, '')
    .trim();

const extraerReglasSintaxis = (configuracion) => {
  if (!configuracion || typeof configuracion !== 'object') return {};
  const candidatos = [
    configuracion.sintaxis,
    configuracion.requisitos_sintaxis,
    configuracion.requisitosSintaxis,
    configuracion.requisitos,
    configuracion.estructuras,
    configuracion.palabrasClave,
    configuracion.keywords,
    configuracion.validacion_sintaxis,
    configuracion.validaciones?.sintaxis,
    configuracion.patrones
  ].filter(Boolean);

  const reglas = candidatos[0] || {};

  // Si es lista simple: se interpreta como elementos requeridos
  if (Array.isArray(reglas)) {
    return { contiene: reglas };
  }

  // Si es objeto { while: true, for: false } => requerido/no permitido
  if (reglas && typeof reglas === 'object' && !reglas.contiene && !reglas.noContiene && !reglas.regex && !reglas.pattern) {
    const contiene = [];
    const noContiene = [];
    Object.entries(reglas).forEach(([k, v]) => {
      if (v === true || v === 'true') contiene.push(k);
      if (v === false || v === 'false') noContiene.push(k);
    });
    if (contiene.length || noContiene.length) {
      return { contiene, noContiene };
    }
  }

  return reglas;
};

const normalizarLista = (valor) => {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  return [valor];
};

const JS_KEYWORD_TO_NODE = {
  'while': ['WhileStatement'],
  'do while': ['DoWhileStatement'],
  'for': ['ForStatement', 'ForInStatement', 'ForOfStatement'],
  'for in': ['ForInStatement'],
  'for of': ['ForOfStatement'],
  'if': ['IfStatement'],
  'switch': ['SwitchStatement'],
  'function': ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'],
  'arrow': ['ArrowFunctionExpression'],
  'class': ['ClassDeclaration'],
  'return': ['ReturnStatement'],
  'break': ['BreakStatement'],
  'continue': ['ContinueStatement'],
  'try': ['TryStatement'],
  'catch': ['CatchClause'],
  'throw': ['ThrowStatement']
};

const JAVA_KEYWORD_TO_CST = {
  'while': ['whileStatement'],
  'do while': ['doStatement'],
  'for': ['forStatement', 'enhancedForStatement'],
  'for each': ['enhancedForStatement'],
  'if': ['ifStatement'],
  'switch': ['switchStatement'],
  'try': ['tryStatement'],
  'catch': ['catchClause'],
  'throw': ['throwStatement'],
  'return': ['returnStatement'],
  'break': ['breakStatement'],
  'continue': ['continueStatement'],
  'class': ['classDeclaration'],
  'method': ['methodDeclaration']
};

const JAVA_KEYWORD_TO_REGEX = {
  while: /\bwhile\s*\(/i,
  'do while': /\bdo\b[\s\S]*\bwhile\s*\(/i,
  for: /\bfor\s*\(/i,
  'for each': /\bfor\s*\([^;)]*:[^)]*\)/i,
  if: /\bif\s*\(/i,
  switch: /\bswitch\s*\(/i,
  try: /\btry\b/i,
  catch: /\bcatch\s*\(/i,
  throw: /\bthrow\b/i,
  return: /\breturn\b/i,
  break: /\bbreak\b/i,
  continue: /\bcontinue\b/i,
  class: /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/i,
  method: /(public|private|protected)?\s*(static\s+)?[A-Za-z_][A-Za-z0-9_<>,\[\]]*\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/i,
};

const recolectarTiposAST = (node, set) => {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') set.add(node.type);
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (!val) continue;
    if (Array.isArray(val)) {
      val.forEach((child) => recolectarTiposAST(child, set));
    } else if (val && typeof val.type === 'string') {
      recolectarTiposAST(val, set);
    }
  }
};

const validarSintaxisASTJS = (codigo, reglas) => {
  const errores = [];
  let ast;
  try {
    ast = acorn.parse(codigo, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (e) {
    return { ok: false, errores: [`Error de sintaxis JS: ${e.message}`] };
  }

  const tipos = new Set();
  recolectarTiposAST(ast, tipos);

  const contiene = normalizarLista(reglas.contiene || reglas.required || reglas.requerido || reglas.mustInclude || reglas.incluir);
  const noContiene = normalizarLista(reglas.noContiene || reglas.forbidden || reglas.mustNotInclude || reglas.prohibido);

  const verificar = (item, mustInclude) => {
    const key = (item || '').toString().toLowerCase();
    if (!key) return;
    const nodes = JS_KEYWORD_TO_NODE[key];
    if (!nodes) return; // si no mapea, se validará por texto
    const existe = nodes.some((t) => tipos.has(t));
    if (mustInclude && !existe) errores.push(`Debe incluir estructura: ${item}`);
    if (!mustInclude && existe) errores.push(`No debe incluir estructura: ${item}`);
  };

  contiene.forEach((item) => verificar(item, true));
  noContiene.forEach((item) => verificar(item, false));

  return { ok: errores.length === 0, errores };
};

const tieneSimbolosBalanceados = (codigo) => {
  const pares = [
    ['(', ')'],
    ['{', '}'],
    ['[', ']'],
  ];

  for (const [open, close] of pares) {
    let balance = 0;
    for (const char of codigo) {
      if (char === open) balance += 1;
      if (char === close) balance -= 1;
      if (balance < 0) return false;
    }
    if (balance !== 0) return false;
  }

  return true;
};

const validarSintaxisASTJava = (codigo, reglas) => {
  const errores = [];
  if (!tieneSimbolosBalanceados(codigo || '')) {
    return { ok: false, errores: ['Error de sintaxis Java: simbolos desbalanceados'] };
  }

  const contiene = normalizarLista(reglas.contiene || reglas.required || reglas.requerido || reglas.mustInclude || reglas.incluir);
  const noContiene = normalizarLista(reglas.noContiene || reglas.forbidden || reglas.mustNotInclude || reglas.prohibido);

  const verificar = (item, mustInclude) => {
    const key = (item || '').toString().toLowerCase();
    if (!key) return;
    const pattern = JAVA_KEYWORD_TO_REGEX[key];
    if (!pattern) return; // si no mapea, se validará por texto
    const existe = pattern.test(codigo || '');
    if (mustInclude && !existe) errores.push(`Debe incluir estructura: ${item}`);
    if (!mustInclude && existe) errores.push(`No debe incluir estructura: ${item}`);
  };

  contiene.forEach((item) => verificar(item, true));
  noContiene.forEach((item) => verificar(item, false));

  return { ok: errores.length === 0, errores };
};

const validarSintaxis = (codigo, configuracion, lenguajeIdNum) => {
  const reglas = extraerReglasSintaxis(configuracion);
  const contiene = normalizarLista(reglas.contiene || reglas.required || reglas.requerido || reglas.mustInclude || reglas.incluir);
  const noContiene = normalizarLista(reglas.noContiene || reglas.forbidden || reglas.mustNotInclude || reglas.prohibido);
  const regex = normalizarLista(reglas.regex || reglas.pattern || reglas.patrones);
  const regexNo = normalizarLista(reglas.regexNo || reglas.patternNo || reglas.patronesNo);

  const usarAst =
    configuracion?.usarAST === true ||
    configuracion?.validacion_ast === true ||
    configuracion?.sintaxisAst === true ||
    configuracion?.sintaxisTipo === 'ast' ||
    (lenguajeIdNum === 62 || lenguajeIdNum === 63 || lenguajeIdNum === 93);

  if (usarAst) {
    if (lenguajeIdNum === 62) {
      const resultadoAst = validarSintaxisASTJava(codigo, reglas);
      if (!resultadoAst.ok) {
        return resultadoAst;
      }
    } else if (lenguajeIdNum === 63 || lenguajeIdNum === 93) {
      const resultadoAst = validarSintaxisASTJS(codigo, reglas);
      if (!resultadoAst.ok) {
        return resultadoAst;
      }
    }
  }

  const esReglaAst = (item) => {
    const key = (item || '').toString().toLowerCase();
    if (lenguajeIdNum === 62) return !!JAVA_KEYWORD_TO_CST[key];
    if (lenguajeIdNum === 63 || lenguajeIdNum === 93) return !!JS_KEYWORD_TO_NODE[key];
    return false;
  };
  const contieneTexto = usarAst ? contiene.filter((i) => !esReglaAst(i)) : contiene;
  const noContieneTexto = usarAst ? noContiene.filter((i) => !esReglaAst(i)) : noContiene;

  const codigoLower = (codigo || '').toString().toLowerCase();
  const errores = [];

  contieneTexto.forEach((item) => {
    const val = (item || '').toString().toLowerCase();
    if (val && !codigoLower.includes(val)) {
      errores.push(`Debe incluir: ${item}`);
    }
  });

  noContieneTexto.forEach((item) => {
    const val = (item || '').toString().toLowerCase();
    if (val && codigoLower.includes(val)) {
      errores.push(`No debe incluir: ${item}`);
    }
  });

  regex.forEach((pattern) => {
    try {
      const re = new RegExp(pattern, 'i');
      if (!re.test(codigo)) {
        errores.push(`No cumple patrón requerido: ${pattern}`);
      }
    } catch (e) {
      errores.push(`Patrón inválido: ${pattern}`);
    }
  });

  regexNo.forEach((pattern) => {
    try {
      const re = new RegExp(pattern, 'i');
      if (re.test(codigo)) {
        errores.push(`Patrón no permitido: ${pattern}`);
      }
    } catch (e) {
      errores.push(`Patrón inválido: ${pattern}`);
    }
  });

  return { ok: errores.length === 0, errores };
};

/* ============================================================
   COMPILADOR: VALIDACIÓN POR SINTAXIS Y OUTPUT
============================================================ */
exports.evaluarCompilador = async (req, res) => {
  try {
    const ejercicio_id = req.body.ejercicio_id || req.params.ejercicioId || req.params.id;
    const { estudiante_id, lenguaje_id } = req.body || {};
    const lenguajeIdNum = parseInt(lenguaje_id, 10) || 62;

    // MVC path: 3 archivos enviados como { archivos: { main, modelo, consolaIO } }
    if (req.body?.archivos && typeof req.body.archivos === 'object') {
      const { main, modelo, consolaIO } = req.body.archivos;
      // Aceptar string vacío o con espacios como código válido (el compilador lo manejará)
      const mainStr = (main || '').toString();
      const modeloStr = (modelo || '').toString();
      const consolaIOStr = (consolaIO || '').toString().trim();
      if (!consolaIOStr) {
        return res.status(400).json({ message: 'Se requiere el archivo consolaIO.' });
      }
      const { mergeMvcFiles } = require('../utils/javaMultiFileCompiler');
      const codigoFusionado = mergeMvcFiles(mainStr, modeloStr, consolaIOStr);

      // stdin_manual: ejecución libre donde el estudiante provee su propio stdin
      const stdinManual = req.body?.stdin_manual;
      if (typeof stdinManual === 'string') {
        const { ejecutarCasoPruebaMvc } = require('../services/evaluadorCasosPrueba');
        // Exportamos la función interna — ver nota en evaluadorCasosPrueba.js
        const ejecucion = await evaluadorCasos.ejecutarMvcLibre(codigoFusionado, stdinManual);
        return res.status(200).json({
          modo: 'ejecucion_libre',
          stdout: ejecucion.stdout || '',
          stderr: ejecucion.stderr || '',
          exito: ejecucion.success,
        });
      }

      const cargaCompilador = await cargarEjercicioCompilador(ejercicio_id);
      if (cargaCompilador.error) {
        return res.status(cargaCompilador.error.status).json({ message: cargaCompilador.error.message });
      }
      const { ejercicio, configuracion } = cargaCompilador;
      const casosPrueba = Array.isArray(configuracion.casos_prueba) && configuracion.casos_prueba.length > 0
        ? configuracion.casos_prueba
        : [{ inputs: '', output: (configuracion.esperado || ejercicio.resultado_ejercicio || '').trim() }];

      const resultadoEvaluacion = await evaluadorCasos.evaluarCasosPruebaMvc(codigoFusionado, casosPrueba);
      const aprobado = resultadoEvaluacion.aprobado;

      // Guardar intento y registro de evaluacion si viene estudiante_id
      if (estudiante_id) {
        await guardarIntentoYEvaluacion({
          estudiante_id,
          ejercicio_id,
          codigo: codigoFusionado,
          lenguajeIdNum,
          resultadoEvaluacion,
          puntosEjercicio: ejercicio.puntos || 100
        });
      }

      return res.status(aprobado ? 200 : 400).json({
        esCorrecta: aprobado,
        aprobado,
        casos: resultadoEvaluacion.resultados || [],
        casosPrueba: resultadoEvaluacion.resultados || [],
        resumen: resultadoEvaluacion.resumen,
        stdout: resultadoEvaluacion.resultados?.[0]?.outputObtenido || '',
        stderr: resultadoEvaluacion.resultados?.find((r) => r.error)?.error || '',
        puntosObtenidos: aprobado ? (ejercicio.puntos || 100) : 0,
      });
    }

    const codigoOriginal = obtenerCodigoCompilador(req.body);

    if (!ejercicio_id || !lenguaje_id || isNaN(lenguajeIdNum) || !codigoOriginal) {
      return res.status(400).json({ message: 'Faltan campos: ejercicio_id, lenguaje_id, codigo' });
    }

    if (estudiante_id) {
      await validarFKs(estudiante_id, ejercicio_id, null);
    }

    const cargaCompilador = await cargarEjercicioCompilador(ejercicio_id);
    if (cargaCompilador.error) {
      return res.status(cargaCompilador.error.status).json({ message: cargaCompilador.error.message });
    }

    const { ejercicio, configuracion } = cargaCompilador;

    // MVC por configuracion.tipo — el codigo ya llegó mergeado desde el frontend
    if (configuracion.tipo === 'mvc') {
      const casosPrueba = Array.isArray(configuracion.casos_prueba) && configuracion.casos_prueba.length > 0
        ? configuracion.casos_prueba
        : [{ inputs: '', output: (configuracion.esperado || ejercicio.resultado_ejercicio || '').trim() }];
      const resultadoMvc = await evaluadorCasos.evaluarCasosPruebaMvc(codigoOriginal, casosPrueba);
      const aprobadoMvc = resultadoMvc.aprobado;

      // Guardar intento y registro de evaluacion si viene estudiante_id
      if (estudiante_id) {
        await guardarIntentoYEvaluacion({
          estudiante_id,
          ejercicio_id,
          codigo: codigoOriginal,
          lenguajeIdNum,
          resultadoEvaluacion: resultadoMvc,
          puntosEjercicio: ejercicio.puntos || 100
        });
      }
      return res.status(aprobadoMvc ? 200 : 400).json({
        esCorrecta: aprobadoMvc,
        aprobado: aprobadoMvc,
        casos: resultadoMvc.resultados || [],
        casosPrueba: resultadoMvc.resultados || [],
        resumen: resultadoMvc.resumen,
        stdout: resultadoMvc.resultados?.[0]?.outputObtenido || '',
        stderr: resultadoMvc.resultados?.find((r) => r.error)?.error || '',
        puntosObtenidos: aprobadoMvc ? (ejercicio.puntos || 100) : 0,
      });
    }

    const codigo = normalizarCodigoJavaEstudiante(codigoOriginal, configuracion.metodo);

    const registrarIntentoEjercicio = async ({ estadoIntento, meta = {} }) => {
      if (!estudiante_id) return null;

      const respuestaPayload = {
        codigo: codigoOriginal,
        codigoNormalizado: codigo,
        lenguaje_id: lenguajeIdNum,
        ...meta
      };

      const existenteRespuesta = await RespuestaEstudianteEjercicio.findOne({
        where: { estudiante_id, ejercicio_id }
      });

      if (existenteRespuesta) {
        const nuevoContador = (existenteRespuesta.contador || 0) + 1;
        await existenteRespuesta.update({
          respuesta: respuestaPayload,
          estado: estadoIntento,
          contador: nuevoContador
        });
        return { id: existenteRespuesta.id, contador: nuevoContador };
      }

      const creado = await RespuestaEstudianteEjercicio.create({
        respuesta: respuestaPayload,
        estudiante_id,
        ejercicio_id,
        estado: estadoIntento,
        contador: 1
      });

      return { id: creado.id, contador: 1 };
    };

    const responderNoCumple = async ({ resumen, erroresSintaxis = [], casosPrueba = [], stdout = '', stderr = '', esperado = '', obtenido = '' }) => {
      const intentoActual = await registrarIntentoEjercicio({
        estadoIntento: 'REPROBADO',
        meta: {
          resultado: 'NO CUMPLE',
          esCorrecta: false,
          casosPrueba,
          resumen,
          erroresSintaxis,
          stdout,
          stderr,
          esperado,
          obtenido
        }
      });

      const payload = {
        resultado: 'NO CUMPLE',
        esCorrecta: false,
        puntosObtenidos: 0,
        contador: intentoActual?.contador,
        casosPrueba,
        resumen,
        retroalimentacion: resumen,
        erroresSintaxis,
        stdout,
        stderr,
        esperado,
        obtenido
      };

      if (req.body?.debug) {
        payload.debug = { casosPrueba, erroresSintaxis, stdoutRaw: stdout, stderrRaw: stderr };
      }

      return res.status(400).json(payload);
    };

    const responderErrorTecnico = async ({ message, statusCode = 502, detalle }) => {
      const intentoActual = await registrarIntentoEjercicio({
        estadoIntento: 'ERROR_TECNICO',
        meta: {
          errorTecnico: true,
          error: message,
          detalle
        }
      });

      const payload = {
        errorTecnico: true,
        resultado: null,
        esCorrecta: null,
        contador: intentoActual?.contador,
        message,
        error: message,
        detalle
      };

      if (req.body?.debug) {
        payload.debug = { detalle };
      }

      return res.status(statusCode).json(payload);
    };

    const lenguajesPermitidos = configuracion.lenguajesPermitidos;
    if (Array.isArray(lenguajesPermitidos) && lenguajesPermitidos.length > 0) {
      if (!lenguajesPermitidos.includes(lenguajeIdNum)) {
        return responderNoCumple({
          resumen: 'NO CUMPLE: el lenguaje enviado no esta permitido para este ejercicio.'
        });
      }
    }

    if (lenguajeIdNum !== 62) {
      return responderNoCumple({
        resumen: 'NO CUMPLE: el ejercicio de programacion solo admite Java.'
      });
    }

    if (tieneMainJava(codigo)) {
      return responderNoCumple({
        resumen: 'NO CUMPLE: no fue posible aislar correctamente el metodo enviado desde la clase Java.'
      });
    }

    const validacionSintaxis = validarSintaxis(codigo, configuracion, lenguajeIdNum);
    if (!validacionSintaxis.ok) {
      return responderNoCumple({
        resumen: `NO CUMPLE: no satisface las restricciones o la estructura requerida. ${validacionSintaxis.errores.join('; ')}`,
        erroresSintaxis: validacionSintaxis.errores
      });
    }

    const resultadoEvaluacion = await evaluadorCasos.evaluarCasosPrueba(
      codigo,
      lenguajeIdNum,
      configuracion.casos_prueba,
      configuracion.metodo
    );

    if (resultadoEvaluacion.errorTecnico || resultadoEvaluacion.errorConfiguracion) {
      return responderErrorTecnico({
        statusCode: resultadoEvaluacion.errorConfiguracion ? 500 : 502,
        message: resultadoEvaluacion.resumen,
        detalle: resultadoEvaluacion.resultados
      });
    }

    const casoReferencia = resultadoEvaluacion.resultados.find((caso) => caso.ejecutado && !caso.omitido && !caso.paso)
      || resultadoEvaluacion.resultados.find((caso) => caso.ejecutado && !caso.omitido)
      || {};

    const intentoActual = await registrarIntentoEjercicio({
      estadoIntento: resultadoEvaluacion.aprobado ? 'APROBADO' : 'REPROBADO',
      meta: {
        resultado: resultadoEvaluacion.resultado,
        esCorrecta: resultadoEvaluacion.aprobado,
        casosPrueba: resultadoEvaluacion.resultados,
        resumen: resultadoEvaluacion.resumen
      }
    });

    const respuestaComun = {
      resultado: resultadoEvaluacion.aprobado ? 'CUMPLE' : 'NO CUMPLE',
      esCorrecta: resultadoEvaluacion.aprobado,
      puntosObtenidos: resultadoEvaluacion.aprobado ? ejercicio.puntos : 0,
      contador: intentoActual?.contador,
      casosPrueba: resultadoEvaluacion.resultados,
      resumen: resultadoEvaluacion.resumen,
      retroalimentacion: resultadoEvaluacion.resumen,
      stdout: casoReferencia.outputObtenido || '',
      stderr: resultadoEvaluacion.aprobado ? '' : (casoReferencia.error || ''),
      esperado: casoReferencia.outputEsperado || '',
      obtenido: normalizarSalida(casoReferencia.outputObtenido || '')
    };

    if (req.body?.debug) {
      respuestaComun.debug = {
        resultadoEvaluacion,
        casoReferencia,
        configuracion,
        ejercicioId: ejercicio_id
      };
    }

    if (resultadoEvaluacion.aprobado) {
      if (estudiante_id) {
        const evalWhere = { estudiante_id, ejercicio_id };
        const payloadEval = {
          calificacion: ejercicio.puntos,
          retroalimentacion: resultadoEvaluacion.resumen,
          estudiante_id,
          ejercicio_id,
          estado: 'Aprobado'
        };
        const existenteEval = await Evaluacion.findOne({ where: evalWhere });
        if (existenteEval) {
          await existenteEval.update(payloadEval);
        } else {
          await Evaluacion.create(payloadEval);
        }
      }

      return res.status(200).json(respuestaComun);
    }

    return res.status(400).json(respuestaComun);
  } catch (e) {
    res.status(500).json({ error: e.message || e });
  }
};

exports.ejecutarCompilador = async (req, res) => {
  try {
    const ejercicio_id = req.body.ejercicio_id || req.params.ejercicioId || req.params.id;
    const lenguajeIdNum = parseInt(req.body?.lenguaje_id || 62, 10);
    const codigoOriginal = obtenerCodigoCompilador(req.body);

    if (!ejercicio_id || isNaN(lenguajeIdNum) || !codigoOriginal) {
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.log('ejecutarCompilador: payload insuficiente', {
            ejercicio_id,
            lenguaje_id_sent: req.body?.lenguaje_id,
            lenguajeIdNum,
            codigoOriginalPreview: (typeof codigoOriginal === 'string' && codigoOriginal.length > 0) ? codigoOriginal.slice(0, 200) : codigoOriginal,
            body: req.body
          });
        } catch (logErr) {
          console.log('ejecutarCompilador: error al imprimir payload', logErr && logErr.message);
        }
      }
      return res.status(400).json({ message: 'Faltan campos: ejercicio_id, lenguaje_id, codigo' });
    }

    const cargaCompilador = await cargarEjercicioCompilador(ejercicio_id);
    if (cargaCompilador.error) {
      return res.status(cargaCompilador.error.status).json({ message: cargaCompilador.error.message });
    }

    const { ejercicio, configuracion } = cargaCompilador;

    // MVC: el código ya viene mergeado con main() — corre directo contra los casos
    if (configuracion.tipo === 'mvc' || tieneMainJava(codigoOriginal)) {
      const casosPrueba = Array.isArray(configuracion.casos_prueba) && configuracion.casos_prueba.length > 0
        ? configuracion.casos_prueba
        : [{ inputs: '', output: (configuracion.esperado || ejercicio.resultado_ejercicio || '').trim() }];
      const resultadoMvc = await evaluadorCasos.evaluarCasosPruebaMvc(codigoOriginal, casosPrueba);
      const aprobadoMvc = resultadoMvc.aprobado;

      // Guardar intento y registro de evaluacion si viene estudiante_id
      if (req.body?.estudiante_id) {
        await guardarIntentoYEvaluacion({
          estudiante_id: req.body.estudiante_id,
          ejercicio_id,
          codigo: codigoOriginal,
          lenguajeIdNum,
          resultadoEvaluacion: resultadoMvc,
          puntosEjercicio: ejercicio.puntos || 100
        });
      }
      return res.status(aprobadoMvc ? 200 : 400).json({
        esCorrecta: aprobadoMvc,
        aprobado: aprobadoMvc,
        casos: resultadoMvc.resultados || [],
        casosPrueba: resultadoMvc.resultados || [],
        resumen: resultadoMvc.resumen,
        stdout: resultadoMvc.resultados?.[0]?.outputObtenido || '',
        stderr: resultadoMvc.resultados?.find((r) => r.error)?.error || '',
        puntosObtenidos: aprobadoMvc ? (ejercicio.puntos || 100) : 0,
      });
    }

    const codigo = normalizarCodigoJavaEstudiante(codigoOriginal, configuracion.metodo);
    const lenguajesPermitidos = configuracion.lenguajesPermitidos;

    if (Array.isArray(lenguajesPermitidos) && lenguajesPermitidos.length > 0 && !lenguajesPermitidos.includes(lenguajeIdNum)) {
      return res.status(400).json({ message: 'El lenguaje enviado no esta permitido para este ejercicio.' });
    }

    if (lenguajeIdNum !== 62) {
      return res.status(400).json({ message: 'El ejercicio de programacion solo admite Java.' });
    }

    if (tieneMainJava(codigo)) {
      return res.status(400).json({ message: 'No fue posible aislar correctamente el metodo enviado desde la clase Java.' });
    }

    const resultados = [];

    for (let i = 0; i < configuracion.casos_prueba.length; i++) {
      const caso = configuracion.casos_prueba[i];
      const ejecucion = await evaluadorCasos.ejecutarCasoPrueba(
        codigo,
        caso.inputs,
        lenguajeIdNum,
        configuracion.metodo
      );

      resultados.push({
        caseNum: i + 1,
        inputs: caso.inputs,
        outputObtenido: ejecucion.stdout || '',
        error: ejecucion.stderr || null,
        statusId: ejecucion.statusId,
        statusDescription: ejecucion.statusDescription,
        ejecutado: true
      });
    }

    return res.status(200).json({
      modo: 'ejecucion',
      message: 'Ejecucion completada.',
      resumen: 'Codigo ejecutado sin evaluar contra resultados esperados.',
      casos: resultados
    });
  } catch (error) {
    if (error?.isTechnicalExecutionError) {
      return res.status(error.statusCode || 502).json({
        errorTecnico: true,
        message: error.message,
        detalle: error.details || null
      });
    }

    return res.status(500).json({ error: error.message || error });
  }
};

// Evaluar compilador para miniproyectos (sin Ejercicio asociado)
exports.evaluateCompilerSubmission = async ({ codigo, lenguaje_id, configuracion, esperado, salidaManual }) => {
  const lenguajeIdNum = parseInt(lenguaje_id, 10);
  if (!lenguaje_id || isNaN(lenguajeIdNum) || !codigo) {
    return { status: 400, message: 'Faltan campos: lenguaje_id, codigo' };
  }

  const cfg = normalizarConfiguracionCompilador({
    configuracion: configuracion || {},
    codigoEstructura: configuracion?.metodo?.plantilla || configuracion?.plantillaMetodo,
    resultadoEjercicio: esperado
  });
  const usaCasosPrueba = Array.isArray(cfg.casos_prueba) && cfg.casos_prueba.length > 0;
  const lenguajesPermitidos = cfg.lenguajesPermitidos;
  if (Array.isArray(lenguajesPermitidos) && lenguajesPermitidos.length > 0) {
    if (!lenguajesPermitidos.includes(lenguajeIdNum)) {
      return { status: 400, message: 'Lenguaje no permitido para este ejercicio' };
    }
  }

  if (usaCasosPrueba) {
    const validacionConfiguracion = validarConfiguracionCompilador({
      configuracion: cfg,
      codigoEstructura: cfg?.metodo?.plantilla
    });

    if (!validacionConfiguracion.ok) {
      return {
        status: 500,
        message: `Configuracion invalida del miniproyecto: ${validacionConfiguracion.errores.join('; ')}`
      };
    }

    if (lenguajeIdNum !== 62) {
      return { status: 400, message: 'El miniproyecto de programacion solo admite Java.' };
    }

    if (tieneMainJava(codigo)) {
      return { status: 400, message: 'No fue posible aislar correctamente el metodo enviado desde la clase Java.' };
    }

    const validacionSintaxis = validarSintaxis(codigo, cfg, lenguajeIdNum);
    if (!validacionSintaxis.ok) {
      return {
        status: 400,
        data: {
          esCorrecta: false,
          estado: 'Sintaxis invalida',
          erroresSintaxis: validacionSintaxis.errores
        }
      };
    }

    const codigoNormalizado = normalizarCodigoJavaEstudiante(codigo, cfg.metodo);
    const resultadoEvaluacion = await evaluadorCasos.evaluarCasosPrueba(
      codigoNormalizado,
      lenguajeIdNum,
      cfg.casos_prueba,
      cfg.metodo
    );

    if (resultadoEvaluacion.errorTecnico || resultadoEvaluacion.errorConfiguracion) {
      return {
        status: resultadoEvaluacion.errorConfiguracion ? 500 : 502,
        message: resultadoEvaluacion.resumen,
        data: {
          esCorrecta: false,
          estado: resultadoEvaluacion.resumen,
          casosPrueba: resultadoEvaluacion.resultados || []
        }
      };
    }

    const casoReferencia = resultadoEvaluacion.resultados.find((caso) => caso.ejecutado && !caso.omitido && !caso.paso)
      || resultadoEvaluacion.resultados.find((caso) => caso.ejecutado && !caso.omitido)
      || {};

    return {
      status: resultadoEvaluacion.aprobado ? 200 : 400,
      data: {
        esCorrecta: resultadoEvaluacion.aprobado,
        stdout: casoReferencia.outputObtenido || '',
        stderr: resultadoEvaluacion.aprobado ? '' : (casoReferencia.error || ''),
        esperado: casoReferencia.outputEsperado || '',
        obtenido: normalizarSalida(casoReferencia.outputObtenido || ''),
        estado: resultadoEvaluacion.resumen,
        resumen: resultadoEvaluacion.resumen,
        casosPrueba: resultadoEvaluacion.resultados,
        puntosObtenidos: resultadoEvaluacion.aprobado ? 100 : 0,
      }
    };
  }

  const validacionSintaxis = validarSintaxis(codigo, cfg, lenguajeIdNum);
  if (!validacionSintaxis.ok) {
    return {
      status: 400,
      data: {
        esCorrecta: false,
        estado: 'Sintaxis invalida',
        erroresSintaxis: validacionSintaxis.errores
      }
    };
  }

  if (!JUDGE0_URL) {
    return { status: 500, message: 'JUDGE0_URL no esta configurada.' };
  }

  let result = {};
  let stdoutHumano = '';
  let stderrHumano = '';
  let compileOutput = '';

  if (typeof salidaManual === 'string') {
    stdoutHumano = salidaManual;
    result.status = { id: 3, description: 'Manual' };
  } else {
    const usarRapidApi = !!JUDGE0_KEY;
    const headers = usarRapidApi
      ? {
          'x-rapidapi-key': JUDGE0_KEY,
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
        }
      : undefined;

    const response = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
      {
        source_code: codificar(codigo),
        language_id: lenguajeIdNum
      },
      headers ? { headers } : undefined
    );

    result = response.data || {};
    stdoutHumano = result.stdout ? decodificar(result.stdout) : '';
    stderrHumano = result.stderr ? decodificar(result.stderr) : '';
    compileOutput = result.compile_output ? decodificar(result.compile_output) : '';
  }

  const esperadoFinal = normalizarSalida(cfg.esperado || esperado || '');
  const obtenido = normalizarSalida(stdoutHumano);
  const sinErrores = !stderrHumano && !compileOutput && result.status?.id === 3;
  const esCorrecta = sinErrores && obtenido === esperadoFinal && esperadoFinal !== '';

  return {
    status: esCorrecta ? 200 : 400,
    data: {
      esCorrecta,
      stdout: stdoutHumano,
      stderr: stderrHumano || compileOutput,
      esperado: esperadoFinal,
      obtenido,
      estado: result.status?.description || (esCorrecta ? 'Aprobado' : 'Reprobado')
    }
  };
};