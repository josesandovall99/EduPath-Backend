const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const { Persona, Docente, Area } = require("../models");
const { generarPassword } = require("../utils/generarCredenciales");
const enviarCorreoBienvenidaDocente = require("../utils/enviarCorreoBienvenidaDocente");
const {
  isNonEmptyString,
  isValidEmail,
  isStrongPassword,
  sanitizePlainText,
  removePersonaSensitiveFields,
} = require('../utils/inputSecurity');

/* =========================
   CREAR DOCENTE
========================= */
const crearDocente = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { nombre, email, codigoAcceso, especialidad, areaId } = req.body;

    if (!isNonEmptyString(nombre) || !isValidEmail(email) || !isNonEmptyString(codigoAcceso)) {
      await transaction.rollback();
      return res.status(400).json({
        mensaje: "Datos invalidos para crear docente",
      });
    }

    if (!areaId) {
      await transaction.rollback();
      return res.status(400).json({
        mensaje: "areaId es obligatorio",
      });
    }

    const area = await Area.findByPk(areaId, { transaction });
    if (!area) {
      await transaction.rollback();
      return res.status(404).json({
        mensaje: "Area no encontrada",
      });
    }

    const passwordPlano = generarPassword();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlano, salt);

    const persona = await Persona.create(
      {
        nombre: sanitizePlainText(nombre),
        email: email.trim().toLowerCase(),
        codigoAcceso: sanitizePlainText(codigoAcceso),
        contraseña: passwordHash,
        tipoUsuario: "DOCENTE",
      },
      { transaction }
    );

    const docente = await Docente.create(
      {
        persona_id: persona.id,
        area_id: areaId,
        especialidad,
      },
      { transaction }
    );

    await enviarCorreoBienvenidaDocente({
      email,
      nombre,
      codigoAcceso,
      password: passwordPlano
    });

    await transaction.commit();

    const docenteCreado = await Docente.findByPk(docente.id, {
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
        },
        {
          model: Area,
          as: "area",
        },
      ],
    });

    res.status(201).json({
      docente: {
        ...docenteCreado.toJSON(),
        persona: removePersonaSensitiveFields(docenteCreado.persona),
      },
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al crear docente",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER TODOS
========================= */
const obtenerDocentes = async (req, res) => {
  try {
    const docentes = await Docente.findAll({
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
        },
        {
          model: Area,
          as: "area",
        },
      ],
    });

    res.json(docentes);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener docentes",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerDocentePorId = async (req, res) => {
  try {
    const { id } = req.params;

    const docente = await Docente.findByPk(id, {
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
        },
        {
          model: Area,
          as: "area",
        },
      ],
    });

    if (!docente) {
      return res.status(404).json({
        mensaje: "Docente no encontrado",
      });
    }

    res.json(docente);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener docente",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarDocente = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const docente = await Docente.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      },
    });

    if (!docente) {
      return res.status(404).json({
        mensaje: "Docente no encontrado",
      });
    }

    const { nombre, email, codigoAcceso, contraseña, especialidad, areaId } = req.body;

    if (email !== undefined && !isValidEmail(email)) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Email invalido' });
    }

    if (contraseña !== undefined && !isStrongPassword(contraseña)) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Contraseña insegura' });
    }

    if (!areaId) {
      await transaction.rollback();
      return res.status(400).json({
        mensaje: "areaId es obligatorio",
      });
    }

    const area = await Area.findByPk(areaId, { transaction });
    if (!area) {
      await transaction.rollback();
      return res.status(404).json({
        mensaje: "Area no encontrada",
      });
    }

    const personaUpdate = {
      ...(nombre !== undefined && { nombre: sanitizePlainText(nombre) }),
      ...(email !== undefined && { email: email.trim().toLowerCase() }),
      ...(codigoAcceso !== undefined && { codigoAcceso: sanitizePlainText(codigoAcceso) }),
    };
    if (contraseña) {
      const salt = await bcrypt.genSalt(10);
      personaUpdate.contraseña = await bcrypt.hash(contraseña, salt);
    }

    await docente.persona.update(personaUpdate, { transaction });

    const docenteUpdate = { especialidad, area_id: areaId };

    await docente.update(docenteUpdate, { transaction });

    await transaction.commit();

    const docenteActualizado = await Docente.findByPk(docente.id, {
      include: [
        {
          model: Persona,
          as: "persona",
          attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
        },
        {
          model: Area,
          as: "area",
        },
      ],
    });

    res.json({
      mensaje: "Docente actualizado correctamente",
      docente: {
        ...docenteActualizado.toJSON(),
        persona: removePersonaSensitiveFields(docenteActualizado.persona),
      },
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al actualizar docente",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarDocente = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const docente = await Docente.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      },
    });

    if (!docente) {
      return res.status(404).json({
        mensaje: "Docente no encontrado",
      });
    }

    await docente.destroy({ transaction });
    await docente.persona.destroy({ transaction });

    await transaction.commit();

    res.json({
      mensaje: "Docente eliminado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al eliminar docente",
      error: error.message,
    });
  }
};

/* =========================
   EXPORTS
========================= */
module.exports = {
  crearDocente,
  obtenerDocentes,
  obtenerDocentePorId,
  actualizarDocente,
  eliminarDocente,
};
