jest.mock('../src/models', () => ({
  Persona: { create: jest.fn() },
  Estudiante: { create: jest.fn() },
}));

jest.mock('../src/config/database', () => ({ transaction: jest.fn() }));

jest.mock('read-excel-file/node');
jest.mock('../src/utils/colaCorreos', () => jest.fn());
jest.mock('../src/utils/generarCredenciales', () => ({ generarPassword: jest.fn(() => 'pass123'), generarCodigoAcceso: jest.fn(() => 'code123') }));
jest.mock('bcryptjs', () => ({ genSalt: jest.fn(), hash: jest.fn() }));

const readXlsxFile = require('read-excel-file/node');
const procesarCorreos = require('../src/utils/colaCorreos');
const { importarEstudiantesDesdeExcel } = require('../src/controllers/estudiante.controller');
const { Persona, Estudiante } = require('../src/models');
const db = require('../src/config/database');
const bcrypt = require('bcryptjs');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Estudiante Controller — importarEstudiantesDesdeExcel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 400 si no se recibe archivo', async () => {
    const req = { file: null };
    const res = mockRes();
    await importarEstudiantesDesdeExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('devuelve 400 si el archivo no tiene datos válidos', async () => {
    const req = { file: { buffer: Buffer.from('') } };
    const res = mockRes();

    readXlsxFile.mockResolvedValue([]);

    const rollback = jest.fn().mockResolvedValue();
    db.transaction.mockResolvedValue({ commit: jest.fn(), rollback });

    await importarEstudiantesDesdeExcel(req, res);

    expect(rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('importa filas completas y llama procesarCorreos', async () => {
    const req = { file: { buffer: Buffer.from('') } };
    const res = mockRes();

    // Primera fila: headers
    const rows = [
      ['Nombres','Apellidos','Email_institucional','CodigoEstudiantil','Programa','Semestre'],
      ['Juan','Perez','juan@edu.edu','E001','Ing','1'],
      ['Empty','','','','','']
    ];

    readXlsxFile.mockResolvedValue(rows);

    const commit = jest.fn().mockResolvedValue();
    const rollback = jest.fn().mockResolvedValue();
    db.transaction.mockResolvedValue({ commit, rollback });

    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashed');

    Persona.create.mockResolvedValue({ id: 1 });
    Estudiante.create.mockResolvedValue({ id: 2 });

    await importarEstudiantesDesdeExcel(req, res);

    expect(Persona.create).toHaveBeenCalled();
    expect(Estudiante.create).toHaveBeenCalled();
    expect(procesarCorreos).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ email: 'juan@edu.edu' })]));
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  test('rollback y 500 si ocurre error durante import', async () => {
    const req = { file: { buffer: Buffer.from('') } };
    const res = mockRes();

    readXlsxFile.mockResolvedValue([
      ['Nombres','Apellidos','Email_institucional','CodigoEstudiantil','Programa','Semestre'],
      ['Juan','Perez','juan@edu.edu','E001','Ing','1']
    ]);

    const commit = jest.fn().mockResolvedValue();
    const rollback = jest.fn().mockResolvedValue();
    db.transaction.mockResolvedValue({ commit, rollback });

    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashed');

    Persona.create.mockResolvedValue({ id: 1 });
    Estudiante.create.mockRejectedValue(new Error('DB error'));

    await importarEstudiantesDesdeExcel(req, res);

    expect(rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
