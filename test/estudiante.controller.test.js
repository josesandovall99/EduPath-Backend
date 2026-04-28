jest.mock('../src/models', () => ({
  Persona: { create: jest.fn() },
  Estudiante: { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() },
}));

jest.mock('../src/config/database', () => ({ transaction: jest.fn() }));

jest.mock('bcryptjs', () => ({ genSalt: jest.fn(), hash: jest.fn() }));

const { crearEstudiante } = require('../src/controllers/estudiante.controller');
const { Persona, Estudiante } = require('../src/models');
const db = require('../src/config/database');
const bcrypt = require('bcryptjs');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Estudiante Controller — crearEstudiante', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 si datos invalidos', async () => {
    const req = { body: { nombre: '', email: 'no-valido', codigoAcceso: '', contraseña: '123' } };
    const res = mockRes();

    // Simular transacción
    const rollback = jest.fn().mockResolvedValue();
    db.transaction.mockResolvedValue({ commit: jest.fn(), rollback });

    await crearEstudiante(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: expect.any(String) }));
    expect(rollback).toHaveBeenCalled();
  });

  test('crea estudiante correctamente (201) y hace commit', async () => {
    const req = { body: { nombre: 'Juan Perez', email: 'juan@edu.edu', codigoAcceso: 'juan1', contraseña: 'Abcd1234', codigoEstudiantil: 'E100', programa: 'Ing', semestre: 1 } };
    const res = mockRes();

    const commit = jest.fn().mockResolvedValue();
    const rollback = jest.fn().mockResolvedValue();
    db.transaction.mockResolvedValue({ commit, rollback });

    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashed');

    const personaObj = { id: 7, nombre: 'Juan Perez', email: 'juan@edu.edu', toJSON() { return { id: 7, nombre: 'Juan Perez', email: 'juan@edu.edu' }; } };
    Persona.create.mockResolvedValue(personaObj);

    const estudianteObj = { id: 20, persona_id: 7, codigoEstudiantil: 'E100' };
    Estudiante.create.mockResolvedValue(estudianteObj);

    await crearEstudiante(req, res);

    expect(Persona.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Juan Perez' }), expect.any(Object));
    expect(Estudiante.create).toHaveBeenCalledWith(expect.objectContaining({ codigoEstudiantil: 'E100' }), expect.any(Object));
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ persona: expect.any(Object), estudiante: estudianteObj }));
  });

  test('rollback y 500 si ocurre error en creación', async () => {
    const req = { body: { nombre: 'X', email: 'x@x.com', codigoAcceso: 'c', contraseña: 'Abcd1234' } };
    const res = mockRes();

    const commit = jest.fn().mockResolvedValue();
    const rollback = jest.fn().mockResolvedValue();
    db.transaction.mockResolvedValue({ commit, rollback });

    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashed');

    Persona.create.mockRejectedValue(new Error('DB error'));

    await crearEstudiante(req, res);

    expect(rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: expect.any(String) }));
  });
});
