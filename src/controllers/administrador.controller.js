const sequelize = require("../config/database");
const bcrypt = require('bcryptjs');
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

    // 🔒 Encriptar contraseña antes de crear Persona
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(contraseña, salt);

    // 1️⃣ Crear Persona
    const persona = await Persona.create(
      {
        nombre,
        email,
        codigoAcceso,
        contraseña: passwordHash,
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

    // 1️⃣ Actualizar Persona (hashear contraseña si es enviada)
    const personaUpdate = { nombre, email, codigoAcceso };
    if (contraseña) {
      const salt = await bcrypt.genSalt(10);
      personaUpdate.contraseña = await bcrypt.hash(contraseña, salt);
    }

    await administrador.persona.update(personaUpdate, { transaction });

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

    if (administrador.persona.estado === false) {
      await transaction.rollback();
      return res.json({
        mensaje: 'Administrador ya estaba inhabilitado',
      });
    }

    await administrador.persona.update({ estado: false }, { transaction });

    await transaction.commit();

    res.json({
      mensaje: "Administrador inhabilitado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al inhabilitar administrador",
      error: error.message,
    });
  }
};

const toggleEstadoAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: {
        model: Persona,
        as: 'persona',
      },
    });

    if (!administrador) {
      await transaction.rollback();
      return res.status(404).json({ mensaje: 'Administrador no encontrado' });
    }

    const nuevoEstado = administrador.persona.estado === false;
    await administrador.persona.update({ estado: nuevoEstado }, { transaction });

    await transaction.commit();

    return res.json({
      mensaje: `Administrador ${nuevoEstado ? 'habilitado' : 'inhabilitado'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      mensaje: 'Error al cambiar el estado del administrador',
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
  toggleEstadoAdministrador,
};
