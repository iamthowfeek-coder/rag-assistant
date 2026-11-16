const path = require('path');
const multer = require('multer');
const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { requireAuth, requireRole } = require('../auth');
const { addDocument } = require('../docs');

const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // the lib path avoids a debug-mode bug in the package index

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single('file');
const handleUpload = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    const text = err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large (5 MB maximum).' : 'The upload failed. Try again.';
    res.status(400).json({ error: text });
  });

async function readFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return (await pdfParse(file.buffer)).text;
  if (ext === '.txt' || ext === '.md') return file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  return null;
}

router.use(requireAuth);

// Admins and agents can see what is in the knowledge base.
router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, title, filename, passage_count, created_at FROM documents ORDER BY id DESC');
  res.json(rows);
}));

// Only admins change it.
router.post('/', requireRole('admin'), handleUpload, wrap(async (req, res) => {
  let text = String(req.body?.text || '');
  let filename = null;
  if (req.file) {
    filename = req.file.originalname;
    try {
      const fromFile = await readFile(req.file);
      if (fromFile === null) return res.status(400).json({ error: 'Only .txt, .md and .pdf files are supported.' });
      text = fromFile;
    } catch (err) {
      console.error(`Could not read "${filename}":`, err);
      const why = String(err.message || err).slice(0, 120);
      return res.status(400).json({ error: `That file could not be read (${why}). Try pasting its text instead.` });
    }
  }
  const title = String(req.body?.title || '').trim().slice(0, 200) || (filename ? path.parse(filename).name : '');
  if (!title) return res.status(400).json({ error: 'Enter a title.' });

  try {
    const doc = await addDocument({ title, filename, text, userId: req.user.id });
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 'NO_TEXT') {
      return res.status(400).json({ error: 'No text was found. A scanned PDF has no text layer; paste the text instead.' });
    }
    throw err;
  }
}));

router.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]); // passages go with it
  if (!r.affectedRows) return res.status(404).json({ error: 'Document not found.' });
  res.json({ ok: true });
}));

module.exports = router;
