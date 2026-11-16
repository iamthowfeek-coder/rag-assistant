const pool = require('./db');

// Keyword search over passages using MySQL FULLTEXT. Phase 3 reuses this to find
// the passages the AI is allowed to answer from.
exports.searchPassages = async (query, limit = 5) => {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  const [rows] = await pool.query(
    `SELECT p.id, p.document_id, d.title, p.position, p.content,
            MATCH(p.content) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
     FROM passages p JOIN documents d ON d.id = p.document_id
     WHERE MATCH(p.content) AGAINST (? IN NATURAL LANGUAGE MODE)
     ORDER BY score DESC LIMIT ?`,
    [q, q, Math.min(Number(limit) || 5, 20)]
  );
  return rows;
};
