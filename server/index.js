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
import { generateMedicalReasoning } from './medicalReasoningService.js';
import { retrieveServerRagContext } from './ragService.js';
import { encryptData, decryptData } from './encryptionService.js';
import { sendOtpEmail } from './emailService.js';

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

// Sign Up (With Mandatory Email / Phone OTP Verification Requirement)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name, phone_number, verification_code, verification_type = 'email' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number ? phone_number.trim() : null;

    const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Enforce OTP Code Verification on Registration
    if (!verification_code || !verification_code.trim()) {
      // Auto-trigger OTP generation for convenience
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await query('DELETE FROM email_verifications WHERE email = $1', [cleanEmail]);
      await query('INSERT INTO email_verifications (email, code, expires_at) VALUES ($1, $2, $3)', [
        cleanEmail,
        otpCode,
        expiresAt,
      ]);

      await sendOtpEmail(cleanEmail, otpCode, 'Registration');

      return res.status(422).json({
        requires_verification: true,
        message: `Please enter the 6-digit OTP code sent to ${cleanEmail} to verify your identity and complete registration.`,
        email: cleanEmail,
        code_dev: otpCode,
      });
    }

    // Validate the OTP Code provided by the user
    let validOtp = false;
    if (verification_type === 'phone' && cleanPhone) {
      const pRes = await query(
        'SELECT * FROM phone_verifications WHERE phone_number = $1 AND code = $2 AND expires_at > NOW()',
        [cleanPhone, verification_code.trim()]
      );
      if (pRes.rows.length > 0) {
        validOtp = true;
        await query('DELETE FROM phone_verifications WHERE phone_number = $1', [cleanPhone]);
      }
    } else {
      const eRes = await query(
        'SELECT * FROM email_verifications WHERE email = $1 AND code = $2 AND expires_at > NOW()',
        [cleanEmail, verification_code.trim()]
      );
      if (eRes.rows.length > 0) {
        validOtp = true;
        await query('DELETE FROM email_verifications WHERE email = $1', [cleanEmail]);
      }
    }

    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid or expired 6-digit verification code' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userRes = await query(
      `INSERT INTO users (email, password_hash, full_name, phone_number, email_verified, phone_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, phone_number, role, created_at, email_verified, phone_verified`,
      [
        cleanEmail,
        password_hash,
        full_name ? full_name.trim() : '',
        cleanPhone,
        verification_type === 'email',
        verification_type === 'phone',
      ]
    );

    const user = userRes.rows[0];

    // Create profile entry
    await query(
      'INSERT INTO profiles (id, full_name, email, phone_number, email_verified, phone_verified) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
      [user.id, user.full_name, user.email, user.phone_number, user.email_verified, user.phone_verified]
    );

    const token = generateToken(user);
    res.json({ token, user, message: 'Account created and identity verified successfully!' });
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

    // Check if 2FA is enabled for this user
    if (user.two_factor_enabled) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      await query('DELETE FROM two_factor_codes WHERE user_id = $1', [user.id]);
      await query(
        'INSERT INTO two_factor_codes (user_id, code, expires_at) VALUES ($1, $2, $3)',
        [user.id, otpCode, expiresAt]
      );

      await sendOtpEmail(user.email, otpCode, 'Two-Factor Authentication');

      return res.json({
        requires_2fa: true,
        message: 'Two-Factor Authentication OTP code sent to your email/device',
        user_id: user.id,
        email: user.email,
      });
    }

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

// Verify 2FA OTP Code
app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) {
      return res.status(400).json({ error: 'User ID and 2FA code are required' });
    }

    const otpRes = await query(
      'SELECT * FROM two_factor_codes WHERE user_id = $1 AND code = $2 AND expires_at > NOW()',
      [user_id, code.trim()]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired 2FA security code' });
    }

    await query('DELETE FROM two_factor_codes WHERE user_id = $1', [user_id]);

    const userRes = await query('SELECT id, email, full_name, phone_number, role, created_at, email_verified, phone_verified, two_factor_enabled FROM users WHERE id = $1', [user_id]);
    const user = userRes.rows[0];

    const token = generateToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    console.error('2FA Verification Error:', err.message);
    res.status(500).json({ error: 'Failed to verify 2FA code' });
  }
});

// Toggle 2FA in user profile settings
app.post('/api/auth/2fa/toggle', authenticateJWT, async (req, res) => {
  try {
    const { enabled } = req.body;
    const isEnabled = Boolean(enabled);

    await query('UPDATE users SET two_factor_enabled = $1 WHERE id = $2', [isEnabled, req.user.id]);
    res.json({
      success: true,
      message: `Two-Factor Authentication ${isEnabled ? 'enabled' : 'disabled'} successfully`,
      two_factor_enabled: isEnabled,
    });
  } catch (err) {
    console.error('Toggle 2FA Error:', err.message);
    res.status(500).json({ error: 'Failed to update 2FA settings' });
  }
});

// Email Verification: Send OTP (Supports both pre-login signup and authenticated profile)
app.post('/api/auth/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;
    let targetEmail = email ? email.trim().toLowerCase() : null;

    // Check optional Authorization header if present
    const authHeader = req.headers.authorization;
    if (!targetEmail && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'labsense_jwt_secret_key_default');
        targetEmail = decoded.email;
      } catch (e) {}
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'Email address is required to send verification code' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await query('DELETE FROM email_verifications WHERE email = $1', [targetEmail]);
    await query('INSERT INTO email_verifications (email, code, expires_at) VALUES ($1, $2, $3)', [
      targetEmail,
      otpCode,
      expiresAt,
    ]);

    await sendOtpEmail(targetEmail, otpCode, 'Email Verification');
    res.json({ success: true, message: `Email verification code sent to ${targetEmail}`, code_dev: otpCode });
  } catch (err) {
    console.error('Send Email OTP Error:', err.message);
    res.status(500).json({ error: 'Failed to send email verification code' });
  }
});

// Email Verification: Verify OTP (Supports pre-login signup and profile)
app.post('/api/auth/verify-email-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    let targetEmail = email ? email.trim().toLowerCase() : null;

    const authHeader = req.headers.authorization;
    if (!targetEmail && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'labsense_jwt_secret_key_default');
        targetEmail = decoded.email;
      } catch (e) {}
    }

    if (!code || !targetEmail) return res.status(400).json({ error: 'Email address and verification code are required' });

    const otpRes = await query(
      'SELECT * FROM email_verifications WHERE email = $1 AND code = $2 AND expires_at > NOW()',
      [targetEmail, code.trim()]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired email verification code' });
    }

    await query('DELETE FROM email_verifications WHERE email = $1', [targetEmail]);
    await query('UPDATE users SET email_verified = TRUE WHERE email = $1', [targetEmail]);
    await query('UPDATE profiles SET email_verified = TRUE WHERE email = $1', [targetEmail]);

    res.json({ success: true, message: 'Email address verified successfully!' });
  } catch (err) {
    console.error('Verify Email OTP Error:', err.message);
    res.status(500).json({ error: 'Failed to verify email code' });
  }
});

// Phone Verification: Send OTP
app.post('/api/auth/send-phone-otp', async (req, res) => {
  try {
    const { phone_number } = req.body;
    let targetPhone = phone_number ? phone_number.trim() : null;

    const authHeader = req.headers.authorization;
    if (!targetPhone && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'labsense_jwt_secret_key_default');
        targetPhone = decoded.phone_number;
      } catch (e) {}
    }

    if (!targetPhone) {
      return res.status(400).json({ error: 'Phone number is required for verification' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query('DELETE FROM phone_verifications WHERE phone_number = $1', [targetPhone]);
    await query('INSERT INTO phone_verifications (phone_number, code, expires_at) VALUES ($1, $2, $3)', [
      targetPhone,
      otpCode,
      expiresAt,
    ]);

    console.log(`[PHONE SMS VERIFICATION OTP] Sent Code for ${targetPhone}: ${otpCode}`);
    res.json({ success: true, message: `Phone SMS OTP code sent to ${targetPhone}`, code_dev: otpCode });
  } catch (err) {
    console.error('Send Phone OTP Error:', err.message);
    res.status(500).json({ error: 'Failed to send phone verification SMS' });
  }
});

// Phone Verification: Verify OTP
app.post('/api/auth/verify-phone-otp', async (req, res) => {
  try {
    const { phone_number, code } = req.body;
    let targetPhone = phone_number ? phone_number.trim() : null;

    const authHeader = req.headers.authorization;
    if (!targetPhone && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'labsense_jwt_secret_key_default');
        targetPhone = decoded.phone_number;
      } catch (e) {}
    }

    if (!code || !targetPhone) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    const otpRes = await query(
      'SELECT * FROM phone_verifications WHERE phone_number = $1 AND code = $2 AND expires_at > NOW()',
      [targetPhone, code.trim()]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired phone SMS verification code' });
    }

    await query('DELETE FROM phone_verifications WHERE phone_number = $1', [targetPhone]);
    await query('UPDATE users SET phone_verified = TRUE, phone_number = $1 WHERE phone_number = $1', [targetPhone]);
    await query('UPDATE profiles SET phone_verified = TRUE, phone_number = $1 WHERE phone_number = $1', [targetPhone]);

    res.json({ success: true, message: 'Phone number verified successfully!' });
  } catch (err) {
    console.error('Verify Phone OTP Error:', err.message);
    res.status(500).json({ error: 'Failed to verify phone code' });
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
    }    let parsedValues = {};
    if (typeof values === 'string') {
      try { parsedValues = JSON.parse(values); } catch (e) {}
    } else if (typeof values === 'object' && values !== null) {
      parsedValues = values;
    }

    // Compute 4-step Medical Reasoning Chain on the server
    const medicalReasoning = generateMedicalReasoning(parsedValues, summary);

    const reportRes = await query(
      `INSERT INTO reports (user_id, file_name, object_key, file_path, raw_text, values, summary, medical_reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        file_name || req.file?.originalname || 'Lab Report',
        object_key,
        file_path,
        raw_text || '',
        JSON.stringify(parsedValues),
        summary || '',
        JSON.stringify(medicalReasoning),
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

// Get Server-Processed Medical Reasoning for a Report
app.get('/api/reports/:id/reasoning', authenticateJWT, async (req, res) => {
  try {
    const reportRes = await query(
      'SELECT values, summary, medical_reasoning FROM reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const r = reportRes.rows[0];
    let reasoning = r.medical_reasoning;
    if (!reasoning || !reasoning.step1 || !reasoning.step1.observations) {
      reasoning = generateMedicalReasoning(r.values, r.summary);
      await query('UPDATE reports SET medical_reasoning = $1 WHERE id = $2', [
        JSON.stringify(reasoning),
        req.params.id,
      ]);
    }
    res.json(reasoning);
  } catch (err) {
    console.error('Fetch Reasoning Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch medical reasoning' });
  }
});

// ==========================================
// SERVER-SIDE RAG SEARCH ROUTE
// ==========================================
app.post('/api/rag/search', authenticateJWT, async (req, res) => {
  try {
    const { query: searchQuery, report_id, active_values, top_k = 5 } = req.body;
    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const ragResult = await retrieveServerRagContext({
      queryText: searchQuery,
      userId: req.user.id,
      reportId: report_id,
      topK: top_k,
      activeValues: active_values,
    });

    res.json(ragResult);
  } catch (err) {
    console.error('RAG Search Error:', err.message);
    res.status(500).json({ error: 'Failed to process server RAG search' });
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

// Delete Chat Messages / Session Thread
app.delete('/api/chat', authenticateJWT, async (req, res) => {
  try {
    const { report_id } = req.query;

    const isReportSpecific =
      report_id && report_id !== 'null' && report_id !== 'undefined' && report_id !== 'null';

    if (isReportSpecific) {
      await query('DELETE FROM chat_messages WHERE user_id = $1 AND report_id = $2', [
        req.user.id,
        report_id,
      ]);
      res.json({ success: true, message: 'Chat thread for report deleted' });
    } else {
      await query('DELETE FROM chat_messages WHERE user_id = $1 AND report_id IS NULL', [
        req.user.id,
      ]);
      res.json({ success: true, message: 'General chat thread deleted' });
    }
  } catch (err) {
    console.error('Delete Chat Error:', err.message);
    res.status(500).json({ error: 'Failed to delete chat thread' });
  }
});

// Delete All Chat History for Authenticated User
app.delete('/api/chat/all', authenticateJWT, async (req, res) => {
  try {
    await query('DELETE FROM chat_messages WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'All chat history cleared successfully' });
  } catch (err) {
    console.error('Clear All Chat Error:', err.message);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Get Chat Threads Overview
app.get('/api/chat/threads', authenticateJWT, async (req, res) => {
  try {
    const threadsRes = await query(
      `SELECT 
         cm.report_id,
         r.file_name,
         COUNT(cm.id)::int as message_count,
         MAX(cm.created_at) as last_activity
       FROM chat_messages cm
       LEFT JOIN reports r ON cm.report_id = r.id
       WHERE cm.user_id = $1
       GROUP BY cm.report_id, r.file_name
       ORDER BY last_activity DESC`,
      [req.user.id]
    );

    res.json(threadsRes.rows);
  } catch (err) {
    console.error('Fetch Chat Threads Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chat threads' });
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

// Admin Update User Role (Strict Admin Authorization Required)
app.patch('/api/admin/users/:id/role', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
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
// 5. POSTGRESQL DATABASE MANAGEMENT PORTAL ROUTES
// ==========================================

// Admin DB Portal: Get List of All Database Tables & Schema Overview
app.get('/api/admin/db/tables', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const tablesRes = await query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
        pg_size_pretty(pg_total_relation_size('"' || t.table_name || '"')) as total_size,
        pg_total_relation_size('"' || t.table_name || '"')::int as size_bytes
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name ASC;
    `);

    // Fetch exact row counts per table
    const tableList = [];
    for (const row of tablesRes.rows) {
      try {
        const countRes = await query(`SELECT COUNT(*)::int as row_count FROM "${row.table_name}"`);
        tableList.push({
          ...row,
          row_count: countRes.rows[0]?.row_count || 0,
        });
      } catch (e) {
        tableList.push({ ...row, row_count: 0 });
      }
    }

    res.json(tableList);
  } catch (err) {
    console.error('Admin DB Tables Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve database tables' });
  }
});

// Admin DB Portal: Get Table Columns, Indexes, and Paginated Row Records
app.get('/api/admin/db/tables/:tableName', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;

    // Validate table existence
    const checkRes = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
      [tableName]
    );
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found in database' });
    }

    // Get column definitions
    const columnsRes = await query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position ASC`,
      [tableName]
    );

    // Get indexes
    const indexRes = await query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
      [tableName]
    );

    // Get total rows
    const countRes = await query(`SELECT COUNT(*)::int as total FROM "${tableName}"`);
    const totalRows = countRes.rows[0]?.total || 0;

    // Fetch paginated rows
    const rowsRes = await query(`SELECT * FROM "${tableName}" ORDER BY 1 DESC LIMIT $1 OFFSET $2`, [
      limit,
      offset,
    ]);

    res.json({
      table_name: tableName,
      columns: columnsRes.rows,
      indexes: indexRes.rows,
      total_rows: totalRows,
      page,
      limit,
      total_pages: Math.ceil(totalRows / limit),
      rows: rowsRes.rows,
    });
  } catch (err) {
    console.error('Admin DB Table Detail Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch table details' });
  }
});

// Admin DB Portal: Execute Custom SQL Query Console
app.post('/api/admin/db/query', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { sql_query } = req.body;
    if (!sql_query || !sql_query.trim()) {
      return res.status(400).json({ error: 'SQL query string is required' });
    }

    const trimmed = sql_query.trim();
    // Restrict unsafe commands like DROP DATABASE or TRUNCATE in console
    const lower = trimmed.toLowerCase();
    if (lower.includes('drop database') || lower.includes('drop schema')) {
      return res.status(403).json({ error: 'Executing DROP DATABASE or DROP SCHEMA commands is prohibited.' });
    }

    const startTime = Date.now();
    const queryRes = await query(trimmed);
    const executionMs = Date.now() - startTime;

    res.json({
      success: true,
      command: queryRes.command,
      row_count: queryRes.rowCount,
      execution_ms: executionMs,
      fields: queryRes.fields ? queryRes.fields.map((f) => f.name) : [],
      rows: queryRes.rows || [],
    });
  } catch (err) {
    console.error('Admin SQL Console Query Error:', err.message);
    res.status(400).json({ error: `SQL Query Error: ${err.message}` });
  }
});

// Admin DB Portal: PostgreSQL Database Performance & Storage Health Stats
app.get('/api/admin/db/stats', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const dbSizeRes = await query(`SELECT pg_size_pretty(pg_database_size(current_database())) as total_db_size`);
    const connRes = await query(`SELECT COUNT(*)::int as active_connections FROM pg_stat_activity WHERE state = 'active'`);
    const versionRes = await query(`SELECT version()`);

    const tableStatsRes = await query(`
      SELECT 
        schemaname || '.' || relname as table_full_name,
        relname as table_name,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;
    `);

    res.json({
      database_name: process.env.POSTGRES_DB || 'labsense',
      total_db_size: dbSizeRes.rows[0]?.total_db_size || 'N/A',
      active_connections: connRes.rows[0]?.active_connections || 1,
      postgresql_version: versionRes.rows[0]?.version || 'PostgreSQL',
      tables: tableStatsRes.rows,
    });
  } catch (err) {
    console.error('Admin DB Stats Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve database health stats' });
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
