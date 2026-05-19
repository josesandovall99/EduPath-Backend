const STOPWORDS = new Set([
  'para', 'como', 'este', 'esta', 'estos', 'estas', 'desde', 'hasta', 'sobre', 'entre', 'ante',
  'bajo', 'cada', 'cuando', 'donde', 'quien', 'cual', 'cuales', 'debe', 'deben', 'debera', 'debera',
  'deberan', 'puede', 'pueden', 'permitir', 'permite', 'mediante', 'proyecto', 'sistema', 'plataforma',
  'modulo', 'modulos', 'gestion', 'proceso', 'procesos', 'usuario', 'usuarios', 'datos', 'informacion',
  'registrar', 'realizar', 'tener', 'hacer', 'usar', 'utilizar', 'incluye', 'incluyen', 'con', 'sin',
  'del', 'las', 'los', 'una', 'unos', 'unas', 'por', 'que', 'sus', 'their', 'the'
]);

const TOKEN_ALIAS_CATALOG = {
  // Stakeholders
  estudiante: ['alumno', 'aprendiz', 'educando'],
  docente: ['profesor', 'instructor', 'maestro', 'catedratico'],
  administrador: ['admin', 'personal administrativo', 'gestion administrativa'],
  coordinador: ['director de programa', 'jefe de programa', 'coordinador academico'],
  cliente: ['usuario final', 'consumidor', 'interesado'],
  proveedor: ['suministrador', 'vendedor', 'tercero', 'aliado'],
  directivo: ['gerente', 'director', 'jefe de proyecto', 'lider', 'patrocinador'],
  operador: ['operario', 'tecnico', 'trabajador', 'funcionario'],
  supervisor: ['jefe', 'encargado', 'responsable', 'monitor'],
  inversionista: ['socio', 'accionista', 'financiador'],
  // Funcionales
  registrar: ['guardar', 'crear', 'inscribir', 'agregar', 'capturar', 'ingresar'],
  consultar: ['ver', 'visualizar', 'listar', 'buscar', 'mostrar', 'obtener', 'consulta'],
  eliminar: ['borrar', 'quitar', 'dar de baja', 'remover', 'suprimir', 'anular'],
  actualizar: ['editar', 'modificar', 'cambiar', 'corregir', 'ajustar'],
  exportar: ['descargar', 'generar archivo', 'imprimir', 'extraer'],
  importar: ['cargar', 'subir archivo', 'carga masiva'],
  calcular: ['computar', 'procesar', 'obtener resultado', 'estimar'],
  validar: ['verificar', 'comprobar', 'revisar', 'confirmar'],
  filtrar: ['seleccionar', 'clasificar', 'ordenar resultados'],
  notificar: ['alertar', 'avisar', 'enviar correo', 'mandar mensaje'],
  autenticar: ['login', 'inicio de sesion', 'iniciar sesion', 'acceso al sistema'],
  autenticacion: ['login', 'inicio de sesion', 'credenciales', 'autorizacion de acceso'],
  autorizacion: ['permiso', 'rol de usuario', 'control de acceso', 'privilegio'],
  asignar: ['relacionar', 'asociar', 'vincular', 'designar'],
  // No funcionales
  seguridad: ['proteccion', 'acceso seguro', 'autorizacion', 'cifrado', 'encriptado'],
  privacidad: ['confidencialidad', 'proteccion de datos', 'datos personales', 'habeas data'],
  rendimiento: ['performance', 'rapidez', 'eficiencia', 'tiempo de respuesta', 'velocidad'],
  disponibilidad: ['uptime', 'servicio disponible', 'alta disponibilidad', 'siempre activo'],
  escalabilidad: ['crecer', 'crecimiento del sistema', 'escalar', 'capacidad de expansion'],
  mantenibilidad: ['mantenimiento', 'soporte tecnico', 'facilidad de cambios'],
  usabilidad: ['facilidad de uso', 'amigable', 'intuitivo', 'accesible', 'experiencia de usuario'],
  portabilidad: ['compatible', 'multiplataforma', 'adaptable'],
  confiabilidad: ['confiable', 'robusto', 'tolerante a fallos', 'estable'],
  // Cronograma
  fase: ['etapa', 'actividad principal', 'tarea principal'],
  hito: ['milestone', 'entregable clave', 'punto de control'],
  analisis: ['levantamiento', 'diagnostico', 'relevamiento', 'elicitacion', 'recopilacion de requisitos'],
  diseno: ['disenio', 'arquitectura', 'modelado', 'prototipo'],
  desarrollo: ['implementacion', 'programacion', 'codificacion', 'construccion'],
  pruebas: ['testing', 'calidad', 'validacion final', 'qa', 'control de calidad'],
  despliegue: ['puesta en produccion', 'lanzamiento', 'deploy', 'entrega final'],
  capacitacion: ['entrenamiento', 'formacion', 'induccion', 'adiestramiento'],
  // Costos y recursos
  analista: ['analista de sistemas', 'analista funcional', 'analista de requisitos'],
  programador: ['desarrollador de software', 'ingeniero de software', 'desarrollador web'],
  servidor: ['hosting', 'alojamiento web', 'vps', 'nube', 'cloud'],
  licencia: ['licencias de software', 'suscripcion', 'plan de servicio'],
  soporte: ['mantenimiento correctivo', 'mantenimiento preventivo', 'servicio postventa'],
  // Dominio general
  inventario: ['stock', 'existencias', 'kardex'],
  venta: ['ventas', 'comercializacion', 'factura'],
  compra: ['compras', 'adquisicion', 'orden de compra'],
  pedido: ['orden', 'solicitud', 'encargo', 'orden de pedido', 'pedido del cliente'],
  reporte: ['informe', 'estadistica', 'dashboard', 'tablero', 'reporte de produccion'],
  cronograma: ['planificacion', 'plan de trabajo', 'calendario del proyecto'],
  alcance: ['scope', 'cobertura', 'limites del proyecto', 'funcionalidades'],
  costo: ['presupuesto', 'gasto', 'inversion', 'valor estimado'],
  recurso: ['insumo', 'material', 'personal', 'activo'],
  farmacia: ['drogueria', 'botica'],
  drogueria: ['farmacia', 'botica'],
  zapateria: ['tienda de calzado', 'calzado'],
  calzado: ['zapatos', 'zapateria'],
  // --- Vocabulario específico miniproyecto Análisis (EcoMarket) ---
  empleado: ['trabajador', 'operario', 'cajero', 'vendedor', 'encargado de pedidos', 'empleado de registro'],
  repartidor: ['mensajero', 'domiciliario', 'conductor', 'transportador', 'delivery', 'personal de entregas', 'persona de entregas'],
  ecologico: ['organico', 'natural', 'verde', 'sostenible', 'eco'],
  estado: ['estado del pedido', 'pendiente', 'en proceso', 'entregado', 'seguimiento', 'rastreo'],
  // --- Vocabulario específico miniproyecto ATC (CACATUMBO) ---
  agricultor: ['productor', 'campesino', 'asociado', 'cacaotero', 'cultivador', 'cooperativista', 'agricultor asociado'],
  cacao: ['cosecha de cacao', 'produccion de cacao', 'kilogramo de cacao', 'kilo de cacao', 'entrega de cacao'],
  cosecha: ['entrega de cosecha', 'recoleccion', 'produccion agricola', 'cosecha de cacao'],
  cooperativa: ['asociacion', 'cooperativa cacaotera', 'cacatumbo', 'entidad cooperativa'],
  precio: ['precio por kilo', 'precio por kilogramo', 'valor del kilo', 'tarifa del cacao', 'precio vigente'],
  manual: ['manual de usuario', 'guia de uso', 'documentacion', 'guia del usuario', 'instrucciones de uso'],
  liquidacion: ['calculo de pago', 'pago automatico', 'remuneracion', 'calculo automatico', 'pago del agricultor']
};

const PHRASE_ALIAS_CATALOG = [
  { pattern: 'inicio de sesion', aliases: ['login', 'autenticacion', 'acceso al sistema', 'identificacion de usuario'] },
  { pattern: 'iniciar sesion', aliases: ['login', 'autenticacion', 'acceso al sistema'] },
  { pattern: 'datos personales', aliases: ['informacion personal', 'proteccion de datos', 'privacidad', 'datos del usuario'] },
  { pattern: 'tiempo de respuesta', aliases: ['rendimiento', 'performance', 'rapidez', 'velocidad del sistema'] },
  { pattern: 'panel de administracion', aliases: ['panel administrativo', 'dashboard administrativo', 'modulo de administracion'] },
  { pattern: 'usuario final', aliases: ['cliente', 'consumidor', 'beneficiario del sistema'] },
  { pattern: 'costo unitario', aliases: ['valor unitario', 'precio unitario', 'costo por unidad'] },
  { pattern: 'total general', aliases: ['costo total', 'presupuesto total', 'total del proyecto', 'valor total'] },
  { pattern: 'control de inventario', aliases: ['gestion de inventario', 'stock', 'existencias', 'kardex'] },
  { pattern: 'tienda de calzado', aliases: ['zapateria', 'calzado'] },
  { pattern: 'caso de uso', aliases: ['funcionalidad', 'requerimiento funcional', 'escenario de uso'] },
  { pattern: 'levantamiento de requisitos', aliases: ['analisis de requisitos', 'elicitacion', 'recopilacion de requisitos'] },
  { pattern: 'puesta en produccion', aliases: ['despliegue', 'deploy', 'lanzamiento', 'entrega final'] },
  { pattern: 'gestion de proyectos', aliases: ['direccion de proyectos', 'administracion de proyectos', 'gerencia de proyectos'] },
  { pattern: 'control de acceso', aliases: ['autorizacion', 'autenticacion por rol', 'acceso por rol', 'permisos de usuario'] },
  { pattern: 'base de datos', aliases: ['bd', 'db', 'almacenamiento de datos', 'repositorio de datos'] },
  { pattern: 'alta disponibilidad', aliases: ['disponibilidad del sistema', '99%', 'sin interrupciones'] },
  { pattern: 'experiencia de usuario', aliases: ['ux', 'usabilidad', 'interfaz amigable', 'facil de usar'] },
  { pattern: 'plan de trabajo', aliases: ['cronograma', 'calendario del proyecto', 'planificacion temporal'] },
  { pattern: 'recurso humano', aliases: ['personal', 'talento humano', 'equipo de trabajo'] },
  { pattern: 'costo de desarrollo', aliases: ['presupuesto de desarrollo', 'inversion en desarrollo', 'honorarios'] },
  // --- Frases específicas miniproyecto Análisis (EcoMarket) ---
  { pattern: 'personal de entregas', aliases: ['repartidor', 'domiciliario', 'mensajero', 'transportador', 'delivery', 'personal delivery'] },
  { pattern: 'estado del pedido', aliases: ['estado de la orden', 'seguimiento del pedido', 'pendiente', 'en proceso', 'entregado'] },
  { pattern: 'estado de las ordenes', aliases: ['estado de pedidos', 'seguimiento de ordenes', 'control de estados'] },
  { pattern: 'registro de clientes', aliases: ['modulo de clientes', 'gestion de clientes', 'base de datos de clientes'] },
  { pattern: 'gestion de pedidos', aliases: ['modulo de pedidos', 'administracion de pedidos', 'control de pedidos', 'manejo de pedidos'] },
  { pattern: 'control de estados', aliases: ['seguimiento de pedidos', 'rastreo de ordenes', 'monitoreo de pedidos', 'estado de pedidos'] },
  { pattern: 'buscar pedidos', aliases: ['filtrar pedidos', 'consultar pedidos', 'busqueda de pedidos', 'buscar por cliente', 'buscar por fecha'] },
  { pattern: 'empleados de registro', aliases: ['empleado', 'trabajador', 'operario del sistema', 'encargado de pedidos'] },
  // --- Frases específicas miniproyecto ATC (CACATUMBO) ---
  { pattern: 'registro de agricultores', aliases: ['modulo de agricultores', 'registro de asociados', 'modulo de productores', 'datos de agricultores'] },
  { pattern: 'entregas y pagos', aliases: ['modulo de entregas', 'gestion de entregas', 'registro de cosechas', 'entregas de cacao'] },
  { pattern: 'registro de entregas', aliases: ['entrega de cacao', 'cosecha registrada', 'registro de cosecha', 'ingreso de cacao'] },
  { pattern: 'precio por kilo', aliases: ['precio del kilogramo', 'valor por kg', 'tarifa del cacao', 'precio vigente del cacao'] },
  { pattern: 'calculo automatico', aliases: ['pago automatico', 'calculo del pago', 'liquidacion automatica', 'calculo automatico del pago'] },
  { pattern: 'reporte de produccion', aliases: ['informe de produccion', 'estadisticas de produccion', 'reporte por agricultor', 'informe por periodo'] },
  { pattern: 'manual de usuario', aliases: ['guia de uso', 'documentacion del sistema', 'guia del usuario', 'manual de uso'] },
  { pattern: 'analisis de requerimientos', aliases: ['levantamiento de informacion', 'reunion inicial', 'recopilacion de requisitos', 'fase de analisis'] },
  { pattern: 'pruebas y cierre', aliases: ['testing y entrega', 'fase de pruebas', 'control de calidad y cierre', 'validacion final', 'pruebas del sistema'] }
];

const KNOWN_SECTION_CONFIG = {
  objetivoPrincipal: { label: 'Objetivo principal', weight: 15, validator: 'text' },
  objetivosEspecificos: { label: 'Objetivos específicos', weight: 15, validator: 'text' },
  stakeholders: { label: 'Stakeholders', weight: 25, validator: 'text' },
  requisitosFuncionales: { label: 'Requisitos funcionales', weight: 45, validator: 'text' },
  requisitosNoFuncionales: { label: 'Requisitos no funcionales', weight: 30, validator: 'text' },
  entregables: { label: 'Entregables clave', weight: 20, validator: 'text' },
  cronograma: { label: 'Cronograma del proyecto', weight: 25, validator: 'schedule' },
  costos: { label: 'Costos y recursos', weight: 25, validator: 'costs' }
};

const normalizeManagementMiniproyectoPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

  const objetivoPrincipal = payload.objetivoPrincipal !== undefined
    ? payload.objetivoPrincipal
    : payload.objetivo !== undefined
      ? payload.objetivo
      : [];

  return {
    ...payload,
    objetivoPrincipal,
    objetivosEspecificos: payload.objetivosEspecificos !== undefined ? payload.objetivosEspecificos : [],
    entregables: payload.entregables !== undefined ? payload.entregables : (payload.alcance !== undefined ? payload.alcance : []),
    cronograma: payload.cronograma !== undefined ? payload.cronograma : [],
    costos: payload.costos !== undefined ? payload.costos : []
  };
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
  if (sectionKeys.some((key) => ['objetivoPrincipal', 'objetivosEspecificos', 'entregables', 'alcance', 'cronograma', 'costos', 'objetivo'].includes(key))) return 'management';
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
  const normalizedPayload = normalizeManagementMiniproyectoPayload(payload);
  const mode = detectStructuredMode(normalizedPayload);
  if (!mode) return payload;

  const sectionDefinitions = buildSectionDefinitions(normalizedPayload);

  const conceptGroups = {};
  sectionDefinitions.forEach((section) => {
    conceptGroups[section.key] = buildConceptGroups(section.key, normalizedPayload[section.key]);
  });

  const existingRubrica = normalizedPayload.rubrica && typeof normalizedPayload.rubrica === 'object' && !Array.isArray(normalizedPayload.rubrica)
    ? normalizedPayload.rubrica
    : {};

  return {
    ...normalizedPayload,
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

  if (parsed.tipo && ['programacion', 'mvc'].includes(normalizeText(parsed.tipo))) {
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
  getConceptCoverageFromGroup,
  normalizeManagementMiniproyectoPayload
};