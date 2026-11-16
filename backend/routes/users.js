const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { hashPassword } = require('../password');
const { requireAuth, requireRole } = require('../auth');

router.use(requireAuth, requireRole('admin')); // everything here is admin only

router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY id');
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const role = req.body?.role;
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a name and a valid email address.' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'The password needs at least 8 characters.' });
  if (!['agent', 'admin'].includes(role)) return res.status(400).json({ error: 'Choose a role.' });
  try {
    const [r] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashPassword(password), role]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A user with this email already exists.' });
    throw err;
  }
}));

// Deactivate or reactivate an account. Nothing is deleted, so ticket history stays intact.
router.patch('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'User not found.' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'Choose active or inactive.' });
  const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  await pool.query('UPDATE users SET active = ? WHERE id = ?', [req.body.active, id]);
  res.json({ ok: true });
}));

module.exports = router;
