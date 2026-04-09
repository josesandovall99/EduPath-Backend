const STOPWORDS = new Set([
  'para', 'como', 'este', 'esta', 'estos', 'estas', 'desde', 'hasta', 'sobre', 'entre', 'ante',
  'bajo', 'cada', 'cuando', 'donde', 'quien', 'cual', 'cuales', 'debe', 'deben', 'debera', 'debera',
  'deberan', 'puede', 'pueden', 'permitir', 'permite', 'mediante', 'proyecto', 'sistema', 'plataforma',
  'modulo', 'modulos', 'gestion', 'proceso', 'procesos', 'usuario', 'usuarios', 'datos', 'informacion',
  'registrar', 'realizar', 'tener', 'hacer', 'usar', 'utilizar', 'incluye', 'incluyen', 'con', 'sin',
  'del', 'las', 'los', 'una', 'unos', 'unas', 'por', 'que', 'sus', 'their', 'the'
]);

const TOKEN_ALIAS_CATALOG = {
  estudiante: ['alumno', 'aprendiz'],
  docente: ['profesor', 'instructor', 'maestro'],
  administrador: ['admin', 'personal administrativo'],
  coordinador: ['director de programa', 'jefe de programa'],
  cliente: ['usuario final', 'consumidor'],
  registrar: ['guardar', 'crear', 'inscribir'],
  consultar: ['ver', 'visualizar', 'listar', 'buscar'],
  autenticar: ['login', 'inicio de sesion', 'iniciar sesion'],
  autenticacion: ['login', 'inicio de sesion', 'credenciales'],
  seguridad: ['proteccion', 'acceso seguro', 'autorizacion'],
  privacidad: ['confidencialidad', 'proteccion de datos', 'datos personales'],
  rendimiento: ['performance', 'rapidez', 'eficiencia'],
  disponibilidad: ['uptime', 'servicio disponible'],
  inventario: ['stock', 'existencias'],
  venta: ['ventas', 'comercializacion'],
  compra: ['compras', 'adquisicion'],
  pedido: ['orden', 'solicitud'],
  reporte: ['informe', 'estadistica'],
  cronograma: ['planificacion', 'plan de trabajo'],
  alcance: ['scope', 'cobertura', 'limites'],
  costo: ['presupuesto', 'gasto', 'inversion'],
  recurso: ['insumo', 'material', 'personal'],
  farmacia: ['drogueria', 'botica'],
  drogueria: ['farmacia', 'botica'],
  zapateria: ['tienda de calzado', 'calzado'],
  calzado: ['zapatos', 'zapateria']
};

const PHRASE_ALIAS_CATALOG = [
  { pattern: 'inicio de sesion', aliases: ['login', 'autenticacion', 'acceso al sistema'] },
  { pattern: 'iniciar sesion', aliases: ['login', 'autenticacion', 'acceso al sistema'] },
  { pattern: 'datos personales', aliases: ['informacion personal', 'proteccion de datos', 'privacidad'] },
  { pattern: 'tiempo de respuesta', aliases: ['rendimiento', 'performance', 'rapidez'] },
  { pattern: 'panel de administracion', aliases: ['panel administrativo', 'dashboard administrativo'] },
  { pattern: 'usuario final', aliases: ['cliente', 'consumidor'] },
  { pattern: 'costo unitario', aliases: ['valor unitario', 'precio unitario'] },
  { pattern: 'total general', aliases: ['costo total', 'presupuesto total', 'total del proyecto'] },
  { pattern: 'control de inventario', aliases: ['gestion de inventario', 'stock', 'existencias'] },
  { pattern: 'tienda de calzado', aliases: ['zapateria', 'calzado'] }
];

const KNOWN_SECTION_CONFIG = {
  stakeholders: { label: 'Stakeholders', weight: 25, validator: 'text' },
  requisitosFuncionales: { label: 'Requisitos funcionales', weight: 45, validator: 'text' },
  requisitosNoFuncionales: { label: 'Requisitos no funcionales', weight: 30, validator: 'text' },
  alcance: { label: 'Alcance del proyecto', weight: 30, validator: 'text' },
  cronograma: { label: 'Cronograma del proyecto', weight: 30, validator: 'schedule' },
  costos: { label: 'Costos y recursos', weight: 40, validator: 'costs' }
};

const stripHtml = (value = '') => value
  .toString()
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeText = (text = '') => stripHtml(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const tryParseJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const toArrayOfStrings = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.toString?.() ?? '')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|•|\-|\d+\.|\r/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

const singularizeToken = (token = '') => {
  if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
};

const extractSignificantTokens = (text = '') => normalizeText(text)
  .split(/\s+/)
  .map((token) => token.replace(/[^a-z0-9]/g, ''))
  .filter((token) => token.length >= 4 && !STOPWORDS.has(token) && !/^\d+$/.test(token));

const expandTokenAliases = (token = '') => {
  const normalizedToken = normalizeText(token);
  const singularToken = singularizeToken(normalizedToken);
  return uniqueValues([
    normalizedToken,
    singularToken,
    ...(TOKEN_ALIAS_CATALOG[normalizedToken] || []),
    ...(TOKEN_ALIAS_CATALOG[singularToken] || [])
  ].map((value) => normalizeText(value)));
};

const buildAnchorsFromText = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const anchors = [];
  const consumedTokens = new Set();

  PHRASE_ALIAS_CATALOG.forEach(({ pattern, aliases }) => {
    const normalizedPattern = normalizeText(pattern);
    if (!normalized.includes(normalizedPattern)) return;

    normalizedPattern.split(/\s+/).forEach((token) => consumedTokens.add(token));
    anchors.push(uniqueValues([normalizedPattern, ...aliases.map((alias) => normalizeText(alias))]));
  });

  extractSignificantTokens(normalized).forEach((token) => {
    if (consumedTokens.has(token)) return;
    const aliases = expandTokenAliases(token);
    if (aliases.length > 0) {
      anchors.push(aliases);
    }
  });

  return anchors.filter((anchor) => anchor.length > 0);
};

const toHumanLabel = (key = '') => key
  .toString()
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/^./, (char) => char.toUpperCase());

const isStructuredSectionValue = (value) => {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item) => item !== undefined && item !== null && (
    typeof item === 'string' || typeof item === 'number' || typeof item === 'object'
  ));
};

const getStructuredSectionKeys = (payload = {}) => Object.entries(payload)
  .filter(([key, value]) => key !== 'rubrica' && key !== 'tipo' && isStructuredSectionValue(value))
  .map(([key]) => key);

const detectStructuredMode = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.tipo && normalizeText(payload.tipo) === 'programacion') return null;

  const sectionKeys = getStructuredSectionKeys(payload);
  if (sectionKeys.length === 0) return null;
  if (sectionKeys.some((key) => ['alcance', 'cronograma', 'costos'].includes(key))) return 'management';
  if (sectionKeys.some((key) => ['stakeholders', 'requisitosFuncionales', 'requisitosNoFuncionales'].includes(key))) return 'analysis';
  return 'custom';
};

const buildConceptGroups = (sectionKey, value) => toArrayOfStrings(value)
  .map((item, index) => {
    const anchors = buildAnchorsFromText(item);
    const aliases = uniqueValues([normalizeText(item), ...anchors.flat()]);
    return {
      id: `${sectionKey}_${index + 1}`,
      source: item,
      aliases,
      anchors
    };
  })
  .filter((group) => group.aliases.length > 0);

const inferValidator = (sectionKey, value) => {
  if (KNOWN_SECTION_CONFIG[sectionKey]?.validator) {
    return KNOWN_SECTION_CONFIG[sectionKey].validator;
  }

  if (sectionKey === 'cronograma') return 'schedule';
  if (sectionKey === 'costos') return 'costs';

  if (Array.isArray(value) && value.some((item) => item && typeof item === 'object')) {
    const serialized = JSON.stringify(value).toLowerCase();
    if (serialized.includes('start') || serialized.includes('inicio') || serialized.includes('end') || serialized.includes('fin')) {
      return 'schedule';
    }
    if (serialized.includes('unitcost') || serialized.includes('costounitario') || serialized.includes('cantidad')) {
      return 'costs';
    }
  }

  return 'text';
};

const buildSectionDefinitions = (payload = {}) => {
  const sectionKeys = getStructuredSectionKeys(payload);
  return sectionKeys.map((sectionKey) => {
    const knownConfig = KNOWN_SECTION_CONFIG[sectionKey] || {};
    return {
      key: sectionKey,
      label: knownConfig.label || toHumanLabel(sectionKey),
      weight: knownConfig.weight || 30,
      validator: inferValidator(sectionKey, payload[sectionKey])
    };
  });
};

const buildAutoRubric = (payload, context = {}) => {
  const mode = detectStructuredMode(payload);
  if (!mode) return payload;

  const sectionDefinitions = buildSectionDefinitions(payload);

  const conceptGroups = {};
  sectionDefinitions.forEach((section) => {
    conceptGroups[section.key] = buildConceptGroups(section.key, payload[section.key]);
  });

  const existingRubrica = payload.rubrica && typeof payload.rubrica === 'object' && !Array.isArray(payload.rubrica)
    ? payload.rubrica
    : {};

  return {
    ...payload,
    rubrica: {
      ...existingRubrica,
      version: 'auto-v1',
      mode,
      generatedBy: 'system',
      generatedAt: new Date().toISOString(),
      sections: sectionDefinitions,
      contextoBase: {
        titulo: context?.titulo?.toString?.().trim?.() ?? '',
        descripcion: stripHtml(context?.descripcion ?? ''),
        entregable: context?.entregable?.toString?.().trim?.() ?? ''
      },
      conceptGroups
    }
  };
};

const enrichMiniproyectoResponse = (value, context = {}) => {
  if (value === undefined) return value;

  const parsed = tryParseJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  if (parsed.tipo && normalizeText(parsed.tipo) === 'programacion') {
    return JSON.stringify(parsed);
  }

  return JSON.stringify(buildAutoRubric(parsed, context));
};

const getConceptCoverageFromGroup = (studentText = '', conceptGroup) => {
  if (!conceptGroup || !Array.isArray(conceptGroup.anchors) || conceptGroup.anchors.length === 0) {
    return 0;
  }

  const normalizedStudent = normalizeText(studentText);
  if (!normalizedStudent) return 0;

  const matchedAnchors = conceptGroup.anchors.filter((anchor) => (
    Array.isArray(anchor) && anchor.some((alias) => normalizedStudent.includes(normalizeText(alias)))
  )).length;

  return matchedAnchors / conceptGroup.anchors.length;
};

module.exports = {
  enrichMiniproyectoResponse,
  getConceptCoverageFromGroup
};