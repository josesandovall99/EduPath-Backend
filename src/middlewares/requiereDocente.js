/**
 * Middleware para verificar que el usuario es DOCENTE
 * Debe usarse DESPUÉS del middleware autenticacionUsuario
 * 
 * Verifica que req.tipoUsuario === "DOCENTE"
 * Si no, retorna 403 Forbidden
 */
const requiereDocente = (req, res, next) => {
  // Si no hay tipoUsuario, significa que autenticacionUsuario no corrio o no encontro data
  if (!req.tipoUsuario) {
    return res.status(401).json({
      mensaje: "No autorizado: falta autenticación de usuario"
    });
  }

  // Verificar que sea DOCENTE
  if (req.tipoUsuario !== "DOCENTE") {
    return res.status(403).json({
      mensaje: "Acceso denegado: se requiere ser docente",
      tipoUsuarioActual: req.tipoUsuario
    });
  }

  next();
};

module.exports = requiereDocente;
