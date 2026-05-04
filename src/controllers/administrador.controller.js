const sequelize = require("../config/database");
const bcrypt = require('bcryptjs');
const { Persona, Administrador } = require("../models");
const { generarPassword } = require("../utils/generarCredenciales");
const enviarCorreoBienvenidaAdministrador = require("../utils/enviarCorreoBienvenidaAdministrador");
const {
  isNonEmptyString,
  isValidEmail,
  sanitizePlainText,
  removePersonaSensitiveFields,
} = require('../utils/inputSecurity');

const buildSequelizeValidationMessage = (error) => {
  if (!Array.isArray(error?.errors) || error.errors.length === 0) {
    return error?.message || 'Validation error';
  }

  return error.errors
    .map((detail) => detail.message)
    .filter(Boolean)
    .join(', ');
};

async function generarCodigoAdmin(transaction) {
  const personas = await Persona.findAll({
    where: { tipoUsuario: 'ADMINISTRADOR' },
    attributes: ['codigoAcceso'],
    transaction,
  });
  let max = 0;
  const re = /^ADM(\d+)$/;
  for (const p of personas) {
    const m = p.codigoAcceso?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ADM${String(max + 1).padStart(3, '0')}`;
}

/* =========================
   CREAR ADMINISTRADOR
========================= */
const crearAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { nombre, email } = req.body;

    if (!isNonEmptyString(nombre) || !isValidEmail(email)) {
      await transaction.rollback();
      return res.status(400).json({
        mensaje: "Datos invalidos para crear administrador",
      });
    }

    const codigoAcceso = await generarCodigoAdmin(transaction);
    const passwordPlano = generarPassword();

    // Encriptar contraseña antes de crear persona
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlano, salt);

    // 1️⃣ Crear Persona
    const persona = await Persona.create(
      {
        nombre: sanitizePlainText(nombre),
        email: email.trim().toLowerCase(),
        codigoAcceso,
        contraseña: passwordHash,
        tipoUsuario: "ADMINISTRADOR",
      },
      { transaction }
    );

    // 2️⃣ Crear Administrador
    const administrador = await Administrador.create(
      {
        persona_id: persona.id,
      },
      { transaction }
    );

    await enviarCorreoBienvenidaAdministrador({
      email,
      nombre,
      codigoAcceso,
      password: passwordPlano,
    });

    await transaction.commit();

    const administradorCreado = await Administrador.findByPk(administrador.id, {
      include: {
        model: Persona,
        as: 'persona',
        attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
      },
    });

    res.status(201).json({
      mensaje: 'Administrador creado correctamente y credenciales enviadas por correo.',
      administrador: {
        ...administradorCreado.toJSON(),
        persona: removePersonaSensitiveFields(administradorCreado.persona),
      },
    });
  } catch (error) {
    await transaction.rollback();

    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        mensaje: 'Ya existe un usuario registrado con ese correo.',
        error: buildSequelizeValidationMessage(error),
      });
    }

    if (error?.name === 'SequelizeValidationError') {
      return res.status(400).json({
        mensaje: 'Datos invalidos para crear administrador',
        error: buildSequelizeValidationMessage(error),
      });
    }

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
        attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
      },
    });

    res.json(administradores.map((administrador) => ({
      ...administrador.toJSON(),
      persona: removePersonaSensitiveFields(administrador.persona),
    })));
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
        attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
      },
    });

    if (!administrador) {
      return res.status(404).json({
        mensaje: "Administrador no encontrado",
      });
    }

    res.json({
      ...administrador.toJSON(),
      persona: removePersonaSensitiveFields(administrador.persona),
    });
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

    const { nombre, email, codigoAcceso, contraseña } = req.body;

    // 1️⃣ Actualizar Persona (hashear contraseña si es enviada)
    const personaUpdate = {
      ...(nombre !== undefined && { nombre: sanitizePlainText(nombre) }),
      ...(email !== undefined && { email: email.trim().toLowerCase() }),
      ...(codigoAcceso !== undefined && { codigoAcceso: sanitizePlainText(codigoAcceso) }),
    };
    if (contraseña) {
      const salt = await bcrypt.genSalt(10);
      personaUpdate.contraseña = await bcrypt.hash(contraseña, salt);
    }

    await administrador.persona.update(personaUpdate, { transaction });

    await transaction.commit();

    const administradorActualizado = await Administrador.findByPk(id, {
      include: {
        model: Persona,
        as: 'persona',
        attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
      },
    });

    res.json({
      mensaje: "Administrador actualizado correctamente",
      administrador: {
        ...administradorActualizado.toJSON(),
        persona: removePersonaSensitiveFields(administradorActualizado.persona),
      },
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
