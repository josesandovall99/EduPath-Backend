const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateResponse } = require('../src/controllers/respuestasEstudianteMiniproyecto.controller');

test('evaluateResponse approves coherent management proposals with justified alternative dates and costs', () => {
  const expected = JSON.stringify({
    alcance: [
      'Modulo de matricula en linea',
      'Notificaciones por correo y SMS',
      'Panel de administracion con reportes'
    ],
    cronograma: [
      'Actividad 1: Levantamiento de requisitos | Inicio: 2026-04-01 | Fin: 2026-04-05',
      'Actividad 2: Desarrollo del modulo | Inicio: 2026-04-06 | Fin: 2026-04-20',
      'Actividad 3: Pruebas y cierre | Inicio: 2026-04-21 | Fin: 2026-04-25'
    ],
    costos: [
      'Costo 1: Analista | Tipo: Humano | Cantidad: 1 | Costo unitario: 3000000 | Subtotal: 3000000',
      'Costo 2: Desarrollador | Tipo: Humano | Cantidad: 2 | Costo unitario: 2800000 | Subtotal: 5600000',
      'Costo 3: Licencia SMS | Tipo: Material | Cantidad: 1 | Costo unitario: 600000 | Subtotal: 600000',
      'Total general: 9200000'
    ]
  });

  const student = {
    alcance: [
      'Matricula en linea para estudiantes',
      'Alertas por correo y SMS',
      'Panel administrativo con reportes de seguimiento'
    ],
    cronograma: [
      'Actividad 1: Requisitos y entrevistas | Inicio: 2026-04-03 | Fin: 2026-04-08',
      'Actividad 2: Implementacion del modulo principal | Inicio: 2026-04-09 | Fin: 2026-04-24',
      'Actividad 3: Pruebas y ajustes finales | Inicio: 2026-04-25 | Fin: 2026-04-29'
    ],
    costos: [
      'Costo 1: Analista funcional | Tipo: Humano | Cantidad: 1 | Costo unitario: 3200000 | Subtotal: 3200000',
      'Costo 2: Desarrollador backend | Tipo: Humano | Cantidad: 2 | Costo unitario: 3000000 | Subtotal: 6000000',
      'Costo 3: Licencia de mensajeria | Tipo: Material | Cantidad: 1 | Costo unitario: 850000 | Subtotal: 850000',
      'Total general: 10050000'
    ],
    justificacionGestion: 'Asumi un equipo pequeno de 1 analista y 2 desarrolladores. Mantengo una fase corta de pruebas al final y una licencia mensual de mensajeria porque el proyecto se plantea por fases semanales.'
  };

  const evaluation = evaluateResponse(student, expected);

  assert.ok(evaluation);
  assert.ok(evaluation.puntaje >= 70);

  const cronograma = evaluation.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');
  const costos = evaluation.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');

  assert.ok(cronograma);
  assert.ok(costos);
  assert.ok(cronograma.puntaje >= 70);
  assert.ok(costos.puntaje >= 70);
});

test('evaluateResponse rejects incoherent management proposals even with the same section structure', () => {
  const expected = JSON.stringify({
    alcance: [
      'Modulo de matricula en linea',
      'Notificaciones por correo y SMS',
      'Panel de administracion con reportes'
    ],
    cronograma: [
      'Actividad 1: Levantamiento de requisitos | Inicio: 2026-04-01 | Fin: 2026-04-05',
      'Actividad 2: Desarrollo del modulo | Inicio: 2026-04-06 | Fin: 2026-04-20',
      'Actividad 3: Pruebas y cierre | Inicio: 2026-04-21 | Fin: 2026-04-25'
    ],
    costos: [
      'Costo 1: Analista | Tipo: Humano | Cantidad: 1 | Costo unitario: 3000000 | Subtotal: 3000000',
      'Costo 2: Desarrollador | Tipo: Humano | Cantidad: 2 | Costo unitario: 2800000 | Subtotal: 5600000',
      'Costo 3: Licencia SMS | Tipo: Material | Cantidad: 1 | Costo unitario: 600000 | Subtotal: 600000',
      'Total general: 9200000'
    ]
  });

  const student = {
    alcance: ['Panel bonito'],
    cronograma: [
      'Actividad 1: Desarrollo | Inicio: 2026-04-20 | Fin: 2026-04-10',
      'Actividad 2: Requisitos | Inicio: 2026-04-05 | Fin: 2026-04-02'
    ],
    costos: [
      'Costo 1: Papel | Tipo: Material | Cantidad: 1 | Costo unitario: 1000 | Subtotal: 900000',
      'Total general: 500'
    ],
    justificacionGestion: ''
  };

  const evaluation = evaluateResponse(student, expected);

  assert.ok(evaluation);
  assert.ok(evaluation.puntaje < 70);

  const cronograma = evaluation.criterios.find((criterio) => criterio.criterio === 'Cronograma del proyecto');
  const costos = evaluation.criterios.find((criterio) => criterio.criterio === 'Costos y recursos');

  assert.ok(cronograma);
  assert.ok(costos);
  assert.ok(cronograma.puntaje < 70);
  assert.ok(costos.puntaje < 70);
});