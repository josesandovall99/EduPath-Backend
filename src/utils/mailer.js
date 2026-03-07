const nodemailer = require('nodemailer');

const mailProvider = String(process.env.MAIL_PROVIDER || 'smtp').toLowerCase();

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_PASS;
const resendApiKey = process.env.RESEND_API_KEY;
const mailFrom = process.env.MAIL_FROM || process.env.GMAIL_USER;
const gmailClientId = process.env.GMAIL_CLIENT_ID;
const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
const gmailSender = process.env.GMAIL_USER;

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
let gmailAccessTokenCache = {
  token: null,
  expiresAt: 0,
};

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

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildMimeMessage(mailOptions) {
  const recipients = normalizeRecipients(mailOptions.to);
  const subject = mailOptions.subject || '';
  const from = mailOptions.from || mailFrom || gmailSender;
  const text = mailOptions.text || null;
  const html = mailOptions.html || null;

  if (!from) {
    throw new Error('No hay remitente configurado para Gmail API');
  }

  if (recipients.length === 0) {
    throw new Error('No hay destinatarios validos para Gmail API');
  }

  if (!text && !html) {
    throw new Error('El correo debe incluir texto o html');
  }

  const headers = [
    `From: ${from}`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (text && html) {
    const boundary = `boundary_${Date.now()}`;
    const parts = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
      `--${boundary}--`,
      '',
    ];
    return parts.join('\r\n');
  }

  const isHtml = Boolean(html);
  const body = html || text;
  const contentType = isHtml ? 'text/html' : 'text/plain';
  const parts = [
    ...headers,
    `Content-Type: ${contentType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
  ];
  return parts.join('\r\n');
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = Number(process.env.MAIL_API_TIMEOUT || 20000)) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`HTTP timeout tras ${timeoutMs}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getGmailAccessToken() {
  const now = Date.now();
  if (gmailAccessTokenCache.token && gmailAccessTokenCache.expiresAt > now + 30_000) {
    return gmailAccessTokenCache.token;
  }

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    throw new Error('Faltan variables OAuth2 de Gmail: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET o GMAIL_REFRESH_TOKEN');
  }

  const body = new URLSearchParams({
    client_id: gmailClientId,
    client_secret: gmailClientSecret,
    refresh_token: gmailRefreshToken,
    grant_type: 'refresh_token',
  });

  const { response, data } = await fetchJsonWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok || !data?.access_token) {
    const detail = data?.error_description || data?.error || `HTTP ${response.status}`;
    const error = new Error(`No se pudo obtener access token de Gmail: ${detail}`);
    error.code = 'GMAIL_OAUTH_ERROR';
    error.responseCode = response.status;
    throw error;
  }

  const expiresInMs = Number(data.expires_in || 3600) * 1000;
  gmailAccessTokenCache = {
    token: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return gmailAccessTokenCache.token;
}

async function sendWithGmailApi(mailOptions) {
  const accessToken = await getGmailAccessToken();
  const mimeMessage = buildMimeMessage(mailOptions);
  const raw = toBase64Url(mimeMessage);

  const userId = encodeURIComponent(gmailSender || 'me');
  const sendUrl = `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`;
  const { response, data } = await fetchJsonWithTimeout(sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const detail = data?.error?.message || data?.error_description || `HTTP ${response.status}`;
    const error = new Error(`Gmail API error: ${detail}`);
    error.code = 'GMAIL_API_ERROR';
    error.responseCode = response.status;
    throw error;
  }

  return {
    accepted: normalizeRecipients(mailOptions.to),
    rejected: [],
    messageId: data?.id || null,
    provider: 'gmail_api',
  };
}

async function sendMail(mailOptions) {
  if (mailProvider === 'resend') {
    return sendWithResend(mailOptions);
  }

  if (mailProvider === 'gmail_api') {
    return sendWithGmailApi(mailOptions);
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