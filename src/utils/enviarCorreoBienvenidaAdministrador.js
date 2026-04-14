const transporter = require('./mailer');

async function enviarCorreoBienvenidaAdministrador(administrador) {
  return transporter.sendMail({
    from: `"EduPath" <${process.env.GMAIL_USER}>`,
    to: administrador.email,
    subject: 'Bienvenido a EduPath',
    html: `
      <h2>Bienvenido a EduPath, ${administrador.nombre}!</h2>
      <p>Tu cuenta de administrador ha sido creada correctamente.</p>
      <hr />
      <h3>Credenciales de acceso</h3>
      <ul>
        <li><strong>Usuario:</strong> ${administrador.codigoAcceso}</li>
        <li><strong>Contrasena:</strong> ${administrador.password}</li>
      </ul>
      <p>Te recomendamos cambiar la contrasena al iniciar sesion.</p>
      <p><strong>Equipo EduPath</strong></p>
    `,
  });
}

module.exports = enviarCorreoBienvenidaAdministrador;