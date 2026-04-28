const axios = require('axios');

const serviceModulePath = require.resolve('../src/services/evaluadorCasosPrueba');

function toBase64(value) {
  return Buffer.from(String(value)).toString('base64');
}

function cargarServicioConMock(mockPost) {
  const originalPost = axios.post;
  const originalUrl = process.env.JUDGE0_URL;
  const originalKey = process.env.JUDGE0_KEY;

  process.env.JUDGE0_URL = 'https://judge0.test';
  process.env.JUDGE0_KEY = 'test-key';
  axios.post = mockPost;
  delete require.cache[serviceModulePath];

  const servicio = require('../src/services/evaluadorCasosPrueba');

  return {
    servicio,
    restore() {
      axios.post = originalPost;
      if (typeof originalUrl === 'undefined') delete process.env.JUDGE0_URL; else process.env.JUDGE0_URL = originalUrl;
      if (typeof originalKey === 'undefined') delete process.env.JUDGE0_KEY; else process.env.JUDGE0_KEY = originalKey;
      delete require.cache[serviceModulePath];
    }
  };
}

describe('evaluadorCasosPrueba service', () => {
  test('aprueba cuando los 3 casos pasan en secuencia', async () => {
    let llamadas = 0;
    const salidas = ['3', '7', '11'];
    const { servicio, restore } = cargarServicioConMock(async () => {
      const salida = salidas[llamadas];
      llamadas += 1;

      return {
        data: {
          stdout: toBase64(salida),
          status: { id: 3, description: 'Accepted' }
        }
      };
    });

    try {
      const resultado = await servicio.evaluarCasosPrueba(
        'return a + b;',
        62,
        [
          { inputs: '1,2', output: '3' },
          { inputs: '3,4', output: '7' },
          { inputs: '5,6', output: '11' }
        ],
        {
          nombre: 'sumar',
          retorno: 'int',
          parametros: [
            { nombre: 'a', tipo: 'int' },
            { nombre: 'b', tipo: 'int' }
          ],
          plantilla: 'public static int sumar(int a, int b) {\n    // TODO\n}'
        }
      );

      expect(llamadas).toBe(3);
      expect(resultado.cumple).toBe(true);
      expect(resultado.resultado).toBe('CUMPLE');
    } finally {
      restore();
    }
  });

  test('detiene la secuencia cuando falla un caso logico', async () => {
    let llamadas = 0;
    const salidas = ['3', '999'];
    const { servicio, restore } = cargarServicioConMock(async () => {
      const salida = salidas[llamadas];
      llamadas += 1;

      return {
        data: {
          stdout: toBase64(salida),
          status: { id: 3, description: 'Accepted' }
        }
      };
    });

    try {
      const resultado = await servicio.evaluarCasosPrueba(
        'return a + b;',
        62,
        [
          { inputs: '1,2', output: '3' },
          { inputs: '3,4', output: '7' },
          { inputs: '5,6', output: '11' }
        ],
        {
          nombre: 'sumar',
          retorno: 'int',
          parametros: [
            { nombre: 'a', tipo: 'int' },
            { nombre: 'b', tipo: 'int' }
          ],
          plantilla: 'public static int sumar(int a, int b) {\n    // TODO\n}'
        }
      );

      expect(llamadas).toBe(2);
      expect(resultado.cumple).toBe(false);
      expect(resultado.resultado).toBe('NO CUMPLE');
      expect(resultado.resultados[2].omitido).toBe(true);
    } finally {
      restore();
    }
  });

  test('reporta error tecnico de Judge0 sin marcar incorrecto logicamente', async () => {
    let llamadas = 0;
    const { servicio, restore } = cargarServicioConMock(async () => {
      llamadas += 1;
      if (llamadas === 1) {
        return {
          data: {
            stdout: toBase64('3'),
            status: { id: 3, description: 'Accepted' }
          }
        };
      }

      const error = new Error('timeout');
      error.code = 'ECONNABORTED';
      throw error;
    });

    try {
      const resultado = await servicio.evaluarCasosPrueba(
        'return a + b;',
        62,
        [
          { inputs: '1,2', output: '3' },
          { inputs: '3,4', output: '7' },
          { inputs: '5,6', output: '11' }
        ],
        {
          nombre: 'sumar',
          retorno: 'int',
          parametros: [
            { nombre: 'a', tipo: 'int' },
            { nombre: 'b', tipo: 'int' }
          ],
          plantilla: 'public static int sumar(int a, int b) {\n    // TODO\n}'
        }
      );

      expect(resultado.errorTecnico).toBe(true);
      expect(resultado.resultados[2].omitido).toBe(true);
    } finally {
      restore();
    }
  });

  test('extrae el metodo cuando el estudiante envia una clase Main completa', async () => {
    let primerCodigoEnviado = '';
    let llamadas = 0;

    const { servicio, restore } = cargarServicioConMock(async (_url, payload) => {
      llamadas += 1;
      if (!primerCodigoEnviado) {
        primerCodigoEnviado = Buffer.from(payload.source_code, 'base64').toString('utf8');
      }

      const salidas = ['8', '2', '4'];
      return {
        data: {
          stdout: toBase64(salidas[llamadas - 1]),
          status: { id: 3, description: 'Accepted' }
        }
      };
    });

    try {
      const resultado = await servicio.evaluarCasosPrueba(
        `public class Main {

    public static void main(String[] args) {
        int a = 5;
        int b = 3;
        int resultado = sumar(a, b);
        System.out.print(resultado);
    }

    public static int sumar(int a, int b) {
        return a + b;
    }
}`,
        62,
        [
          { inputs: '5,3', output: '8' },
          { inputs: '1,1', output: '2' },
          { inputs: '2,2', output: '4' }
        ],
        {
          nombre: 'sumar',
          retorno: 'int',
          parametros: [
            { nombre: 'a', tipo: 'int' },
            { nombre: 'b', tipo: 'int' }
          ],
          plantilla: 'public static int sumar(int a, int b) {\n    // TODO\n}'
        }
      );

      expect(resultado.cumple).toBe(true);
      expect(llamadas).toBe(3);
      expect(primerCodigoEnviado).toMatch(/public class Main/);
      expect(primerCodigoEnviado).toMatch(/public static int sumar\(int a, int b\)/);
      expect(primerCodigoEnviado).not.toMatch(/int resultado = sumar\(a, b\);/);
    } finally {
      restore();
    }
  });
});
