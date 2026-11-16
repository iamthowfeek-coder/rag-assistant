// Accuracy test: runs 30 questions through the same search + draft logic that real tickets use,
// then checks (1) did search find the right document, (2) did the system answer or escalate correctly.
// Usage: npm run seed-docs (once), then npm run eval. Results are also written to eval/results.md.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// questions: [{ question, doc }]; doc is the document that holds the answer, or null if the answer is NOT in the documents.
async function runEval(questions, analyse) {
  const rows = [];
  for (const q of questions) {
    const ticket = { customer_name: 'Test Customer', subject: '', message: q.question };
    let passages = [];
    let result;
    try {
      ({ passages, result } = await analyse(ticket));
    } catch (err) {
      rows.push({ ...q, outcome: 'error', note: err.message.slice(0, 80), retrieved: null, correct: false });
      continue;
    }
    const escalated = Boolean(result.escalate);
    const retrieved = q.doc ? passages.some((p) => p.title === q.doc) : null;
    const correct = q.doc
      ? !escalated && result.sources.some((s) => s.title === q.doc)
      : escalated;
    rows.push({ ...q, outcome: escalated ? 'escalated' : 'draft', retrieved, correct, note: escalated ? result.escalate : result.sources.map((s) => s.title).join(', ') });
  }
  const answerable = rows.filter((r) => r.doc);
  const unanswerable = rows.filter((r) => !r.doc);
  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');
  return {
    rows,
    summary: {
      total: rows.length,
      correct: rows.filter((r) => r.correct).length,
      answerable: answerable.length,
      retrievalHits: answerable.filter((r) => r.retrieved).length,
      answeredCorrectly: answerable.filter((r) => r.correct).length,
      unanswerable: unanswerable.length,
      escalatedCorrectly: unanswerable.filter((r) => r.correct).length,
      errors: rows.filter((r) => r.outcome === 'error').length,
      pct,
    },
  };
}

function report(rows, s, mode) {
  const lines = [];
  lines.push(`# Accuracy test (${rows.length} questions)`, '', `Mode: ${mode}`, `Run: ${new Date().toISOString()}`, '');
  lines.push(`- Overall correct: **${s.correct}/${s.total}** (${s.pct(s.correct, s.total)})`);
  lines.push(`- Answerable questions: search found the right document in ${s.retrievalHits}/${s.answerable} (${s.pct(s.retrievalHits, s.answerable)}); drafted from the right document in ${s.answeredCorrectly}/${s.answerable} (${s.pct(s.answeredCorrectly, s.answerable)})`);
  lines.push(`- Questions NOT in the documents: escalated to a person in ${s.escalatedCorrectly}/${s.unanswerable} (${s.pct(s.escalatedCorrectly, s.unanswerable)})`);
  if (s.errors) lines.push(`- Errors: ${s.errors}`);
  lines.push('', '| # | Question | Expected | Result | OK |', '|---|---|---|---|---|');
  rows.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.question} | ${r.doc || 'escalate'} | ${r.outcome}${r.note ? ` (${r.note})` : ''} | ${r.correct ? 'yes' : 'NO'} |`);
  });
  return lines.join('\n') + '\n';
}

module.exports = { runEval, report };

if (require.main === module) {
  (async () => {
    const pool = require('./db');
    const { analyse } = require('./draft');
    const ai = require('./ai');
    const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'questions.json'), 'utf8'));
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM documents');
    if (!n) {
      console.error('The knowledge base is empty. Run "npm run seed-docs" first.');
      process.exit(1);
    }
    const mode = ai.hasKey() ? `AI (${process.env.AI_MODEL || 'claude-haiku-5-5'})` : 'basic template (no API key set, so questions that share a word with a document are not escalated)';
    console.log(`Running ${questions.length} questions. Mode: ${mode}\n`);
    const { rows, summary } = await runEval(questions, analyse);
    const text = report(rows, summary, mode);
    console.log(text);
    fs.writeFileSync(path.join(__dirname, '..', 'eval', 'results.md'), text);
    console.log('Saved to eval/results.md');
    await pool.end();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
