const jwt = require('jsonwebtoken');
const pool = require('./db');
const wrap = require('./wrap');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  console.error('Set JWT_SECRET (16 or more characters) in backend/.env');
  process.exit(1);
}

exports.signToken = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '8h' });

// Reads the token, then loads the user from the database so a deactivated
// account or a changed role takes effect immediately.
exports.requireAuth = wrap(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  let id;
  try {
    id = jwt.verify(token, SECRET).id;
  } catch {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ? AND active = TRUE', [id]);
  if (!rows[0]) return res.status(401).json({ error: 'Please sign in again.' });
  req.user = rows[0];
  next();
});

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission to do this.' });
