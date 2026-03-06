const nodemailer = require('nodemailer');

const mailProvider = String(process.env.MAIL_PROVIDER || 'smtp').toLowerCase();

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_PASS;
const resendApiKey = process.env.RESEND_API_KEY;
const mailFrom = process.env.MAIL_FROM || process.env.GMAIL_USER;

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

function normalizeRecipients(to) {
  if (Array.isArray(to)) return to;
  if (typeof to !== 'string') return [];
  return to
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function sendWithResend(mailOptions) {
  if (!resendApiKey) {
    throw new Error('MAIL_PROVIDER=resend pero RESEND_API_KEY no esta configurada');
  }

  const recipients = normalizeRecipients(mailOptions.to);
  if (recipients.length === 0) {
    throw new Error('No hay destinatarios validos para el correo');
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.MAIL_API_TIMEOUT || 20000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailOptions.from || mailFrom,
        to: recipients,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data?.message || data?.error || `HTTP ${response.status}`;
      const error = new Error(`Resend API error: ${detail}`);
      error.code = 'RESEND_API_ERROR';
      error.responseCode = response.status;
      throw error;
    }

    return {
      accepted: recipients,
      rejected: [],
      messageId: data?.id || null,
      provider: 'resend',
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Resend API timeout tras ${timeoutMs}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendMail(mailOptions) {
  if (mailProvider === 'resend') {
    return sendWithResend(mailOptions);
  }

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