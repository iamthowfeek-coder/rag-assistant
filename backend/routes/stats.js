// Numbers for the admin dashboard.
const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { requireAuth, requireRole } = require('../auth');

router.use(requireAuth, requireRole('admin'));

const num = (v) => Number(v) || 0;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// rows: [{ d: '2026-11-16', c: 3 }]. Returns the last `n` days, with 0 for days that had no tickets.
function fillDays(rows, n, today = new Date()) {
  const counts = new Map(rows.map((r) => [r.d, num(r.c)]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push({ date: ymd(day), count: counts.get(ymd(day)) || 0 });
  }
  return out;
}

router.get('/', wrap(async (req, res) => {
  const [[t]] = await pool.query(
    `SELECT COUNT(*) total,
            SUM(status = 'new') drafting, SUM(status = 'draft_ready') draft_ready,
            SUM(status = 'escalated') escalated, SUM(status = 'replied') replied,
            SUM(reply_kind = 'draft_unchanged') unchanged, SUM(reply_kind = 'draft_edited') edited,
            SUM(reply_kind = 'written') written,
            AVG(CASE WHEN status = 'replied' THEN TIMESTAMPDIFF(MINUTE, created_at, replied_at) END) avg_minutes
     FROM tickets`
  );
  const [days] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c FROM tickets
     WHERE created_at >= (CURDATE() - INTERVAL 6 DAY) GROUP BY d`
  );
  const [[kb]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM documents) AS documents, (SELECT COUNT(*) FROM passages) AS passages,
            (SELECT COUNT(*) FROM kb_suggestions WHERE status = 'pending') AS pending_suggestions`
  );
  res.json({
    tickets: { total: num(t.total), drafting: num(t.drafting), draft_ready: num(t.draft_ready), escalated: num(t.escalated), replied: num(t.replied) },
    replies: { unchanged: num(t.unchanged), edited: num(t.edited), written: num(t.written) },
    avg_minutes: t.avg_minutes === null ? null : Math.round(num(t.avg_minutes)),
    per_day: fillDays(days, 7),
    kb: { documents: num(kb.documents), passages: num(kb.passages), pending_suggestions: num(kb.pending_suggestions) },
  });
}));

module.exports = router;
module.exports.fillDays = fillDays;
