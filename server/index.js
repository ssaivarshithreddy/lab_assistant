import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { query } from './db.js';
import { minioClient, BUCKET_NAME, UPLOADS_DIR, ensureBucketExists } from './minioClient.js';
import { initDB } from './init-db.js';
import {
  authenticateJWT,
  generateToken,
  requireAdmin,
} from '../middlewares/authenticationMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for direct streaming to MinIO / Disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Initialize PostgreSQL tables, seed admin, and setup MinIO bucket
async function seedDefaultAdmin() {
  try {
    const adminEmail = 'admin@labsense.com';
    const existing = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await query(
        `INSERT INTO users (id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        ['00000000-0000-0000-0000-000000000001', adminEmail, hash, 'Administrator', 'admin']
      );
      console.log('✅ Default admin user (admin@labsense.com) seeded in PostgreSQL database.');
    }
  } catch (err) {
    console.warn('Admin seed warning:', err.message);
  }
}

// RAG (Retrieval-Augmented Generation) Helper Functions
async function indexReportChunks(reportId, userId, fileName, rawText, valuesJson, summary) {
  try {
    await query('DELETE FROM report_chunks WHERE report_id = $1', [reportId]);

    let parsedValues = {};
    if (typeof valuesJson === 'string') {
      try { parsedValues = JSON.parse(valuesJson); } catch (e) {}
    } else if (typeof valuesJson === 'object' && valuesJson !== null) {
      parsedValues = valuesJson;
    }

    const metricsSummaryArray = Object.entries(parsedValues)
      .filter(([, v]) => v?.value != null)
      .map(([k, v]) => `${k.toUpperCase()}: ${v.value} ${v.unit || ''} (${v.status || 'normal'})`);

    const metricsText = metricsSummaryArray.join(' | ');

    const textToChunk = [
      `Report File: ${fileName}`,
      summary ? `Summary & Diagnosis: ${summary}` : '',
      metricsSummaryArray.length > 0 ? `Extracted Lab Parameters: ${metricsText}` : '',
      rawText ? `Raw Document OCR Text: ${rawText}` : '',
    ].filter(Boolean).join('\n\n');

    const chunkSize = 500;
    const overlap = 100;
    const chunks = [];

    let start = 0;
    while (start < textToChunk.length) {
      const end = Math.min(start + chunkSize, textToChunk.length);
      const chunkText = textToChunk.slice(start, end).trim();
      if (chunkText.length > 20) {
        chunks.push(chunkText);
      }
      if (end === textToChunk.length) break;
      start += chunkSize - overlap;
    }

    for (let i = 0; i < chunks.length; i++) {
      await query(
        `INSERT INTO report_chunks (report_id, user_id, chunk_index, chunk_text, metrics_text, file_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [reportId, userId, i, chunks[i], metricsText, fileName]
      );
    }
  } catch (err) {
    console.error('RAG Chunk Indexing Error:', err.message);
  }
}

async function syncExistingReportChunks() {
  try {
    const unindexed = await query(
      `SELECT r.* FROM reports r
       LEFT JOIN report_chunks rc ON r.id = rc.report_id
       WHERE rc.id IS NULL`
    );
    for (const r of unindexed.rows) {
      await indexReportChunks(r.id, r.user_id, r.file_name, r.raw_text, r.values, r.summary);
    }
  } catch (err) {
    console.warn('RAG sync warning:', err.message);
  }
}

initDB().then(async () => {
  await seedDefaultAdmin();
  await syncExistingReportChunks();
});
ensureBucketExists();

// Helper to save file locally if MinIO is offline
function saveFileLocally(objectKey, buffer) {
  try {
    const localFilePath = path.join(UPLOADS_DIR, objectKey.replace(/\//g, '_'));
    fs.writeFileSync(localFilePath, buffer);
    return localFilePath;
  } catch (err) {
    console.error('Failed to save file locally:', err.message);
    return null;
  }
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userRes = await query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, role, created_at',
      [email, password_hash, full_name || '']
    );

    const user = userRes.rows[0];

    // Create profile entry
    await query(
      'INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [user.id, user.full_name, user.email]
    );

    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Signup Error:', err.message);
    if (err.message.includes('authentication failed') || err.message.includes('ECONNREFUSED')) {
      return res.status(500).json({
        error: `PostgreSQL Database Connection Failed: ${err.message}. Please check POSTGRES_USER & POSTGRES_PASSWORD in your .env file.`,
      });
    }
    res.status(500).json({ error: err.message || 'Failed to create user account' });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email ? email.trim() : '';

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Support built-in admin on main signin route
    if (cleanEmail === 'admin@labsense.com' && password === 'admin123') {
      const user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@labsense.com',
        role: 'admin',
        full_name: 'Administrator',
      };
      const token = generateToken(user);
      return res.json({ token, user });
    }

    const userRes = await query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    delete user.password_hash;
    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Signin Error:', err.message);
    if (err.message.includes('authentication failed') || err.message.includes('ECONNREFUSED')) {
      return res.status(500).json({
        error: `PostgreSQL Database Connection Failed: ${err.message}. Please check POSTGRES_USER & POSTGRES_PASSWORD in your .env file.`,
      });
    }
    res.status(500).json({ error: err.message || 'Failed to sign in' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateJWT, async (req, res) => {
  try {
    const userRes = await query(
      'SELECT id, email, full_name, phone_number, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const profileRes = await query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    res.json({
      user: userRes.rows[0],
      profile: profileRes.rows[0] || null,
    });
  } catch (err) {
    console.error('Get User Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// Update User Profile
app.put('/api/auth/profile', authenticateJWT, async (req, res) => {
  try {
    const { full_name, phone_number } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const updatedUser = await query(
      'UPDATE users SET full_name = $1, phone_number = $2 WHERE id = $3 RETURNING id, email, full_name, phone_number, role, created_at',
      [full_name.trim(), phone_number ? phone_number.trim() : null, req.user.id]
    );

    await query(
      'UPDATE profiles SET full_name = $1, phone_number = $2 WHERE id = $3',
      [full_name.trim(), phone_number ? phone_number.trim() : null, req.user.id]
    );

    const user = updatedUser.rows[0];
    const token = generateToken(user);
    res.json({ token, user, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update Profile Error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change Password
app.post('/api/auth/change-password', authenticateJWT, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change Password Error:', err.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Forgot Password stub
app.post('/api/auth/forgot-password', async (req, res) => {
  res.json({ message: 'If the email exists, a password reset link has been dispatched.' });
});

// ==========================================
// 2. REPORTS & STORAGE ROUTES
// ==========================================

// Create / Upload Report
app.post('/api/reports', authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    const { file_name, raw_text, values, summary } = req.body;

    let object_key = null;
    let file_path = null;

    if (req.file) {
      const timestamp = Date.now();
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      object_key = `${req.user.id}/${timestamp}_${safeName}`;

      try {
        await minioClient.putObject(
          BUCKET_NAME,
          object_key,
          req.file.buffer,
          req.file.buffer.length,
          { 'Content-Type': req.file.mimetype }
        );
        file_path = `/api/reports/file-stream/${encodeURIComponent(object_key)}`;
      } catch (minioErr) {
        console.warn('MinIO offline, falling back to local disk storage:', minioErr.message);
        saveFileLocally(object_key, req.file.buffer);
        file_path = `/api/reports/file-stream/${encodeURIComponent(object_key)}`;
      }
    }

    let parsedValues = {};
    if (typeof values === 'string') {
      try { parsedValues = JSON.parse(values); } catch (e) {}
    } else if (typeof values === 'object' && values !== null) {
      parsedValues = values;
    }

    const reportRes = await query(
      `INSERT INTO reports (user_id, file_name, object_key, file_path, raw_text, values, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        file_name || req.file?.originalname || 'Lab Report',
        object_key,
        file_path,
        raw_text || '',
        JSON.stringify(parsedValues),
        summary || '',
      ]
    );

    const createdReport = reportRes.rows[0];

    // Index RAG chunks for immediate retrieval
    await indexReportChunks(
      createdReport.id,
      req.user.id,
      createdReport.file_name,
      createdReport.raw_text,
      createdReport.values,
      createdReport.summary
    );

    res.status(201).json(createdReport);
  } catch (err) {
    console.error('Create Report Error:', err.message);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// ==========================================
// RAG (RETRIEVAL-AUGMENTED GENERATION) SEARCH ROUTE
// ==========================================
app.post('/api/rag/search', authenticateJWT, async (req, res) => {
  try {
    const { query: searchQuery, report_id, top_k = 5 } = req.body;
    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const q = searchQuery.trim().toLowerCase();

    let rows = [];
    if (report_id) {
      const searchRes = await query(
        `SELECT rc.*, r.created_at as report_created_at
         FROM report_chunks rc
         JOIN reports r ON rc.report_id = r.id
         WHERE rc.user_id = $1 AND rc.report_id = $2
           AND (rc.chunk_text ILIKE $3 OR rc.metrics_text ILIKE $3)
         ORDER BY rc.chunk_index ASC
         LIMIT $4`,
        [req.user.id, report_id, `%${q}%`, top_k]
      );
      rows = searchRes.rows;
    } else {
      const searchRes = await query(
        `SELECT rc.*, r.created_at as report_created_at
         FROM report_chunks rc
         JOIN reports r ON rc.report_id = r.id
         WHERE rc.user_id = $1
           AND (rc.chunk_text ILIKE $2 OR rc.metrics_text ILIKE $2 OR rc.file_name ILIKE $2)
         ORDER BY r.created_at DESC, rc.chunk_index ASC
         LIMIT $3`,
        [req.user.id, `%${q}%`, top_k]
      );
      rows = searchRes.rows;
    }

    // Fallback if no strict ILIKE matches found: return top recent report chunks
    if (rows.length === 0) {
      const fallbackRes = await query(
        `SELECT rc.*, r.created_at as report_created_at
         FROM report_chunks rc
         JOIN reports r ON rc.report_id = r.id
         WHERE rc.user_id = $1
         ORDER BY r.created_at DESC, rc.chunk_index ASC
         LIMIT $2`,
        [req.user.id, top_k]
      );
      rows = fallbackRes.rows;
    }

    res.json({
      chunks: rows.map((r) => ({
        id: r.id,
        report_id: r.report_id,
        file_name: r.file_name,
        chunk_text: r.chunk_text,
        metrics_text: r.metrics_text,
        created_at: r.report_created_at || r.created_at,
      })),
    });
  } catch (err) {
    console.error('RAG Search Error:', err.message);
    res.status(500).json({ error: 'Failed to search report chunks' });
  }
});

// List User Reports
app.get('/api/reports', authenticateJWT, async (req, res) => {
  try {
    const reportsRes = await query(
      'SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(reportsRes.rows);
  } catch (err) {
    console.error('Fetch Reports Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get Single Report
app.get('/api/reports/:id', authenticateJWT, async (req, res) => {
  try {
    const reportRes = await query(
      'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(reportRes.rows[0]);
  } catch (err) {
    console.error('Fetch Single Report Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Stream File Content from MinIO or Local Disk
app.get('/api/reports/:id/file', authenticateJWT, async (req, res) => {
  try {
    const reportRes = await query(
      'SELECT object_key, file_name FROM reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (reportRes.rows.length === 0 || !reportRes.rows[0].object_key) {
      return res.status(404).json({ error: 'Report file attachment not found' });
    }

    const { object_key, file_name } = reportRes.rows[0];

    if (file_name.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (file_name.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (file_name.endsWith('.jpg') || file_name.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }

    try {
      const dataStream = await minioClient.getObject(BUCKET_NAME, object_key);
      dataStream.pipe(res);
    } catch (minioErr) {
      const localFilePath = path.join(UPLOADS_DIR, object_key.replace(/\//g, '_'));
      if (fs.existsSync(localFilePath)) {
        fs.createReadStream(localFilePath).pipe(res);
      } else {
        res.status(404).json({ error: 'File attachment not found in MinIO or local storage' });
      }
    }
  } catch (err) {
    console.error('Stream File Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

// Delete Report
app.delete('/api/reports/:id', authenticateJWT, async (req, res) => {
  try {
    const reportRes = await query(
      'SELECT object_key FROM reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { object_key } = reportRes.rows[0];

    if (object_key) {
      try {
        await minioClient.removeObject(BUCKET_NAME, object_key);
      } catch (minioErr) {
        console.warn('MinIO delete warning:', minioErr.message);
      }
      const localFilePath = path.join(UPLOADS_DIR, object_key.replace(/\//g, '_'));
      if (fs.existsSync(localFilePath)) {
        try { fs.unlinkSync(localFilePath); } catch (e) {}
      }
    }

    await query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Delete Report Error:', err.message);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// ==========================================
// 3. CHAT ASSISTANT ROUTES
// ==========================================

// Get Chat Messages
app.get('/api/chat', authenticateJWT, async (req, res) => {
  try {
    const { report_id } = req.query;
    let chatRes;

    if (report_id) {
      chatRes = await query(
        'SELECT * FROM chat_messages WHERE user_id = $1 AND report_id = $2 ORDER BY created_at ASC',
        [req.user.id, report_id]
      );
    } else {
      chatRes = await query(
        'SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC',
        [req.user.id]
      );
    }

    res.json(chatRes.rows);
  } catch (err) {
    console.error('Fetch Chat Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Save Chat Message
app.post('/api/chat', authenticateJWT, async (req, res) => {
  try {
    const { report_id, role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    const msgRes = await query(
      `INSERT INTO chat_messages (user_id, report_id, role, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, report_id || null, role, content]
    );

    res.status(201).json(msgRes.rows[0]);
  } catch (err) {
    console.error('Save Chat Error:', err.message);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});

// ==========================================
// 4. ADMIN ROUTES
// ==========================================

app.post('/api/admin/login', async (req, res) => {
  const { username, password, email } = req.body;
  const adminEmail = email || username;

  if (adminEmail === 'admin@labsense.com' && password === 'admin123') {
    const token = generateToken({
      id: '00000000-0000-0000-0000-000000000001',
      email: adminEmail,
      role: 'admin',
      full_name: 'Administrator',
    });
    return res.json({ token, user: { email: adminEmail, role: 'admin' } });
  }

  try {
    const userRes = await query('SELECT * FROM users WHERE email = $1 AND role = $2', [
      adminEmail,
      'admin',
    ]);
    if (userRes.rows.length > 0) {
      const match = await bcrypt.compare(password, userRes.rows[0].password_hash);
      if (match) {
        const token = generateToken(userRes.rows[0]);
        return res.json({ token, user: userRes.rows[0] });
      }
    }
  } catch (err) {}

  res.status(401).json({ error: 'Invalid admin credentials' });
});

app.get('/api/admin/stats', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const usersCount = await query('SELECT COUNT(*) FROM users');
    const reportsCount = await query('SELECT COUNT(*) FROM reports');
    const messagesCount = await query('SELECT COUNT(*) FROM chat_messages');
    const storageRes = await query('SELECT SUM(octet_length(COALESCE(raw_text, \'\'))) as text_bytes FROM reports');

    const totalUsers = parseInt(usersCount.rows[0].count, 10);
    const totalReports = parseInt(reportsCount.rows[0].count, 10);
    const totalMessages = parseInt(messagesCount.rows[0].count, 10);
    const rawBytes = parseInt(storageRes.rows[0]?.text_bytes || 0, 10);
    const estimatedStorageBytes = totalReports * 1024 * 180 + rawBytes; // ~180KB avg per file

    res.json({
      total_users: totalUsers,
      total_reports: totalReports,
      total_messages: totalMessages,
      total_storage_bytes: estimatedStorageBytes,
      total_storage_mb: Math.round((estimatedStorageBytes / (1024 * 1024)) * 100) / 100,
    });
  } catch (err) {
    console.error('Admin Stats Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

// Admin Get All Users
app.get('/api/admin/users', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const usersRes = await query(`
      SELECT u.id, u.email, u.full_name, u.phone_number, u.role, u.created_at,
             COUNT(r.id)::int as reports_count
      FROM users u
      LEFT JOIN reports r ON u.id = r.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC;
    `);
    res.json(usersRes.rows);
  } catch (err) {
    console.error('Admin Fetch Users Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin Delete User
app.delete('/api/admin/users/:id', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    const reportsRes = await query('SELECT object_key FROM reports WHERE user_id = $1', [targetUserId]);
    for (const r of reportsRes.rows) {
      if (r.object_key) {
        try { await minioClient.removeObject(BUCKET_NAME, r.object_key); } catch (e) {}
        const localFilePath = path.join(UPLOADS_DIR, r.object_key.replace(/\//g, '_'));
        if (fs.existsSync(localFilePath)) { try { fs.unlinkSync(localFilePath); } catch (e) {} }
      }
    }

    await query('DELETE FROM users WHERE id = $1', [targetUserId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Admin Delete User Error:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Admin Update User Role
app.patch('/api/admin/users/:id/role', authenticateJWT, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
    }

    // Require admin OR self-switch
    if (req.user.role !== 'admin' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Admin access required to update other users' });
    }

    const userRes = await query('SELECT id, email, full_name, role FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query('UPDATE users SET role = $1 WHERE id = $2', [role, targetUserId]);

    // Also update profiles table if role column exists
    try {
      await query('UPDATE profiles SET role = $1 WHERE id = $2', [role, targetUserId]);
    } catch (e) {}

    const updatedUser = {
      ...userRes.rows[0],
      role,
    };
    const newToken = generateToken(updatedUser);

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: updatedUser,
      token: newToken,
    });
  } catch (err) {
    console.error('Admin Update Role Error:', err.message);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Admin Get All System Reports
app.get('/api/admin/reports', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const reportsRes = await query(`
      SELECT r.id, r.user_id, r.file_name, r.summary, r.created_at,
             u.email as user_email, u.full_name as user_full_name
      FROM reports r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC;
    `);
    res.json(reportsRes.rows);
  } catch (err) {
    console.error('Admin Fetch All Reports Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch system reports' });
  }
});

// Admin Delete Any System Report
app.delete('/api/admin/reports/:id', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const reportRes = await query('SELECT object_key FROM reports WHERE id = $1', [req.params.id]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { object_key } = reportRes.rows[0];
    if (object_key) {
      try { await minioClient.removeObject(BUCKET_NAME, object_key); } catch (e) {}
      const localFilePath = path.join(UPLOADS_DIR, object_key.replace(/\//g, '_'));
      if (fs.existsSync(localFilePath)) { try { fs.unlinkSync(localFilePath); } catch (e) {} }
    }

    await query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Admin Delete Report Error:', err.message);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// ==========================================
// 5. DATABASE INSPECTOR & MINIO STORAGE CONTROL ROUTES
// ==========================================

// Get All Database Tables & Schema Overview
app.get('/api/admin/db/tables', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const tableNames = ['users', 'profiles', 'reports', 'report_chunks', 'chat_messages'];
    const tables = [];

    for (const t of tableNames) {
      const countRes = await query(`SELECT COUNT(*) FROM ${t}`);
      const colsRes = await query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [t]
      );
      tables.push({
        table_name: t,
        row_count: parseInt(countRes.rows[0].count, 10),
        columns: colsRes.rows,
      });
    }

    res.json(tables);
  } catch (err) {
    console.error('Admin DB Tables Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch database tables overview' });
  }
});

// Get Paginated Rows for a Specific Table
app.get('/api/admin/db/table/:tableName', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const allowedTables = ['users', 'profiles', 'reports', 'report_chunks', 'chat_messages'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Invalid or restricted table name' });
    }

    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const rowsRes = await query(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const countRes = await query(`SELECT COUNT(*) FROM ${tableName}`);

    res.json({
      table_name: tableName,
      total_rows: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
      rows: rowsRes.rows,
    });
  } catch (err) {
    console.error('Admin DB Table Rows Error:', err.message);
    res.status(500).json({ error: `Failed to fetch rows for table ${req.params.tableName}` });
  }
});

// Admin Raw SQL Console Executer
app.post('/api/admin/db/query', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || !sql.trim()) {
      return res.status(400).json({ error: 'SQL query string is required' });
    }

    const trimmed = sql.trim();
    const isDangerous = /\b(DROP DATABASE|TRUNCATE TABLE users)\b/i.test(trimmed);
    if (isDangerous) {
      return res.status(403).json({ error: 'Destructive system queries are restricted' });
    }

    const startTime = Date.now();
    const queryRes = await query(trimmed);
    const durationMs = Date.now() - startTime;

    res.json({
      command: queryRes.command,
      rowCount: queryRes.rowCount,
      durationMs,
      columns: queryRes.fields ? queryRes.fields.map((f) => f.name) : [],
      rows: queryRes.rows || [],
    });
  } catch (err) {
    console.error('Admin SQL Query Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Re-index RAG Chunks for a Specific Report
app.post('/api/admin/reports/:id/reindex', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const reportRes = await query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const r = reportRes.rows[0];
    await indexReportChunks(r.id, r.user_id, r.file_name, r.raw_text, r.values, r.summary);

    const chunkCount = await query('SELECT COUNT(*) FROM report_chunks WHERE report_id = $1', [r.id]);
    res.json({
      success: true,
      message: `Successfully re-indexed ${chunkCount.rows[0].count} RAG chunks for ${r.file_name}`,
    });
  } catch (err) {
    console.error('Admin Reindex Error:', err.message);
    res.status(500).json({ error: 'Failed to re-index report RAG chunks' });
  }
});

// MinIO / Storage Objects Explorer API
app.get('/api/admin/minio/objects', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const reportsRes = await query(`
      SELECT r.id as report_id, r.file_name, r.object_key, r.file_path, r.created_at,
             octet_length(COALESCE(r.raw_text, '')) as raw_text_bytes,
             u.email as owner_email
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);

    const objects = reportsRes.rows.map((r) => {
      let localExists = false;
      if (r.object_key) {
        const localPath = path.join(UPLOADS_DIR, r.object_key.replace(/\//g, '_'));
        localExists = fs.existsSync(localPath);
      }
      return {
        report_id: r.report_id,
        file_name: r.file_name,
        object_key: r.object_key || `${r.report_id}/${r.file_name}`,
        owner_email: r.owner_email || 'System User',
        created_at: r.created_at,
        file_path: r.file_path,
        local_exists: localExists,
        mimetype: r.file_name.endsWith('.pdf') ? 'application/pdf' : r.file_name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    });

    res.json({
      bucket_name: BUCKET_NAME,
      total_objects: objects.length,
      objects,
    });
  } catch (err) {
    console.error('Admin MinIO Objects Error:', err.message);
    res.status(500).json({ error: 'Failed to list MinIO storage objects' });
  }
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 LabSense Express Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process. Kill the process on port ${PORT} or choose another port.`);
  } else {
    console.error(`❌ Express Server Error:`, err.message);
  }
});
