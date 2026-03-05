const jwt = require('jsonwebtoken');

const getJwtConfig = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no esta configurado');
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  };
};

const signAccessToken = (payload) => {
  const { secret, expiresIn } = getJwtConfig();
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyAccessToken = (token) => {
  const { secret } = getJwtConfig();
  return jwt.verify(token, secret);
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
