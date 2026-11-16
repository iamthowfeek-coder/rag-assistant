// Brings an existing database up to date when the server starts, so nobody has to re-run SQL by hand.
// A fresh install gets the same tables from database/schema.sql.
const pool = require('./db');

async function hasColumn(table, column) {
  const [rows] = await pool.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows.length > 0;
}

module.exports = async function migrate() {
  const addColumn = async (table, column, definition) => {
    if (!(await hasColumn(table, column))) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  // Phase 4: replies
  await addColumn('tickets', 'reply_text', 'TEXT NULL');
  await addColumn('tickets', 'reply_kind', 'VARCHAR(20) NULL');
  await addColumn('tickets', 'replied_by', 'INT NULL');
  await addColumn('tickets', 'replied_at', 'TIMESTAMP NULL DEFAULT NULL');
  await addColumn('tickets', 'email_status', 'VARCHAR(20) NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS kb_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    suggested_by INT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_ticket (ticket_id),
    INDEX idx_suggestion_status (status),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  ) DEFAULT CHARSET=utf8mb4`);
};
