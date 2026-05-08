const transporter = require('./mailer');

async function enviarCorreoBienvenidaDocente(docente) {
  const appUrl = process.env.FRONTEND_URL || 'https://edupath.udes.edu.co';

  return transporter.sendMail({
    from: `"EduPath" <${process.env.GMAIL_USER}>`,
    to: docente.email,
    subject: 'Bienvenido a EduPath - Cuenta de Docente',
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a EduPath</title>
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
              <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:20px;">¡Bienvenido, ${docente.nombre}!</h2>
              <p style="margin:0 0 12px;color:#444;font-size:15px;line-height:1.6;">
                Nos complace informarte que se ha creado una cuenta de <strong>Docente</strong> a tu nombre en <strong>EduPath</strong>, la plataforma educativa de la Universidad de Santander para el programa de Ingeniería de Sistemas.
              </p>
              <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6;">
                Como docente podrás gestionar contenidos académicos, crear y administrar rutas de aprendizaje, asignar recursos y hacer seguimiento al progreso de los estudiantes de tu programa.
              </p>

              <!-- Credentials table -->
              <p style="margin:0 0 10px;color:#1a1a2e;font-size:15px;font-weight:600;">Tus credenciales de acceso:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                <tr style="background-color:#f8f9fa;">
                  <td style="padding:12px 16px;color:#555;font-size:14px;border-bottom:1px solid #e0e0e0;width:45%;">Código de Docente</td>
                  <td style="padding:12px 16px;color:#1a1a2e;font-size:14px;font-weight:700;border-bottom:1px solid #e0e0e0;">${docente.codigoAcceso}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#555;font-size:14px;border-bottom:1px solid #e0e0e0;">Contraseña inicial</td>
                  <td style="padding:12px 16px;color:#1a1a2e;font-size:14px;font-weight:700;border-bottom:1px solid #e0e0e0;">${docente.password}</td>
                </tr>
                <tr style="background-color:#f8f9fa;">
                  <td style="padding:12px 16px;color:#555;font-size:14px;">Correo electrónico</td>
                  <td style="padding:12px 16px;color:#1a73e8;font-size:14px;">${docente.email}</td>
                </tr>
              </table>

              <!-- Access button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;text-decoration:none;padding:13px 36px;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.5px;">INGRESAR A EDUPATH</a>
                  </td>
                </tr>
              </table>

              <!-- Important note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbea;border:1px solid #f0c040;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#7a5800;font-size:14px;font-weight:700;">⚠ Importante:</p>
                    <p style="margin:0;color:#7a5800;font-size:14px;line-height:1.6;">
                      Al ingresar por primera vez, deberás cambiar tu contraseña.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;color:#444;font-size:14px;line-height:1.6;">
                En caso de presentar alguna duda o requerir asistencia adicional, puedes comunicarte con el administrador del sistema.
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

module.exports = enviarCorreoBienvenidaDocente;
