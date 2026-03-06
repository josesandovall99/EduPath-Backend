const buckets = new Map();

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const createRateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    // In local development we avoid blocking normal testing flows.
    // Set ENFORCE_RATE_LIMIT_DEV=true to test limiter behavior manually.
    if (process.env.NODE_ENV !== 'production' && process.env.ENFORCE_RATE_LIMIT_DEV !== 'true') {
      return next();
    }

    const now = Date.now();
    const key = `${req.baseUrl || ''}${req.path}:${getClientIp(req)}`;
    const current = buckets.get(key);

    if (!current || now >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ mensaje: message });
    }

    current.count += 1;
    return next();
  };
};

const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesion. Intente nuevamente en unos minutos.',
});

const passwordResetRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes de restablecimiento. Intente nuevamente en unos minutos.',
});

module.exports = {
  loginRateLimit,
  passwordResetRateLimit,
};
