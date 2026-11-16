// Creates the first admin account from the values in .env. Safe to run more than once.
require('dotenv').config();
const pool = require('./db');
const { hashPassword } = require('./password');

(async () => {
  const { ADMIN_NAME = 'Admin', ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8 or more characters) in backend/.env');
    process.exit(1);
  }
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (rows.length) {
    console.log('An admin already exists. Nothing to do.');
  } else {
    await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      ADMIN_NAME, ADMIN_EMAIL.toLowerCase(), hashPassword(ADMIN_PASSWORD), 'admin',
    ]);
    console.log(`Admin created: ${ADMIN_EMAIL}`);
  }
  await pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
