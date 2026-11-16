const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { checkPassword } = require('../password');
const { signToken, requireAuth } = require('../auth');

const fails = new Map(); // email -> { count, until }  (slows down password guessing)

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const f = fails.get(email);
  if (f && f.until > Date.now()) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 10 minutes.' });
  }

  const [rows] = await pool.query(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = ? AND active = TRUE',
    [email]
  );
  const user = rows[0];
  if (!user || !checkPassword(password, user.password_hash)) {
    const count = (f?.count || 0) + 1;
    fails.set(email, { count, until: count >= 5 ? Date.now() + 10 * 60 * 1000 : 0 });
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  fails.delete(email);
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.get('/me', requireAuth, (req, res) => res.json(req.user));

module.exports = router;
