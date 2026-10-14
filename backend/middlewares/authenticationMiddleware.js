import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'labsense-super-secret-jwt-key-2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generates a signed JWT for a given user payload.
 */
export function generateToken(userPayload) {
  return jwt.sign(
    {
      id: userPayload.id,
      email: userPayload.email,
      role: userPayload.role || 'user',
      full_name: userPayload.full_name || '',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Express middleware to authenticate incoming requests via Bearer JWT.
 */
export function authenticateJWT(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;
  } else if (req.cookies && req.cookies.labsense_jwt_token) {
    token = req.cookies.labsense_jwt_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export function setTokenCookie(res, token) {
  res.cookie('labsense_jwt_token', token, COOKIE_OPTIONS);
}

export function clearTokenCookie(res) {
  res.clearCookie('labsense_jwt_token', {
    ...COOKIE_OPTIONS,
    maxAge: undefined,
  });
}

/**
 * Optional middleware for routes that allow both guest and authenticated users.
 */
export function optionalJWT(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;
  } else if (req.cookies && req.cookies.labsense_jwt_token) {
    token = req.cookies.labsense_jwt_token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    req.user = null;
  }
  next();
}

/**
 * Admin role verification middleware.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
