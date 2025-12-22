const sequelize = require("../config/database");
const { Persona, Administrador } = require("../models");

/* =========================
   CREAR ADMINISTRADOR
========================= */
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

    // 1️⃣ Crear Persona
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

    // 2️⃣ Crear Administrador
    const administrador = await Administrador.create(
      {
        persona_id: persona.id, // 🔥 FK correcta
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

/* =========================
   OBTENER TODOS
========================= */
const obtenerAdministradores = async (req, res) => {
  try {
    const administradores = await Administrador.findAll({
      include: {
        model: Persona,
        as: "persona",
      },
    });

    res.json(administradores);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener administradores",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerAdministradorPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      },
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
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      },
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

    // 1️⃣ Actualizar Persona
    await administrador.persona.update(
      { nombre, email, codigoAcceso, contraseña },
      { transaction }
    );

    // 2️⃣ Actualizar Administrador
    await administrador.update(
      { cargo, nivelAcceso },
      { transaction }
    );

    await transaction.commit();

    res.json({
      mensaje: "Administrador actualizado correctamente",
      administrador,
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al actualizar administrador",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      },
    });

    if (!administrador) {
      return res.status(404).json({
        mensaje: "Administrador no encontrado",
      });
    }

    // Primero el hijo
    await administrador.destroy({ transaction });
    // Luego el padre
    await administrador.persona.destroy({ transaction });

    await transaction.commit();

    res.json({
      mensaje: "Administrador eliminado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al eliminar administrador",
      error: error.message,
    });
  }
};

/* =========================
   EXPORTS
========================= */
module.exports = {
  crearAdministrador,
  obtenerAdministradores,
  obtenerAdministradorPorId,
  actualizarAdministrador,
  eliminarAdministrador,
};
