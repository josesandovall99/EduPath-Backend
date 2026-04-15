const { Persona } = require("../models");
const bcrypt = require('bcryptjs');
const {
  isNonEmptyString,
  isStrongPassword,
  isValidEmail,
  sanitizePlainText,
  removePersonaSensitiveFields,
} = require('../utils/inputSecurity');

/* =========================
   CREAR PERSONA (BASE)
   ❗ NO crea estudiante ni admin
========================= */
const crearPersona = async (req, res) => {
  try {
    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
    } = req.body;

    // Validación básica
    if (!isNonEmptyString(nombre) || !isValidEmail(email) || !isNonEmptyString(codigoAcceso) || !isStrongPassword(contraseña)) {
      return res.status(400).json({
        mensaje: "Datos invalidos: valida nombre, email, codigo y contraseña segura",
      });
    }

    const passwordHash = await bcrypt.hash(contraseña, 10);

    const persona = await Persona.create({
      nombre: sanitizePlainText(nombre),
      email: email.trim().toLowerCase(),
      codigoAcceso: sanitizePlainText(codigoAcceso),
      contraseña: passwordHash,
      tipoUsuario: "PERSONA",
    });

    res.status(201).json(removePersonaSensitiveFields(persona));
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear persona",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER TODAS
========================= */
const obtenerPersonas = async (req, res) => {
  try {
    const personas = await Persona.findAll({
      attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
    });
    res.json(personas.map(removePersonaSensitiveFields));
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener personas",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerPersonaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const persona = await Persona.findByPk(id, {
      attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
    });
    if (!persona) {
      return res.status(404).json({
        mensaje: "Persona no encontrada",
      });
    }

    res.json(removePersonaSensitiveFields(persona));
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener persona",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarPersona = async (req, res) => {
  try {
    const { id } = req.params;

    const persona = await Persona.findByPk(id);
    if (!persona) {
      return res.status(404).json({
        mensaje: "Persona no encontrada",
      });
    }

    // Campos protegidos
    delete req.body.fechaRegistro;
    delete req.body.tipoUsuario;

    const payload = {};
    if (req.body.nombre !== undefined) payload.nombre = sanitizePlainText(req.body.nombre);
    if (req.body.email !== undefined) {
      if (!isValidEmail(req.body.email)) {
        return res.status(400).json({ mensaje: 'Email invalido' });
      }
      payload.email = req.body.email.trim().toLowerCase();
    }
    if (req.body.codigoAcceso !== undefined) payload.codigoAcceso = sanitizePlainText(req.body.codigoAcceso);
    if (req.body.contraseña !== undefined) {
      if (!isStrongPassword(req.body.contraseña)) {
        return res.status(400).json({ mensaje: 'Contraseña insegura' });
      }
      payload.contraseña = await bcrypt.hash(req.body.contraseña, 10);
    }

    await persona.update(payload);

    res.json({
      mensaje: "Persona actualizada correctamente",
      persona: removePersonaSensitiveFields(persona),
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar persona",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
  Protegido por integridad
========================= */
const eliminarPersona = async (req, res) => {
  return res.status(400).json({
    mensaje:
      "No se puede eliminar una persona directamente. Elimine primero su rol (estudiante o administrador).",
  });
};

/* =========================
   EXPORTS
========================= */
module.exports = {
  crearPersona,
  obtenerPersonas,
  obtenerPersonaPorId,
  actualizarPersona,
  eliminarPersona,
};
