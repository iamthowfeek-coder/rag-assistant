// Adds one document to the knowledge base: splits the text into passages and stores everything in one transaction.
const pool = require('./db');
const { chunkText } = require('./chunk');

exports.addDocument = async ({ title, filename = null, text, userId = null }) => {
  const passages = chunkText(text);
  if (!passages.length) {
    const err = new Error('No text was found.');
    err.code = 'NO_TEXT';
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [doc] = await conn.query(
      'INSERT INTO documents (title, filename, uploaded_by, passage_count) VALUES (?, ?, ?, ?)',
      [title, filename, userId, passages.length]
    );
    for (let i = 0; i < passages.length; i += 200) {
      const batch = passages.slice(i, i + 200).map((content, j) => [doc.insertId, i + j + 1, content]);
      await conn.query('INSERT INTO passages (document_id, position, content) VALUES ?', [batch]);
    }
    await conn.commit();
    return { id: doc.insertId, passages: passages.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
