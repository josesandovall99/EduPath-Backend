const bcrypt = require('bcryptjs');
const { Estudiante, Persona, Administrador, Docente, Area } = require('../models');

const loginEstudiante = async (req, res) => {
  try {
    const { codigoEstudiantil, contraseña } = req.body;

    const estudiante = await Estudiante.findOne({
      where: { codigoEstudiantil },
      include: { model: Persona, as: 'persona' },
    });

    if (!estudiante) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const passwordValido = await bcrypt.compare(contraseña, estudiante.persona.contraseña);
    if (!passwordValido) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

    // Enviamos el estado de primer_ingreso al frontend
    res.json({
      mensaje: 'Bienvenido',
      primerIngreso: estudiante.persona.primer_ingreso, // <--- Clave aquí
      estudiante: {
        id: estudiante.id,
        personaId: estudiante.persona.id,
        nombre: estudiante.persona.nombre,
        codigo: estudiante.codigoEstudiantil,
        semestre: estudiante.semestre
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};


const cambiarContraseñaPrimerIngreso = async (req, res) => {
  try {
    const { personaId, nuevaContraseña } = req.body;

    const persona = await Persona.findByPk(personaId);
    
    if (!persona) {
      return res.status(404).json({ mensaje: "Persona no encontrada" });
    }

    // 1. Encriptar la nueva clave
    const salt = await bcrypt.genSalt(10);
    persona.contraseña = await bcrypt.hash(nuevaContraseña, salt);

    // 2. Forzar el cambio del flag
    // Usamos la asignación directa antes del save
    persona.set('primer_ingreso', false); 

    // 3. Guardar cambios
    await persona.save();

    res.json({ 
      mensaje: "Contraseña actualizada y flag de primer ingreso desactivado",
      datosActualizados: {
        id: persona.id,
        primer_ingreso: persona.primer_ingreso // Debería devolver false en la respuesta
      }
    });
  } catch (error) {
    console.error("Error en update:", error);
    res.status(500).json({ mensaje: "Error interno", error: error.message });
  }
};

/* =========================
   LOGIN ADMINISTRADOR
   Nota: se devuelve `primerIngreso` pero no se fuerza cambio
   de contraseña en este login (según requerimiento).
========================= */
const loginAdministrador = async (req, res) => {
  try {
    const { codigoAcceso, contraseña } = req.body;

    const persona = await Persona.findOne({
      where: { codigoAcceso, tipoUsuario: 'ADMINISTRADOR' },
      include: { model: Administrador, as: 'administrador' },
    });

    if (!persona || !persona.administrador) {
      return res.status(404).json({ mensaje: 'Administrador no encontrado' });
    }

    const passwordValido = await bcrypt.compare(contraseña, persona.contraseña);
    if (!passwordValido) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

    res.json({
      mensaje: 'Bienvenido administrador',
      primerIngreso: persona.primer_ingreso,
      administrador: {
        id: persona.administrador.id,
        personaId: persona.id,
        nombre: persona.nombre,
        email: persona.email,
        cargo: persona.administrador.cargo,
        nivelAcceso: persona.administrador.nivelAcceso,
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

/* =========================
   LOGIN DOCENTE
   Nota: se devuelve `primerIngreso` pero no se fuerza cambio
   de contraseña en este login (según requerimiento).
========================= */
const loginDocente = async (req, res) => {
  try {
    const { codigoAcceso, contraseña } = req.body;

    const persona = await Persona.findOne({
      where: { codigoAcceso, tipoUsuario: 'DOCENTE' },
      include: {
        model: Docente,
        as: 'docente',
        include: {
          model: Area,
          as: 'area',
        },
      },
    });

    if (!persona || !persona.docente) {
      return res.status(404).json({ mensaje: 'Docente no encontrado' });
    }

    const passwordValido = await bcrypt.compare(contraseña, persona.contraseña);
    if (!passwordValido) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

    res.json({
      mensaje: 'Bienvenido docente',
      primerIngreso: persona.primer_ingreso,
      docente: {
        id: persona.docente.id,
        personaId: persona.id,
        nombre: persona.nombre,
        email: persona.email,
        especialidad: persona.docente.especialidad,
        area: persona.docente.area || null,
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

module.exports = { loginEstudiante, cambiarContraseñaPrimerIngreso, loginAdministrador, loginDocente };
