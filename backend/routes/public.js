// Open to anyone (no login): the customer form and the status page use these.
const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { draftTicket } = require('../draft');

const WINDOW = 10 * 60 * 1000;
function makeLimiter(max) { // per-IP limit so one person cannot flood the queue or guess reference numbers
  const hits = new Map();
  const recent = (ip) => (hits.get(ip) || []).filter((t) => Date.now() - t < WINDOW);
  return {
    tooMany: (ip) => recent(ip).length >= max,
    record: (ip) => hits.set(ip, [...recent(ip), Date.now()]),
  };
}
const ticketLimit = makeLimiter(10);
const statusLimit = makeLimiter(20);

router.post('/tickets', wrap(async (req, res) => {
  if (req.body?.website) return res.status(201).json({ id: 0 }); // hidden field: only bots fill it in
  if (ticketLimit.tooMany(req.ip)) {
    return res.status(429).json({ error: 'Too many questions sent. Please try again in a few minutes.' });
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ error: 'Enter your name (100 characters at most).' });
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!subject || subject.length > 200) return res.status(400).json({ error: 'Enter a subject (200 characters at most).' });
  if (message.length < 10 || message.length > 3000) {
    return res.status(400).json({ error: 'Describe your question in 10 to 3000 characters.' });
  }

  const [r] = await pool.query(
    'INSERT INTO tickets (customer_name, customer_email, subject, message) VALUES (?, ?, ?, ?)',
    [name, email, subject, message]
  );
  ticketLimit.record(req.ip);
  res.status(201).json({ id: r.insertId });

  // The customer is not kept waiting: the draft is made after the reply is sent.
  draftTicket(r.insertId).catch((err) => console.error('Draft error:', err.message));
}));

// The customer needs the reference number AND the email used on the form. Only a person-approved reply is shown.
router.post('/status', wrap(async (req, res) => {
  if (statusLimit.tooMany(req.ip)) {
    return res.status(429).json({ error: 'Too many lookups. Please try again in a few minutes.' });
  }
  statusLimit.record(req.ip);

  const id = String(req.body?.id || '').replace(/^#/, '').trim();
  const email = String(req.body?.email || '').trim();
  if (!/^\d{1,9}$/.test(id) || !email) {
    return res.status(400).json({ error: 'Enter your reference number and the email address you used.' });
  }
  const [rows] = await pool.query(
    'SELECT id, subject, status, reply_text, replied_at, created_at FROM tickets WHERE id = ? AND LOWER(customer_email) = LOWER(?)',
    [id, email]
  );
  const t = rows[0];
  if (!t) return res.status(404).json({ error: 'We could not find a question with that reference number and email address.' });
  const answered = t.status === 'replied';
  res.json({
    id: t.id,
    subject: t.subject,
    submitted_at: t.created_at,
    answered,
    reply: answered ? t.reply_text : null,
    replied_at: answered ? t.replied_at : null,
  });
}));

module.exports = router;
