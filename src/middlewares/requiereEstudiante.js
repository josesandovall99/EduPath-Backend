/**
 * Middleware para verificar que el usuario es ESTUDIANTE
 * Debe usarse DESPUÉS del middleware autenticacionUsuario
 *
 * Verifica que req.tipoUsuario === "ESTUDIANTE"
 * Si no, retorna 403 Forbidden
 */
const requiereEstudiante = (req, res, next) => {
  if (!req.tipoUsuario) {
    return res.status(401).json({
      mensaje: "No autorizado: falta autenticación de usuario"
    });
  }

  if (req.tipoUsuario !== "ESTUDIANTE") {
    return res.status(403).json({
      mensaje: "Acceso denegado: se requiere ser estudiante",
      tipoUsuarioActual: req.tipoUsuario
    });
  }

  next();
};

module.exports = requiereEstudiante;
