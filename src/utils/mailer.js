const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_PASS;

const connectionTimeout = Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000);
const greetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT || 15000);
const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT || 20000);

function createTransport(port, secure) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: true,
    family: 4,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    auth: { user, pass },
    tls: {
      minVersion: 'TLSv1.2',
      servername: host,
    },
  });
}

const primaryPort = Number(process.env.SMTP_PORT || 587);
const primarySecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const fallbackPort = primaryPort === 465 ? 587 : 465;
const fallbackSecure = fallbackPort === 465;

const primaryTransporter = createTransport(primaryPort, primarySecure);
const fallbackTransporter = createTransport(fallbackPort, fallbackSecure);

async function sendMail(mailOptions) {
  try {
    return await primaryTransporter.sendMail(mailOptions);
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    const isTimeout =
      message.includes('timeout') ||
      message.includes('connection') ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ESOCKET';

    if (!isTimeout) {
      throw error;
    }

    console.warn(`SMTP primario fallo (${primaryPort}/${primarySecure ? 'SSL' : 'STARTTLS'}). Intentando fallback ${fallbackPort}/${fallbackSecure ? 'SSL' : 'STARTTLS'}...`);
    try {
      return await fallbackTransporter.sendMail(mailOptions);
    } catch (fallbackError) {
      const code = fallbackError?.code || 'UNKNOWN';
      const responseCode = fallbackError?.responseCode || 'N/A';
      const fallbackMessage = fallbackError?.message || 'sin detalle';
      throw new Error(`SMTP timeout en primario y fallback. code=${code} responseCode=${responseCode} detail=${fallbackMessage}`);
    }
  }
}

module.exports = {
  sendMail,
};