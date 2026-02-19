/**
 * Middleware para verificar que el usuario es ADMINISTRADOR
 * Debe usarse DESPUÉS del middleware autenticacionUsuario
 * 
 * Verifica que req.tipoUsuario === "ADMINISTRADOR"
 * Si no, retorna 403 Forbidden
 */
const requiereAdmin = (req, res, next) => {
  // Si no hay tipoUsuario, significa que autenticacionUsuario no corrio o no encontro data
  if (!req.tipoUsuario) {
    return res.status(401).json({
      mensaje: "No autorizado: falta autenticación de usuario"
    });
  }

  // Verificar que sea ADMINISTRADOR
  if (req.tipoUsuario !== "ADMINISTRADOR") {
    return res.status(403).json({
      mensaje: "Acceso denegado: se requiere ser administrador",
      tipoUsuarioActual: req.tipoUsuario
    });
  }

  next();
};

module.exports = requiereAdmin;
