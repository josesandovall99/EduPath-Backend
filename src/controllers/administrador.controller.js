const sequelize = require("../config/database");
const Persona = require("../models/persona.model");
const Administrador = require("../models/administrador.model");

/* CREAR ADMINISTRADOR */
const crearAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
      cargo,
      nivelAcceso,
    } = req.body;

    const persona = await Persona.create(
      {
        nombre,
        email,
        codigoAcceso,
        contraseña,
        tipoUsuario: "ADMINISTRADOR",
      },
      { transaction }
    );

    const administrador = await Administrador.create(
      {
        id: persona.id,
        cargo,
        nivelAcceso,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      persona,
      administrador,
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al crear administrador",
      error: error.message,
    });
  }
};

/* OBTENER TODOS */
const obtenerAdministradores = async (req, res) => {
  try {
    const administradores = await Administrador.findAll({
      include: Persona,
    });

    res.json(administradores);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener administradores",
    });
  }
};

/* OBTENER POR ID */
const obtenerAdministradorPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: Persona,
    });

    if (!administrador) {
      return res.status(404).json({
        mensaje: "Administrador no encontrado",
      });
    }

    res.json(administrador);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener administrador",
    });
  }
};

/* ACTUALIZAR */
const actualizarAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: Persona,
    });

    if (!administrador) {
      return res.status(404).json({
        mensaje: "Administrador no encontrado",
      });
    }

    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
      cargo,
      nivelAcceso,
    } = req.body;

    await administrador.Persona.update(
      { nombre, email, codigoAcceso, contraseña },
      { transaction }
    );

    await administrador.update(
      { cargo, nivelAcceso },
      { transaction }
    );

    await transaction.commit();

    res.json(administrador);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al actualizar administrador",
    });
  }
};

/* ELIMINAR */
const eliminarAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: Persona,
    });

    if (!administrador) {
      return res.status(404).json({
        mensaje: "Administrador no encontrado",
      });
    }

    await administrador.destroy({ transaction });
    await administrador.Persona.destroy({ transaction });

    await transaction.commit();

    res.json({
      mensaje: "Administrador eliminado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al eliminar administrador",
    });
  }
};

module.exports = {
  crearAdministrador,
  obtenerAdministradores,
  obtenerAdministradorPorId,
  actualizarAdministrador,
  eliminarAdministrador,
};
