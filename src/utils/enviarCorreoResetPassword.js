const transporter = require('./mailer');

async function enviarCorreoResetPassword(persona, resetUrl) {
  return transporter.sendMail({
    from: `"EduPath" <${process.env.GMAIL_USER}>`,
    to: persona.email,
    subject: 'Restablecer tu contrasena - EduPath',
    html: `
      <h2>Hola ${persona.nombre},</h2>
      <p>Recibimos una solicitud para restablecer tu contrasena.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva contrasena:</p>
      <p><a href="${resetUrl}">Restablecer contrasena</a></p>
      <p>Este enlace expirara en 30 minutos.</p>
      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      <p><strong>Equipo EduPath</strong></p>
    `
  });
}

module.exports = enviarCorreoResetPassword;
