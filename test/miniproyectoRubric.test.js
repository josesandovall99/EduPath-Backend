const test = require('node:test');
const assert = require('node:assert/strict');

const {
  enrichMiniproyectoResponse,
  getConceptCoverageFromGroup,
} = require('../src/utils/miniproyectoRubric');

test('enrichMiniproyectoResponse injects auto rubric for analysis miniprojects', () => {
  const storedPayload = enrichMiniproyectoResponse(JSON.stringify({
    stakeholders: ['Docente del curso'],
    requisitosFuncionales: ['El sistema debe permitir iniciar sesion del estudiante y registrar su asistencia.'],
    requisitosNoFuncionales: ['Debe proteger los datos personales y responder en menos de 3 segundos.']
  }), {
    titulo: 'Sistema academico',
    descripcion: 'Caso de uso para seguimiento estudiantil',
    entregable: 'Documento de analisis'
  });

  const parsedPayload = JSON.parse(storedPayload);

  assert.equal(parsedPayload.rubrica.mode, 'analysis');
  assert.equal(parsedPayload.rubrica.generatedBy, 'system');
  assert.equal(Array.isArray(parsedPayload.rubrica.sections), true);
  assert.equal(parsedPayload.rubrica.sections[0].validator, 'text');
  assert.equal(parsedPayload.rubrica.conceptGroups.requisitosFuncionales.length, 1);
  assert.equal(parsedPayload.rubrica.contextoBase.titulo, 'Sistema academico');

  const coverage = getConceptCoverageFromGroup(
    'La plataforma debe permitir login del alumno y guardar la asistencia.',
    parsedPayload.rubrica.conceptGroups.requisitosFuncionales[0]
  );

  assert.ok(coverage >= 0.5);
});

test('enrichMiniproyectoResponse preserves programming miniproject payloads', () => {
  const storedPayload = enrichMiniproyectoResponse(JSON.stringify({
    tipo: 'programacion',
    esperado: '1 2 3',
    sintaxis: ['for'],
    lenguajesPermitidos: [71]
  }));

  const parsedPayload = JSON.parse(storedPayload);
  assert.equal(parsedPayload.tipo, 'programacion');
  assert.equal(Object.prototype.hasOwnProperty.call(parsedPayload, 'rubrica'), false);
});

test('enrichMiniproyectoResponse injects charter objective into management rubric', () => {
  const storedPayload = enrichMiniproyectoResponse(JSON.stringify({
    objetivoPrincipal: ['Digitalizar el proceso de matricula para reducir tiempos y errores operativos.'],
    objetivosEspecificos: ['Permitir el registro en linea', 'Reducir errores administrativos'],
    entregables: ['Modulo de matricula en linea'],
    cronograma: ['Hito 1: Analisis | Inicio: 2026-04-01 | Fin: 2026-04-05'],
    costos: ['Entregable 1: Modulo de matricula en linea | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000']
  }), {
    titulo: 'Sistema de matricula',
    descripcion: 'Charter base del proyecto',
    entregable: 'Propuesta inicial'
  });

  const parsedPayload = JSON.parse(storedPayload);

  assert.equal(parsedPayload.rubrica.mode, 'management');
  assert.equal(parsedPayload.rubrica.sections[0].key, 'objetivoPrincipal');
  assert.equal(parsedPayload.rubrica.sections[0].weight, 15);
  assert.equal(parsedPayload.rubrica.conceptGroups.objetivoPrincipal.length, 1);
  assert.equal(parsedPayload.rubrica.conceptGroups.objetivosEspecificos.length, 2);
});

test('enrichMiniproyectoResponse registers dynamic custom text sections', () => {
  const storedPayload = enrichMiniproyectoResponse(JSON.stringify({
    casosDeUso: ['El sistema debe permitir consultar pedidos pendientes y confirmar su despacho.'],
    restricciones: ['La informacion del cliente debe permanecer protegida.']
  }), {
    titulo: 'Sistema logistico',
    descripcion: 'Miniproyecto con campos abiertos personalizados',
    entregable: 'Documento funcional'
  });

  const parsedPayload = JSON.parse(storedPayload);

  assert.equal(parsedPayload.rubrica.mode, 'custom');
  assert.equal(parsedPayload.rubrica.sections.length, 2);
  assert.deepEqual(
    parsedPayload.rubrica.sections.map((section) => section.key),
    ['casosDeUso', 'restricciones']
  );
  assert.equal(parsedPayload.rubrica.sections.every((section) => section.validator === 'text'), true);
  assert.equal(parsedPayload.rubrica.conceptGroups.casosDeUso.length, 1);
});