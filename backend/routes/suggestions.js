// When a person answers a ticket the AI could not, they can suggest the answer for the knowledge base.
// An admin reviews it (and can edit it) before it becomes a document.
const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { requireAuth, requireRole } = require('../auth');
const { addDocument } = require('../docs');

router.use(requireAuth, requireRole('admin'));
router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(404).json({ error: 'Suggestion not found.' }));

router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.ticket_id, s.title, s.question, s.answer, s.created_at, u.name AS suggested_by_name
     FROM kb_suggestions s LEFT JOIN users u ON u.id = s.suggested_by
     WHERE s.status = 'pending' ORDER BY s.id DESC`
  );
  res.json(rows);
}));

router.post('/:id/approve', wrap(async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 200);
  const content = String(req.body?.content || '').trim();
  if (!title || !content) return res.status(400).json({ error: 'A title and some text are needed.' });

  const [claim] = await pool.query(
    "UPDATE kb_suggestions SET status = 'approved', decided_at = NOW() WHERE id = ? AND status = 'pending'",
    [req.params.id]
  );
  if (!claim.affectedRows) return res.status(409).json({ error: 'This suggestion was already handled.' });
  try {
    const doc = await addDocument({ title, text: content, userId: req.user.id });
    res.json({ ok: true, document: doc });
  } catch (err) {
    await pool.query("UPDATE kb_suggestions SET status = 'pending', decided_at = NULL WHERE id = ?", [req.params.id]);
    throw err;
  }
}));

router.post('/:id/reject', wrap(async (req, res) => {
  const [r] = await pool.query(
    "UPDATE kb_suggestions SET status = 'rejected', decided_at = NOW() WHERE id = ? AND status = 'pending'",
    [req.params.id]
  );
  if (!r.affectedRows) return res.status(409).json({ error: 'This suggestion was already handled.' });
  res.json({ ok: true });
}));

module.exports = router;
