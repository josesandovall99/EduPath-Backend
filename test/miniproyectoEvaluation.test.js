const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateResponse } = require('../src/controllers/respuestasEstudianteMiniproyecto.controller');

test('evaluateResponse approves coherent management proposals with justified alternative dates and costs', () => {
  const expected = JSON.stringify({
    objetivoPrincipal: [
      'Digitalizar la matricula y el seguimiento del estudiante para reducir tiempos de atencion y errores administrativos.'
    ],
    objetivosEspecificos: [
      'Automatizar el registro de matriculas',
      'Mejorar la comunicación con el estudiante'
    ],
    entregables: [
      'Modulo de matricula en linea',
      'Notificaciones por correo y SMS',
      'Panel de administracion con reportes'
    ],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05',
      'Hito 2: Modulo implementado | Inicio: 2026-04-06 | Fin: 2026-04-20',
      'Hito 3: Pruebas y cierre | Inicio: 2026-04-21 | Fin: 2026-04-25'
    ],
    costos: [
      'Entregable 1: Modulo de matricula en linea | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Entregable 2: Notificaciones por correo y SMS | Unidad de medida: Licencia | Cantidad: 1 | Precio unitario: 600000 | Subtotal: 600000',
      'Entregable 3: Panel de administracion con reportes | Unidad de medida: Unidad | Cantidad: 2 | Precio unitario: 2800000 | Subtotal: 5600000',
      'Total: 9200000',
      'Imprevistos: 5% | Valor: 460000',
      'Utilidad: 10% | Valor: 920000',
      'Total proyecto: 10580000'
    ]
  });

  const student = {
    objetivoPrincipal: [
      'El proyecto busca pasar la matricula a un proceso digital para disminuir errores manuales y agilizar la atencion al estudiante.'
    ],
    objetivosEspecificos: [
      'Permitir la inscripción en línea',
      'Enviar notificaciones automáticas al estudiante'
    ],
    entregables: [
      'Matricula en linea para estudiantes',
      'Alertas por correo y SMS',
      'Panel administrativo con reportes de seguimiento'
    ],
    cronograma: [
      'Hito 1: Requisitos y entrevistas completados | Inicio: 2026-04-02 | Fin: 2026-04-07',
      'Hito 2: Implementacion del modulo principal | Inicio: 2026-04-08 | Fin: 2026-04-22',
      'Hito 3: Pruebas y ajustes finales | Inicio: 2026-04-23 | Fin: 2026-04-28'
    ],
    costos: [
      'Entregable 1: Matricula en linea para estudiantes | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3200000 | Subtotal: 3200000',
      'Entregable 2: Alertas por correo y SMS | Unidad de medida: Licencia | Cantidad: 1 | Precio unitario: 850000 | Subtotal: 850000',
      'Entregable 3: Panel administrativo con reportes de seguimiento | Unidad de medida: Unidad | Cantidad: 2 | Precio unitario: 3000000 | Subtotal: 6000000',
      'Total: 10050000',
      'Imprevistos: 5% | Valor: 502500',
      'Utilidad: 10% | Valor: 1005000',
      'Total proyecto: 11557500'
    ],
    supuestos: [
      'La institucion asigna 2 administrativos para validar requisitos durante la primera semana.',
      'El proyecto cuenta con 1 analista y 2 desarrolladores durante 4 semanas de ejecucion.',
      'La licencia de mensajeria se adquiere por 1 mes para cubrir el piloto inicial.',
      'Las pruebas finales se ejecutan en 5 dias habiles sin interrupciones operativas.'
    ]
  };

  const evaluation = evaluateResponse(student, expected);

  assert.ok(evaluation);
  assert.ok(evaluation.puntaje >= 70);

  const objetivo = evaluation.criterios.find((criterio) => criterio.criterio === 'Objetivo principal');
  const objetivosEspecificos = evaluation.criterios.find((criterio) => criterio.criterio === 'Objetivos específicos');
  const entregables = evaluation.criterios.find((criterio) => criterio.criterio === 'Entregables clave');
  const cronograma = evaluation.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');
  const costos = evaluation.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');

  assert.ok(objetivo);
  assert.ok(objetivosEspecificos);
  assert.ok(entregables);
  assert.ok(cronograma);
  assert.ok(costos);
  assert.ok(objetivo.puntaje >= 70);
  assert.ok(objetivosEspecificos.puntaje >= 70);
  assert.ok(entregables.puntaje >= 70);
  assert.ok(cronograma.puntaje >= 70);
  assert.ok(costos.puntaje >= 70);
});

test('evaluateResponse rejects incoherent management proposals even with the same section structure', () => {
  const expected = JSON.stringify({
    objetivoPrincipal: [
      'Digitalizar la matricula y el seguimiento del estudiante para reducir tiempos de atencion y errores administrativos.'
    ],
    objetivosEspecificos: [
      'Automatizar el registro de matriculas',
      'Mejorar la comunicación con el estudiante'
    ],
    entregables: [
      'Modulo de matricula en linea',
      'Notificaciones por correo y SMS',
      'Panel de administracion con reportes'
    ],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05',
      'Hito 2: Modulo implementado | Inicio: 2026-04-06 | Fin: 2026-04-20',
      'Hito 3: Pruebas y cierre | Inicio: 2026-04-21 | Fin: 2026-04-25'
    ],
    costos: [
      'Entregable 1: Modulo de matricula en linea | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Entregable 2: Notificaciones por correo y SMS | Unidad de medida: Licencia | Cantidad: 1 | Precio unitario: 600000 | Subtotal: 600000',
      'Entregable 3: Panel de administracion con reportes | Unidad de medida: Unidad | Cantidad: 2 | Precio unitario: 2800000 | Subtotal: 5600000',
      'Total: 9200000',
      'Imprevistos: 5% | Valor: 460000',
      'Utilidad: 10% | Valor: 920000',
      'Total proyecto: 10580000'
    ]
  });

  const student = {
    objetivoPrincipal: ['Hacer una pagina bonita para que se vea moderna.'],
    objetivosEspecificos: ['Cambiar colores', 'Poner mejores iconos'],
    entregables: ['Panel bonito'],
    cronograma: [
      'Hito 1: Desarrollo visual | Inicio: 2026-04-20 | Fin: 2026-04-10',
      'Hito 2: Requisitos | Inicio: 2026-04-05 | Fin: 2026-04-02'
    ],
    costos: [
      'Entregable 1: Papel | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 1000 | Subtotal: 900000',
      'Total: 500',
      'Imprevistos: 5% | Valor: 1000',
      'Utilidad: 10% | Valor: 2000',
      'Total proyecto: 800'
    ],
    justificacionGestion: ''
  };

  const evaluation = evaluateResponse(student, expected);

  assert.ok(evaluation);
  assert.ok(evaluation.puntaje < 70);

  const objetivo = evaluation.criterios.find((criterio) => criterio.criterio === 'Objetivo principal');
  const objetivosEspecificos = evaluation.criterios.find((criterio) => criterio.criterio === 'Objetivos específicos');
  const entregables = evaluation.criterios.find((criterio) => criterio.criterio === 'Entregables clave');
  const cronograma = evaluation.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');
  const costos = evaluation.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');

  assert.ok(objetivo);
  assert.ok(objetivosEspecificos);
  assert.ok(entregables);
  assert.ok(cronograma);
  assert.ok(costos);
  assert.ok(objetivo.puntaje < 70);
  assert.ok(objetivosEspecificos.puntaje < 70);
  assert.ok(entregables.puntaje < 70);
  assert.ok(cronograma.puntaje < 70);
  assert.ok(costos.puntaje < 70);
});

test('evaluateResponse gives full milestone coverage when student copies the same cronograma rows', () => {
  const expected = JSON.stringify({
    objetivoPrincipal: ['Digitalizar el proceso de matricula.'],
    objetivosEspecificos: ['Automatizar registros'],
    entregables: ['Modulo de matricula'],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05',
      'Hito 2: Modulo implementado | Inicio: 2026-04-06 | Fin: 2026-04-20',
      'Hito 3: Pruebas y cierre | Inicio: 2026-04-21 | Fin: 2026-04-25'
    ],
    costos: [
      'Entregable 1: Modulo de matricula | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Total: 3000000',
      'Imprevistos: 5% | Valor: 150000',
      'Utilidad: 10% | Valor: 300000',
      'Total proyecto: 3450000'
    ]
  });

  const student = {
    objetivoPrincipal: ['Digitalizar el proceso de matricula.'],
    objetivosEspecificos: ['Automatizar registros'],
    entregables: ['Modulo de matricula'],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05',
      'Hito 2: Modulo implementado | Inicio: 2026-04-06 | Fin: 2026-04-20',
      'Hito 3: Pruebas y cierre | Inicio: 2026-04-21 | Fin: 2026-04-25'
    ],
    costos: [
      'Entregable 1: Modulo de matricula | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Total: 3000000',
      'Imprevistos: 5% | Valor: 150000',
      'Utilidad: 10% | Valor: 300000',
      'Total proyecto: 3450000'
    ],
    supuestos: []
  };

  const evaluation = evaluateResponse(student, expected);
  const cronograma = evaluation.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');

  assert.ok(cronograma);
  assert.match(cronograma.detalle, /hitos clave \(100%\)/i);
  assert.equal(cronograma.puntaje, 100);
});

test('evaluateResponse keeps the same schedule and cost scores with or without assumptions', () => {
  const expected = JSON.stringify({
    objetivoPrincipal: ['Digitalizar el proceso de matricula.'],
    objetivosEspecificos: ['Automatizar registros'],
    entregables: ['Modulo de matricula'],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05'
    ],
    costos: [
      'Entregable 1: Modulo de matricula | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Total: 3000000',
      'Imprevistos: 5% | Valor: 150000',
      'Utilidad: 10% | Valor: 300000',
      'Total proyecto: 3450000'
    ]
  });

  const studentWithoutAssumptions = {
    objetivoPrincipal: ['Digitalizar el proceso de matricula.'],
    objetivosEspecificos: ['Automatizar registros'],
    entregables: ['Modulo de matricula'],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05'
    ],
    costos: [
      'Entregable 1: Modulo de matricula | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Total: 3000000',
      'Imprevistos: 5% | Valor: 150000',
      'Utilidad: 10% | Valor: 300000',
      'Total proyecto: 3450000'
    ],
    supuestos: []
  };

  const studentWithAssumptions = {
    ...studentWithoutAssumptions,
    supuestos: [
      'Se considera una licencia mensual para el modulo.',
      'El desarrollo se ejecuta con un recurso durante la ventana planificada.'
    ]
  };

  const evaluationWithoutAssumptions = evaluateResponse(studentWithoutAssumptions, expected);
  const evaluationWithAssumptions = evaluateResponse(studentWithAssumptions, expected);
  const cronogramaWithoutAssumptions = evaluationWithoutAssumptions.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');
  const cronogramaWithAssumptions = evaluationWithAssumptions.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');
  const costosWithoutAssumptions = evaluationWithoutAssumptions.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');
  const costosWithAssumptions = evaluationWithAssumptions.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');

  assert.ok(cronogramaWithoutAssumptions);
  assert.ok(cronogramaWithAssumptions);
  assert.ok(costosWithoutAssumptions);
  assert.ok(costosWithAssumptions);
  assert.equal(cronogramaWithoutAssumptions.puntaje, cronogramaWithAssumptions.puntaje);
  assert.equal(costosWithoutAssumptions.puntaje, costosWithAssumptions.puntaje);
});

test('evaluateResponse gives full cost score when student copies the same cost rows', () => {
  const expected = JSON.stringify({
    objetivoPrincipal: ['Digitalizar el proceso de matricula.'],
    objetivosEspecificos: ['Automatizar registros'],
    entregables: ['Modulo de matricula'],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05'
    ],
    costos: [
      'Entregable 1: Modulo de matricula | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Total: 3000000',
      'Imprevistos: 5% | Valor: 150000',
      'Utilidad: 10% | Valor: 300000',
      'Total proyecto: 3450000'
    ]
  });

  const student = {
    objetivoPrincipal: ['Digitalizar el proceso de matricula.'],
    objetivosEspecificos: ['Automatizar registros'],
    entregables: ['Modulo de matricula'],
    cronograma: [
      'Hito 1: Requisitos definidos | Inicio: 2026-04-01 | Fin: 2026-04-05'
    ],
    costos: [
      'Entregable 1: Modulo de matricula | Unidad de medida: Unidad | Cantidad: 1 | Precio unitario: 3000000 | Subtotal: 3000000',
      'Total: 3000000',
      'Imprevistos: 5% | Valor: 150000',
      'Utilidad: 10% | Valor: 300000',
      'Total proyecto: 3450000'
    ],
    supuestos: []
  };

  const evaluation = evaluateResponse(student, expected);
  const costos = evaluation.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');

  assert.ok(costos);
  assert.match(costos.detalle, /rubros \(100%\)/i);
  assert.match(costos.detalle, /consistencia aritm[eé]tica \(100%\)/i);
  assert.match(costos.detalle, /rango razonable del total \(100%\)/i);
  assert.match(costos.detalle, /tipo de costo \(100%\)/i);
  assert.equal(costos.puntaje, 100);
});