const transporter = require('./mailer');

async function enviarCorreoBienvenidaDocente(docente) {
  return transporter.sendMail({
    from: `"EduPath" <${process.env.GMAIL_USER}>`,
    to: docente.email,
    subject: 'Bienvenido a EduPath',
    html: `
      <h2>Bienvenido a EduPath, ${docente.nombre}!</h2>
      <p>Tu cuenta de docente ha sido creada correctamente.</p>
      <hr />
      <h3>Credenciales de acceso</h3>
      <ul>
        <li><strong>Usuario:</strong> ${docente.codigoAcceso}</li>
        <li><strong>Contrasena:</strong> ${docente.password}</li>
      </ul>
      <p>Te recomendamos cambiar la contrasena al iniciar sesion.</p>
      <p><strong>Equipo EduPath</strong></p>
    `
  });
}

module.exports = enviarCorreoBienvenidaDocente;
