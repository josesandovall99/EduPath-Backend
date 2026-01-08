const sequelize = require("../config/database");
const { Persona, Estudiante } = require("../models");
const XLSX = require('xlsx');
const procesarCorreos = require('../utils/colaCorreos');
const { generarPassword, generarCodigoAcceso } = require("../utils/generarCredenciales");
const bcrypt = require('bcryptjs'); 

/* =========================
   CREAR ESTUDIANTE
========================= */
const crearEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { nombre, email, codigoAcceso, contraseña, codigoEstudiantil, programa, semestre } = req.body;

    // 🔒 Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(contraseña, salt);

    const persona = await Persona.create(
      {
        nombre,
        email,
        codigoAcceso,
        contraseña: passwordHash, // <--- GUARDAMOS EL HASH, NO EL TEXTO PLANO
        tipoUsuario: "ESTUDIANTE",
      },
      { transaction }
    );

    const estudiante = await Estudiante.create(
  {
    persona_id: persona.id, // 🔥 CLAVE
    codigoEstudiantil,
    programa,
    semestre,
  },
  { transaction }
);


    await transaction.commit();

    res.status(201).json({
      persona,
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

    await estudiante.Persona.update(
      { nombre, email, codigoAcceso, contraseña },
      { transaction }
    );

    await estudiante.update(
      { programa, semestre },
      { transaction }
    );

    await transaction.commit();

    res.json({
      mensaje: "Estudiante actualizado correctamente",
      estudiante,
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

    // Primero el hijo
    await estudiante.destroy({ transaction });
    // Luego el padre
    await estudiante.Persona.destroy({ transaction });

    await transaction.commit();

    res.json({
      mensaje: "Estudiante eliminado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al eliminar estudiante",
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

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(hoja);

    console.log("📊 Datos del Excel:", datos);

    const personasParaCorreo = [];

    for (const fila of datos) {
      const Nombres = fila["Nombres"];
      const Apellidos = fila["Apellidos"];
      const Email = fila["Email_institucional"];
      const CodigoEstudiantil = fila["CodigoEstudiantil"];
      const Programa = fila["Programa"];
      const Semestre = fila["Semestre"];

      if (!Nombres || !Apellidos || !Email || !CodigoEstudiantil) {
        console.log("⏭️ Fila ignorada:", fila);
        continue;
      }

      // 🔐 Generar credenciales
      const passwordPlana = generarPassword(); // Esta es para el correo
      const codigoAcceso = generarCodigoAcceso();

      // 🔒 Encriptar para la Base de Datos
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(passwordPlana, salt); // Esta es para la BD

      // 👤 Crear Persona
      const persona = await Persona.create(
        {
          nombre: `${Nombres} ${Apellidos}`,
          email: Email,
          contraseña: passwordHash, // <--- Guardamos encriptada
          codigoAcceso,
          tipoUsuario: "ESTUDIANTE",
        },
        { transaction }
      );

      // 🎓 Crear Estudiante
      await Estudiante.create(
        {
          persona_id: persona.id,
          codigoEstudiantil: CodigoEstudiantil,
          programa: Programa,
          semestre: Semestre,
        },
        { transaction }
      );

      // 📧 Datos para correo (Usamos la plana para que el usuario pueda leerla)
      personasParaCorreo.push({
        nombre: `${Nombres} ${Apellidos}`,
        email: Email,
        codigoEstudiantil: CodigoEstudiantil,
        password: passwordPlana, // <--- Enviamos la original al correo
      });
    }

    await transaction.commit();

    // 🚀 Envío de correos en segundo plano
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
  importarEstudiantesDesdeExcel,
};



