const bcrypt = require('bcryptjs');

jest.mock('../src/models', () => ({
  Estudiante: { findOne: jest.fn() },
  Persona: { findByPk: jest.fn() },
  Administrador: {},
  Docente: {},
  Area: {},
}));

jest.mock('../src/utils/jwt', () => ({ signAccessToken: jest.fn(() => 'tokentest') }));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), genSalt: jest.fn(), hash: jest.fn() }));

const { loginEstudiante } = require('../src/controllers/auth.controller');
const { Estudiante } = require('../src/models');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('loginEstudiante', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 si faltan campos', async () => {
    const req = { body: { codigoEstudiantil: '', contraseña: '' } };
    const res = mockRes();
    await loginEstudiante(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: expect.any(String) }));
  });

  test('devuelve 404 si usuario no existe', async () => {
    Estudiante.findOne.mockResolvedValue(null);
    const req = { body: { codigoEstudiantil: 'A1', contraseña: 'x' } };
    const res = mockRes();
    await loginEstudiante(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Usuario no encontrado' }));
  });

  test('devuelve 401 si contraseña incorrecta', async () => {
    Estudiante.findOne.mockResolvedValue({ persona: { contraseña: 'hash' }, id: 1, codigoEstudiantil: 'A1', semestre: 1 });
    bcrypt.compare.mockResolvedValue(false);
    const req = { body: { codigoEstudiantil: 'A1', contraseña: 'wrong' } };
    const res = mockRes();
    await loginEstudiante(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Contraseña incorrecta' }));
  });

  test('login exitoso devuelve token y datos', async () => {
    const persona = { id: 10, contraseña: 'hash', primer_ingreso: true, nombre: 'Test' };
    Estudiante.findOne.mockResolvedValue({ persona, id: 5, codigoEstudiantil: 'A1', semestre: 2 });
    bcrypt.compare.mockResolvedValue(true);
    const req = { body: { codigoEstudiantil: 'A1', contraseña: 'right' } };
    const res = mockRes();
    await loginEstudiante(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: 'Bienvenido',
      primerIngreso: persona.primer_ingreso,
      token: 'tokentest',
      estudiante: expect.objectContaining({ id: 5, personaId: persona.id })
    }));
  });
});
