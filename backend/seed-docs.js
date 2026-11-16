// Loads the sample documents (../sample-docs) into the knowledge base. Safe to run more than once.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { addDocument } = require('./docs');

(async () => {
  const dir = path.join(__dirname, '..', 'sample-docs');
  const files = fs.readdirSync(dir).filter((f) => /\.(txt|md)$/i.test(f));
  for (const file of files) {
    const title = path.parse(file).name;
    const [exists] = await pool.query('SELECT id FROM documents WHERE title = ?', [title]);
    if (exists.length) {
      console.log(`Skipped (already there): ${title}`);
      continue;
    }
    const doc = await addDocument({ title, filename: file, text: fs.readFileSync(path.join(dir, file), 'utf8') });
    console.log(`Added: ${title} (${doc.passages} passage${doc.passages === 1 ? '' : 's'})`);
  }
  await pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
