const sequelize = require("../config/database");
const Persona = require("../models/persona.model");
const Estudiante = require("../models/estudiante.model");

/* CREAR ESTUDIANTE */
const crearEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
      programa,
      semestre,
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
        id: persona.id,
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

/* OBTENER TODOS */
const obtenerEstudiantes = async (req, res) => {
  try {
    const estudiantes = await Estudiante.findAll({
      include: Persona,
    });

    res.json(estudiantes);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener estudiantes" });
  }
};

/* OBTENER POR ID */
const obtenerEstudiantePorId = async (req, res) => {
  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: Persona,
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
    });
  }
};

/* ACTUALIZAR */
const actualizarEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: Persona,
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

    res.json(estudiante);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al actualizar estudiante",
    });
  }
};

/* ELIMINAR */
const eliminarEstudiante = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findByPk(id, {
      include: Persona,
    });

    if (!estudiante) {
      return res.status(404).json({
        mensaje: "Estudiante no encontrado",
      });
    }

    await estudiante.destroy({ transaction });
    await estudiante.Persona.destroy({ transaction });

    await transaction.commit();

    res.json({
      mensaje: "Estudiante eliminado correctamente",
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      mensaje: "Error al eliminar estudiante",
    });
  }
};

module.exports = {
  crearEstudiante,
  obtenerEstudiantes,
  obtenerEstudiantePorId,
  actualizarEstudiante,
  eliminarEstudiante,
};
