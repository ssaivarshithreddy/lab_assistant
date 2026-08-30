import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'varshith513',
  database: process.env.POSTGRES_DB || 'lab_assistant',
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
});

// Handle idle client errors gracefully to prevent unhandled node process crashes
pool.on('error', (err) => {
  console.error('⚠️ Unexpected idle PostgreSQL client error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

export async function testConnection() {
  try {
    const result = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

testConnection();

export default pool;
