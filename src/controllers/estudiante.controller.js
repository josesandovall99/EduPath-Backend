const sequelize = require("../config/database");
const { Persona, Estudiante } = require("../models");

/* =========================
   CREAR ESTUDIANTE
========================= */
const crearEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
      codigoEstudiantil,
      programa,
      semestre
    } = req.body;

    const persona = await Persona.create(
      {
        nombre,
        email,
        codigoAcceso,
        contraseña,
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
   EXPORTS
========================= */
module.exports = {
  crearEstudiante,
  obtenerEstudiantes,
  obtenerEstudiantePorId,
  actualizarEstudiante,
  eliminarEstudiante,
};
