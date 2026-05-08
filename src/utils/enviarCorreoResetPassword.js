const transporter = require('./mailer');

async function enviarCorreoResetPassword(persona, resetUrl) {
  return transporter.sendMail({
    from: `"EduPath" <${process.env.GMAIL_USER}>`,
    to: persona.email,
    subject: 'Restablecer tu contraseña - EduPath',
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecer contraseña - EduPath</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a73e8;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">EduPath</h1>
              <p style="margin:6px 0 0;color:#d0e4ff;font-size:14px;">Universidad de Santander (UDES) &mdash; Ingeniería de Sistemas</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:20px;">Hola, ${persona.nombre}</h2>
              <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>EduPath</strong>. Si fuiste tú quien la solicitó, haz clic en el botón a continuación para crear una nueva contraseña.
              </p>

              <!-- Reset button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;text-decoration:none;padding:13px 36px;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.5px;">RESTABLECER CONTRASEÑA</a>
                  </td>
                </tr>
              </table>

              <!-- Expiry note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbea;border:1px solid #f0c040;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#7a5800;font-size:14px;font-weight:700;">⚠ Importante:</p>
                    <p style="margin:0;color:#7a5800;font-size:14px;line-height:1.6;">
                      Este enlace expirará en <strong>30 minutos</strong> a partir del momento en que fue enviado. Si no puedes hacer clic en el botón, copia y pega el siguiente enlace en tu navegador:
                    </p>
                    <p style="margin:10px 0 0;word-break:break-all;">
                      <a href="${resetUrl}" style="color:#1a73e8;font-size:13px;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;color:#444;font-size:14px;line-height:1.6;">
                Si no solicitaste restablecer tu contraseña, puedes ignorar este correo. Tu contraseña actual permanecerá sin cambios.
              </p>
              <p style="margin:12px 0 0;color:#444;font-size:14px;line-height:1.6;">
                En caso de dudas o inconvenientes, comunícate con el administrador del sistema.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f6f9;padding:20px 40px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="margin:0 0 4px;color:#888;font-size:12px;">Esta dirección de e-mail es utilizada exclusivamente para el envío de mensajes automáticos.</p>
              <p style="margin:0 0 8px;color:#888;font-size:12px;">Por favor, no respondas a este correo.</p>
              <p style="margin:0;color:#aaa;font-size:11px;">&copy; ${new Date().getFullYear()} EduPath &mdash; Universidad de Santander (UDES)</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  });
}

module.exports = enviarCorreoResetPassword;
