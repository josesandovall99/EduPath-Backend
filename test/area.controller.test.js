jest.mock('../src/models', () => ({
  Area: {
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

const { createArea } = require('../src/controllers/area.controller');
const { Area, sequelize } = require('../src/models');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Area Controller — gestión por administrador', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createArea devuelve 400 si falta nombre', async () => {
    const req = { body: { nombre: '' }, tipoUsuario: 'ADMINISTRADOR' };
    const res = mockRes();

    await createArea(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('createArea devuelve 400 si se indica area pilar sin tipo', async () => {
    const req = { body: { nombre: 'Área X', es_area_pilar: true }, tipoUsuario: 'ADMINISTRADOR' };
    const res = mockRes();

    await createArea(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('createArea crea area con éxito (no pilar)', async () => {
    const req = { body: { nombre: 'Área Normal', descripcion: 'Desc' }, tipoUsuario: 'ADMINISTRADOR' };
    const res = mockRes();

    // Simular transacción
    const commit = jest.fn().mockResolvedValue();
    const rollback = jest.fn().mockResolvedValue();
    sequelize.transaction.mockResolvedValue({ commit, rollback });

    // Area.create devuelve un objeto con toJSON
    const createdArea = { id: 10, nombre: 'Área Normal', descripcion: 'Desc', estado: true, toJSON() { return { id: 10, nombre: 'Área Normal', descripcion: 'Desc', estado: true }; } };
    Area.create.mockResolvedValue(createdArea);

    await createArea(req, res);

    expect(Area.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Área Normal' }), expect.any(Object));
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 10, nombre: 'Área Normal' }));
  });
});
