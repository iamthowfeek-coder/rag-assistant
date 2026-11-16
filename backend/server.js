require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const pool = require('./db');
const migrate = require('./migrate');
const { draftTicket } = require('./draft');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // behind a hosting proxy
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
});
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/search', require('./routes/search'));
app.use('/api/public', require('./routes/public'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// In production the built frontend (frontend/dist) is served from this same server.
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
});

// Drafting runs inside this process, so a restart can leave tickets stuck as "new". Draft them again.
async function recoverTickets() {
  const [rows] = await pool.query("SELECT id FROM tickets WHERE status = 'new' ORDER BY id LIMIT 50");
  for (const r of rows) await draftTicket(r.id).catch((e) => console.error('Draft error:', e.message));
}

const PORT = process.env.PORT || 3000;
migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running at http://localhost:${PORT}${fs.existsSync(dist) ? ' (serving the built frontend too)' : ''}`);
      recoverTickets().catch((e) => console.error(e.message));
    });
  })
  .catch((err) => {
    console.error('Could not prepare the database:', err.message);
    process.exit(1);
  });
