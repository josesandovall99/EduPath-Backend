/**
 * Middleware para verificar que el usuario es ADMINISTRADOR o DOCENTE.
 * Debe usarse despues de autenticacionUsuario.
 */
const requiereAdminODocente = (req, res, next) => {
  if (!req.tipoUsuario) {
    return res.status(401).json({
      mensaje: 'No autorizado: falta autenticacion de usuario',
    });
  }

  if (req.tipoUsuario !== 'ADMINISTRADOR' && req.tipoUsuario !== 'DOCENTE') {
    return res.status(403).json({
      mensaje: 'Acceso denegado: se requiere ser administrador o docente',
      tipoUsuarioActual: req.tipoUsuario,
    });
  }

  next();
};

module.exports = requiereAdminODocente;
