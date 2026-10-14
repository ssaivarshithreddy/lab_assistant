import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDB() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('✅ PostgreSQL database connection established & schema initialized.');
  } catch (err) {
    console.error(`\n❌ PostgreSQL Initialization Error [${err.code || 'NO_CODE'}]: ${err.message}`);
    console.error(`👉 Please update your .env file with your local PostgreSQL credentials:`);
    console.error(`   POSTGRES_HOST=localhost`);
    console.error(`   POSTGRES_PORT=5432`);
    console.error(`   POSTGRES_USER=your_postgres_username`);
    console.error(`   POSTGRES_PASSWORD=your_postgres_password`);
    console.error(`   POSTGRES_DB=lab_assistant`);
    console.error(`   OR set DATABASE_URL=postgresql://user:pass@localhost:5432/lab_assistant\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDB().then(() => pool.end());
}
