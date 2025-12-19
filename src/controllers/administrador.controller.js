import sequelize from "../config/sequelize.js";
import Persona from "../models/persona.model.js";
import Administrador from "../models/administrador.model.js";

/* CREAR ADMINISTRADOR */
export const crearAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      nombre,
      email,
      codigo_acceso,
      contraseña,
      cargo,
      nivel_acceso,
    } = req.body;

    const persona = await Persona.create(
      {
        nombre,
        email,
        codigo_acceso,
        contraseña,
        tipo_usuario: "ADMINISTRADOR",
      },
      { transaction }
    );

    const administrador = await Administrador.create(
      {
        id: persona.id,
        cargo,
        nivel_acceso,
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

/* OBTENER TODOS LOS ADMINISTRADORES */
export const obtenerAdministradores = async (req, res) => {
  try {
    const administradores = await Administrador.findAll({
      include: Persona,
    });

    res.json(administradores);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener administradores" });
  }
};

/* OBTENER ADMINISTRADOR POR ID */
export const obtenerAdministradorPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: Persona,
    });

    if (!administrador) {
      return res.status(404).json({ mensaje: "Administrador no encontrado" });
    }

    res.json(administrador);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener administrador" });
  }
};

/* ACTUALIZAR ADMINISTRADOR */
export const actualizarAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: Persona,
    });

    if (!administrador) {
      return res.status(404).json({ mensaje: "Administrador no encontrado" });
    }

    const {
      nombre,
      email,
      codigo_acceso,
      contraseña,
      cargo,
      nivel_acceso,
    } = req.body;

    await administrador.Persona.update(
      { nombre, email, codigo_acceso, contraseña },
      { transaction }
    );

    await administrador.update(
      { cargo, nivel_acceso },
      { transaction }
    );

    await transaction.commit();

    res.json(administrador);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ mensaje: "Error al actualizar administrador" });
  }
};

/* ELIMINAR ADMINISTRADOR */
export const eliminarAdministrador = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const administrador = await Administrador.findByPk(id, {
      include: Persona,
    });

    if (!administrador) {
      return res.status(404).json({ mensaje: "Administrador no encontrado" });
    }

    await administrador.destroy({ transaction });
    await administrador.Persona.destroy({ transaction });

    await transaction.commit();

    res.json({ mensaje: "Administrador eliminado correctamente" });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ mensaje: "Error al eliminar administrador" });
  }
};
