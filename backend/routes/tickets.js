const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { requireAuth } = require('../auth');
const { draftTicket } = require('../draft');
const { mailConfigured, sendReply } = require('../mailer');

router.use(requireAuth); // admins and agents

const STATUSES = ['new', 'draft_ready', 'escalated', 'replied'];

router.param('id', (req, res, next, id) =>
  /^\d{1,9}$/.test(id) ? next() : res.status(404).json({ error: 'Ticket not found.' }));

const load = async (id) => {
  const [rows] = await pool.query(
    `SELECT t.*, u.name AS replied_by_name,
            EXISTS(SELECT 1 FROM kb_suggestions s WHERE s.ticket_id = t.id) AS suggested
     FROM tickets t LEFT JOIN users u ON u.id = t.replied_by WHERE t.id = ?`,
    [id]
  );
  const t = rows[0];
  if (!t) return null;
  try { t.sources = t.sources ? JSON.parse(t.sources) : []; } catch { t.sources = []; }
  t.suggested = Boolean(t.suggested);
  return t;
};

router.get('/', wrap(async (req, res) => {
  const where = [];
  const params = [];
  if (STATUSES.includes(req.query.status)) {
    where.push('status = ?');
    params.push(req.query.status);
  }
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push('(subject LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)');
    params.push(like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT id, customer_name, subject, status, drafted_by, reply_kind, created_at, replied_at FROM tickets
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`,
    params
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const t = await load(req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found.' });
  res.json(t);
}));

// Try the draft again, for example after documents were added or the AI was unavailable.
router.post('/:id/redraft', wrap(async (req, res) => {
  const t = await load(req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found.' });
  if (t.status === 'replied') return res.status(409).json({ error: 'This ticket has already been answered.' });
  await pool.query("UPDATE tickets SET status = 'new' WHERE id = ? AND status <> 'replied'", [req.params.id]);
  await draftTicket(req.params.id);
  res.json(await load(req.params.id));
}));

// A person approves and sends the reply. This is the only way a reply reaches a customer.
router.post('/:id/reply', wrap(async (req, res) => {
  const reply = String(req.body?.reply || '').trim();
  if (!reply) return res.status(400).json({ error: 'Write a reply first.' });
  if (reply.length > 5000) return res.status(400).json({ error: 'The reply is too long (5000 characters at most).' });

  const t = await load(req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found.' });
  if (t.status === 'replied') return res.status(409).json({ error: 'This ticket has already been answered.' });
  if (t.status === 'new') return res.status(409).json({ error: 'The draft is still being prepared. Wait a moment or press Draft again.' });

  // How the reply was made: the AI draft as it was, the draft after editing, or written from scratch.
  const kind = !t.ai_draft ? 'written' : reply === String(t.ai_draft).trim() ? 'draft_unchanged' : 'draft_edited';
  const [r] = await pool.query(
    `UPDATE tickets SET status = 'replied', reply_text = ?, reply_kind = ?, replied_by = ?, replied_at = NOW()
     WHERE id = ? AND status IN ('draft_ready', 'escalated')`,
    [reply, kind, req.user.id, t.id]
  );
  if (!r.affectedRows) return res.status(409).json({ error: 'This ticket has already been answered.' });

  let email = 'not_configured';
  if (mailConfigured()) {
    try {
      await sendReply({ to: t.customer_email, subject: t.subject, text: `${reply}\n\n--\nTicket reference: #${t.id}` });
      email = 'sent';
    } catch (err) {
      console.error(`Email for ticket ${t.id} failed:`, err.message);
      email = 'failed';
    }
  }
  await pool.query('UPDATE tickets SET email_status = ? WHERE id = ?', [email, t.id]);

  if (req.body?.suggest_kb) { // an admin reviews this before it becomes a document
    await pool.query(
      'INSERT IGNORE INTO kb_suggestions (ticket_id, title, question, answer, suggested_by) VALUES (?, ?, ?, ?, ?)',
      [t.id, t.subject.slice(0, 200), t.message, reply, req.user.id]
    );
  }
  res.json(await load(t.id));
}));

module.exports = router;
