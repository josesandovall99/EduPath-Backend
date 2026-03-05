const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const isValidEmail = (value) => isNonEmptyString(value) && EMAIL_REGEX.test(value.trim());

const isStrongPassword = (value) =>
  isNonEmptyString(value) &&
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value);

const sanitizePlainText = (value) => {
  if (!isNonEmptyString(value)) return '';
  return value.replace(/[<>]/g, '').trim();
};

const sanitizeRichText = (value) => {
  if (!isNonEmptyString(value)) return '';

  // Remove script tags and inline event handlers.
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
};

const removePersonaSensitiveFields = (personaLike) => {
  if (!personaLike) return personaLike;

  const plain = typeof personaLike.toJSON === 'function' ? personaLike.toJSON() : { ...personaLike };
  delete plain.contraseña;
  delete plain.resetPasswordTokenHash;
  delete plain.resetPasswordExpiresAt;
  return plain;
};

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isStrongPassword,
  sanitizePlainText,
  sanitizeRichText,
  removePersonaSensitiveFields,
};
