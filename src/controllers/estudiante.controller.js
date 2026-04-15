const sequelize = require("../config/database");
const { Persona, Estudiante } = require("../models");
const readXlsxFile = require('read-excel-file/node');
const procesarCorreos = require('../utils/colaCorreos');
const { generarPassword, generarCodigoAcceso } = require("../utils/generarCredenciales");
const bcrypt = require('bcryptjs'); 
const {
  isNonEmptyString,
  isStrongPassword,
  isValidEmail,
  sanitizePlainText,
  removePersonaSensitiveFields,
} = require('../utils/inputSecurity');

/* =========================
   CREAR ESTUDIANTE
========================= */
const crearEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { nombre, email, codigoAcceso, contraseña, codigoEstudiantil, programa, semestre } = req.body;

    if (!isNonEmptyString(nombre) || !isValidEmail(email) || !isNonEmptyString(codigoAcceso) || !isStrongPassword(contraseña)) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Datos invalidos para crear estudiante' });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(contraseña, salt);

    const persona = await Persona.create(
      {
        nombre,
        email: email.trim().toLowerCase(),
        codigoAcceso: sanitizePlainText(codigoAcceso),
        contraseña: passwordHash,
        tipoUsuario: "ESTUDIANTE",
      },
      { transaction }
    );

    const estudiante = await Estudiante.create(
  {
    persona_id: persona.id,
    codigoEstudiantil,
    programa,
    semestre,
  },
  { transaction }
);


    await transaction.commit();

    res.status(201).json({
      persona: removePersonaSensitiveFields(persona),
      estudiante,
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al crear estudiante",
      error: error.message,
    });
  }
};


/* =========================
   OBTENER TODOS
========================= */
const obtenerEstudiantes = async (req, res) => {
  try {
    const estudiantes = await Estudiante.findAll({
      include: {
        model: Persona,
        as: "persona",
        attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
      }
    });

    res.json(estudiantes);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener estudiantes",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerEstudiantePorId = async (req, res) => {
  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
        attributes: { exclude: ['contraseña', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
      }
    });

    if (!estudiante) {
      return res.status(404).json({
        mensaje: "Estudiante no encontrado",
      });
    }

    res.json(estudiante);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener estudiante",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      }
    });

    if (!estudiante) {
      return res.status(404).json({
        mensaje: "Estudiante no encontrado",
      });
    }

    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
      programa,
      semestre,
    } = req.body;

    if (email !== undefined && !isValidEmail(email)) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Email invalido' });
    }

    if (contraseña !== undefined && !isStrongPassword(contraseña)) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Contraseña insegura' });
    }

    const personaUpdate = {};
    if (nombre !== undefined) personaUpdate.nombre = sanitizePlainText(nombre);
    if (email !== undefined) personaUpdate.email = email.trim().toLowerCase();
    if (codigoAcceso !== undefined) personaUpdate.codigoAcceso = sanitizePlainText(codigoAcceso);
    if (contraseña !== undefined) personaUpdate.contraseña = await bcrypt.hash(contraseña, 10);

    await estudiante.persona.update(
      personaUpdate,
      { transaction }
    );

    await estudiante.update(
      { programa, semestre },
      { transaction }
    );

    await transaction.commit();

    res.json({
      mensaje: "Estudiante actualizado correctamente",
      estudiante: {
        ...estudiante.toJSON(),
        persona: removePersonaSensitiveFields(estudiante.persona),
      },
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al actualizar estudiante",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
========================= */
const eliminarEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: {
        model: Persona,
        as: "persona",
      }
    });

    if (!estudiante) {
      return res.status(404).json({
        mensaje: "Estudiante no encontrado",
      });
    }

    if (estudiante.persona.estado === false) {
      await transaction.rollback();
      return res.json({
        mensaje: 'Estudiante ya estaba inhabilitado',
      });
    }

    await estudiante.persona.update({ estado: false }, { transaction });

    await transaction.commit();

    res.json({
      mensaje: "Estudiante inhabilitado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al inhabilitar estudiante",
      error: error.message,
    });
  }
};

const toggleEstadoEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: {
        model: Persona,
        as: 'persona',
      }
    });

    if (!estudiante) {
      await transaction.rollback();
      return res.status(404).json({ mensaje: 'Estudiante no encontrado' });
    }

    const nuevoEstado = estudiante.persona.estado === false;
    await estudiante.persona.update({ estado: nuevoEstado }, { transaction });

    await transaction.commit();

    return res.json({
      mensaje: `Estudiante ${nuevoEstado ? 'habilitado' : 'inhabilitado'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      mensaje: 'Error al cambiar el estado del estudiante',
      error: error.message,
    });
  }
};

/* =========================
   IMPORTAR DESDE EXCEL
========================= */
const importarEstudiantesDesdeExcel = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ningún archivo" });
    }

    const rows = await readXlsxFile(req.file.buffer);
    if (!rows || rows.length < 2) {
      await transaction.rollback();
      return res.status(400).json({ message: 'El archivo no contiene datos validos' });
    }

    const headers = rows[0].map((cell) => String(cell || '').trim());
    const datos = [];
    rows.slice(1).forEach((row) => {
      const fila = {};
      for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
        const header = headers[colIndex];
        if (!header) continue;
        const value = row[colIndex];
        fila[header] = value !== null && value !== undefined ? String(value).trim() : '';
      }

      if (Object.keys(fila).length > 0) {
        datos.push(fila);
      }
    });

    console.log('Datos del Excel:', datos);

    const personasParaCorreo = [];

    for (const fila of datos) {
      const Nombres = fila["Nombres"];
      const Apellidos = fila["Apellidos"];
      const Email = fila["Email_institucional"];
      const CodigoEstudiantil = fila["CodigoEstudiantil"];
      const Programa = fila["Programa"];
      const Semestre = fila["Semestre"];

      if (!Nombres || !Apellidos || !Email || !CodigoEstudiantil) {
        console.log('Fila ignorada por datos incompletos:', fila);
        continue;
      }

      // Generar credenciales
      const passwordPlana = generarPassword();
      const codigoAcceso = generarCodigoAcceso();

      // Encriptar para la base de datos
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(passwordPlana, salt);

      // Crear persona
      const persona = await Persona.create(
        {
          nombre: `${Nombres} ${Apellidos}`,
          email: Email,
          contraseña: passwordHash,
          codigoAcceso,
          tipoUsuario: "ESTUDIANTE",
        },
        { transaction }
      );

      // Crear estudiante
      await Estudiante.create(
        {
          persona_id: persona.id,
          codigoEstudiantil: CodigoEstudiantil,
          programa: Programa,
          semestre: Semestre,
        },
        { transaction }
      );

      // Datos para el correo
      personasParaCorreo.push({
        nombre: `${Nombres} ${Apellidos}`,
        email: Email,
        codigoEstudiantil: CodigoEstudiantil,
        password: passwordPlana,
      });
    }

    await transaction.commit();

    // Envio de correos en segundo plano
    procesarCorreos(personasParaCorreo);

    res.status(201).json({
      message: `Se importaron ${personasParaCorreo.length} estudiantes correctamente`,
      total: personasParaCorreo.length,
    });

  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({
      message: "Error al importar estudiantes",
      error: error.message,
    });
  }
};




/* =========================
   EXPORTS
========================= */
module.exports = {
  crearEstudiante,
  obtenerEstudiantes,
  obtenerEstudiantePorId,
  actualizarEstudiante,
  eliminarEstudiante,
  toggleEstadoEstudiante,
  importarEstudiantesDesdeExcel,
};



