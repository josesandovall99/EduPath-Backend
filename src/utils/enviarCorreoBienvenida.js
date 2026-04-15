const transporter = require('./mailer');

async function enviarCorreoBienvenida(estudiante) {
  return transporter.sendMail({
    from: `"EduPath" <${process.env.GMAIL_USER}>`,
    to: estudiante.email,
    subject: 'Bienvenido a EduPath',
    html: `
      <h2>Bienvenido a EduPath, ${estudiante.nombre}</h2>

      <p>
        EduPath es una plataforma web educativa diseñada para apoyar el aprendizaje
        de los estudiantes de <strong>Ingeniería de Sistemas de la Universidad de Santander (UDES)</strong>.
      </p>

      <p>
        En la plataforma encontrarás contenidos académicos, recursos de estudio
        y material de apoyo para fortalecer tus conocimientos durante la carrera.
      </p>

      <hr />

      <h3>Credenciales de acceso</h3>
      <ul>
        <li><strong>Usuario:</strong> ${estudiante.codigoEstudiantil}</li>
        <li><strong>Contraseña:</strong> ${estudiante.password}</li>
      </ul>

      <p>
        ¡Te deseamos muchos éxitos en tu proceso académico!
      </p>

      <p>
        <strong>Equipo EduPath</strong>
      </p>
    `
  });
}

module.exports = enviarCorreoBienvenida;


