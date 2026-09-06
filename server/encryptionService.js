import crypto from 'crypto';

/**
 * AES-256-GCM Encryption Service
 * Encrypts sensitive medical data (reports, raw text, values, chat messages) at rest.
 */

const ALGORITHM = 'aes-256-gcm';
// Master secret key fallback for dev (32 bytes)
const MASTER_KEY = process.env.ENCRYPTION_KEY || 'labsense_aes256_medical_secret_key_32bytes!';

function getEncryptionKey() {
  return crypto.createHash('sha256').update(MASTER_KEY).digest();
}

/**
 * Encrypt a plain text or JSON string using AES-256-GCM
 */
export function encryptData(text) {
  if (!text) return text;
  try {
    const stringValue = typeof text === 'object' ? JSON.stringify(text) : String(text);
    const iv = crypto.randomBytes(12);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(stringValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return JSON.stringify({
      is_encrypted: true,
      algorithm: 'AES-256-GCM',
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: authTag,
    });
  } catch (err) {
    console.error('Encryption Error:', err.message);
    return text;
  }
}

/**
 * Decrypt a cipher text object or string using AES-256-GCM
 */
export function decryptData(encryptedPayload) {
  if (!encryptedPayload) return encryptedPayload;
  try {
    let payload = encryptedPayload;
    if (typeof encryptedPayload === 'string' && encryptedPayload.trim().startsWith('{')) {
      try {
        payload = JSON.parse(encryptedPayload);
      } catch (e) {
        return encryptedPayload;
      }
    }

    if (!payload || !payload.is_encrypted || !payload.ciphertext) {
      return encryptedPayload; // Return raw text if not encrypted payload
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  } catch (err) {
    console.warn('Decryption Warning:', err.message);
    return encryptedPayload;
  }
}
