jest.mock('../src/models', () => ({
  Asignatura: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Miniproyecto: { findByPk: jest.fn(), create: jest.fn() },
  Actividad: { create: jest.fn() },
  TipoActividad: { findOne: jest.fn() },
  sequelize: { transaction: jest.fn() },
}));

const { createAsignatura } = require('../src/controllers/asignatura.controller');
const { Asignatura, sequelize } = require('../src/models');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Asignatura Controller — gestión por administrador', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createAsignatura devuelve 400 si falta nombre', async () => {
    const req = { body: { nombre: '' }, tipoUsuario: 'ADMINISTRADOR' };
    const res = mockRes();

    await createAsignatura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('createAsignatura devuelve 400 si se indica Asignatura pilar sin tipo', async () => {
    const req = { body: { nombre: 'Asignatura X', es_asignatura_pilar: true }, tipoUsuario: 'ADMINISTRADOR' };
    const res = mockRes();

    await createAsignatura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('createAsignatura crea Asignatura con éxito (no pilar)', async () => {
    const req = { body: { nombre: 'Asignatura Normal', descripcion: 'Desc' }, tipoUsuario: 'ADMINISTRADOR' };
    const res = mockRes();

    // Simular transacción
    const commit = jest.fn().mockResolvedValue();
    const rollback = jest.fn().mockResolvedValue();
    sequelize.transaction.mockResolvedValue({ commit, rollback });

    // Asignatura.create devuelve un objeto con toJSON
    const createdAsignatura = { id: 10, nombre: 'Asignatura Normal', descripcion: 'Desc', estado: true, toJSON() { return { id: 10, nombre: 'Asignatura Normal', descripcion: 'Desc', estado: true }; } };
    Asignatura.create.mockResolvedValue(createdAsignatura);

    await createAsignatura(req, res);

    expect(Asignatura.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Asignatura Normal' }), expect.any(Object));
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 10, nombre: 'Asignatura Normal' }));
  });
});
