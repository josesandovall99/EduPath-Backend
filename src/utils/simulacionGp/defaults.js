/**
 * Plantillas por variante para Simulación GP (gestión de proyectos).
 * Deben mantenerse alineadas con el frontend `pmSimulationSpecTemplates.ts`.
 */

const VARIANTES = ['mapa_poder', 'edt'];

const defaultMapaPoder = () => ({
  stakeholders: [
    {
      id: 'gerente',
      nombre: 'Gerente de la Cooperativa',
      descripcion: 'Aprueba el presupuesto y las prioridades del proyecto CACATUMBO.',
    },
    {
      id: 'lider_vereda',
      nombre: 'Líder de Vereda',
      descripcion: 'Representa a las familias beneficiarias; alto interés en resultados locales.',
    },
    {
      id: 'minagricultura',
      nombre: 'Ministerio de Agricultura',
      descripcion: 'Marca normativa y puede condicionar recursos; alto poder regulatorio.',
    },
    {
      id: 'ong',
      nombre: 'ONG aliada',
      descripcion: 'Apoyo técnico esporádico; interés medio y poco poder de decisión.',
    },
  ],
  solucion: {
    gerente: 'gestionar_cerca',
    lider_vereda: 'mantener_informado',
    minagricultura: 'mantener_satisfecho',
    ong: 'monitorear',
  },
  feedback: {
    gerente: {
      monitorear: 'El Gerente aprueba el presupuesto: tiene alto poder e interés directo. Debe gestionarse de cerca, no solo monitorearse.',
      mantener_informado: 'Este interesado tiene alto poder y alto interés; la casilla correcta es Gestionar de cerca.',
      mantener_satisfecho: 'No es solo un ente regulador distante: está comprometido con el proyecto. Revisa poder e interés.',
    },
  },
});

const defaultEdt = () => {
  const contexto =
    'Contexto del ejercicio: «Descomponiendo el Sistema Cacao-Gestión»\n\n' +
    'Situación: Tras la firma del Acta de Constitución, la cooperativa CACATUMBO en Tibú requiere que definas con exactitud el ' +
    'alcance del proyecto. El administrador ha enfatizado que el éxito depende de que el sistema no solo funcione técnicamente, ' +
    'sino que los datos de los 200 agricultores migren correctamente desde los cuadernos actuales y que las familias aprendan a ' +
    'usar la herramienta.\n\n' +
    'Instrucción: Construye una EDT orientada a entregables que cumpla con la «Regla del 100%» (el trabajo de los niveles ' +
    'inferiores debe sumar el 100% del nivel superior) y la «Regla del 8/80» (ningún paquete de trabajo debe tener menos de 8 horas ' +
    'ni más de 80 horas de esfuerzo).\n\n' +
    'Estructura (PMBOK® 6): nivel 1 = proyecto; nivel 2 = entregables obligatorios E1–E3 y E4 (gestión); nivel 3 = paquetes de trabajo. ' +
    'Abajo, arrastra desde el carril de entregables a las casillas de nivel 2 y desde el carril de paquetes a las de nivel 3.';

  return {
    raiz: { id: 'cac', titulo: '1.0 Sistema Web «Cacao-Gestión»' },
    contexto,
    tareas: [
      { id: 'cac', titulo: '1.0 Sistema Web «Cacao-Gestión»', parentCorrect: null, orden: 0 },
      { id: 'e1_sw', titulo: 'E1: Producto Software', parentCorrect: 'cac', orden: 1 },
      { id: 'e2_imp', titulo: 'E2: Implementación del Producto', parentCorrect: 'cac', orden: 2 },
      { id: 'e3_cap', titulo: 'E3: Capacitación a Usuarios', parentCorrect: 'cac', orden: 3 },
      { id: 'e4_gp', titulo: 'E4: Gestión del Proyecto', parentCorrect: 'cac', orden: 4 },
      {
        id: 'sw_111',
        titulo: '1.1.1 Módulo de registro de agricultores y veredas',
        parentCorrect: 'e1_sw',
        orden: 11,
      },
      {
        id: 'sw_112',
        titulo: '1.1.2 Base de datos centralizada (PostgreSQL)',
        parentCorrect: 'e1_sw',
        orden: 12,
      },
      {
        id: 'sw_113',
        titulo: '1.1.3 Módulo de registro de entregas y pesaje',
        parentCorrect: 'e1_sw',
        orden: 13,
      },
      {
        id: 'sw_114',
        titulo: '1.1.4 Módulo de liquidación automática de pagos',
        parentCorrect: 'e1_sw',
        orden: 14,
      },
      {
        id: 'sw_115',
        titulo: '1.1.5 Generador de reportes (Ministerio/Federación)',
        parentCorrect: 'e1_sw',
        orden: 15,
      },
      {
        id: 'im_121',
        titulo: '1.2.1 Configuración de infraestructura en la nube',
        parentCorrect: 'e2_imp',
        orden: 21,
      },
      {
        id: 'im_122',
        titulo: '1.2.2 Migración de datos históricos (Excel/Cuadernos)',
        parentCorrect: 'e2_imp',
        orden: 22,
      },
      {
        id: 'im_123',
        titulo: '1.2.3 Ejecución de pruebas de aceptación (UAT)',
        parentCorrect: 'e2_imp',
        orden: 23,
      },
      {
        id: 'ca_131',
        titulo: '1.3.1 Elaboración de manuales de usuario y técnicos',
        parentCorrect: 'e3_cap',
        orden: 31,
      },
      {
        id: 'ca_132',
        titulo: '1.3.2 Talleres de formación para agricultores en Tibú',
        parentCorrect: 'e3_cap',
        orden: 32,
      },
      {
        id: 'ca_133',
        titulo: '1.3.3 Plan de soporte y transferencia operativa',
        parentCorrect: 'e3_cap',
        orden: 33,
      },
      {
        id: 'gp_141',
        titulo: '1.4.1 Elaboración del Plan de Dirección',
        parentCorrect: 'e4_gp',
        orden: 41,
      },
      {
        id: 'gp_142',
        titulo: '1.4.2 Reuniones de seguimiento y control',
        parentCorrect: 'e4_gp',
        orden: 42,
      },
      {
        id: 'gp_143',
        titulo: '1.4.3 Cierre administrativo y lecciones aprendidas',
        parentCorrect: 'e4_gp',
        orden: 43,
      },
    ],
  };
};

function defaultSpecForVariante(variante) {
  switch (variante) {
    case 'mapa_poder':
      return defaultMapaPoder();
    case 'edt':
      return defaultEdt();
    default:
      return defaultMapaPoder();
  }
}

function defaultConfigForVariante(variante) {
  return {
    tipo: 'simulacion-gp',
    variante: VARIANTES.includes(variante) ? variante : 'mapa_poder',
    spec: defaultSpecForVariante(VARIANTES.includes(variante) ? variante : 'mapa_poder'),
  };
}

module.exports = {
  VARIANTES,
  defaultSpecForVariante,
  defaultConfigForVariante,
};
