const crypto = require('crypto');

// scrypt with a random salt per password. The plain password is never stored.
exports.hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
};

exports.checkPassword = (password, stored) => {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
};
