import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import { signToken, requireAuth, AuthUser } from './middleware.js';
import { getOtpProvider, generateOtpCode, hashOtp, detectChannel } from './otp/index.js';
import { logAudit } from '../audit/auditLog.js';

export const authRouter = Router();

// In-memory simple rate limiting for auth endpoints
const rateLimitMap = new Map<string, { attempts: number; firstAttempt: number }>();
function checkRateLimit(key: string, limit = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.firstAttempt > windowMs) {
    rateLimitMap.set(key, { attempts: 1, firstAttempt: now });
    return true;
  }
  if (entry.attempts >= limit) {
    return false;
  }
  entry.attempts += 1;
  return true;
}

// 1. Lawyer Registration
authRouter.post('/lawyer/register', async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(10, 'Password must be at least 10 characters long'),
    enrolmentId: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
  }

  const { name, email, password, enrolmentId } = parsed.data;
  const ip = req.ip || 'anonymous';
  if (!checkRateLimit(`register:${ip}:${email}`)) {
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Please wait 15 minutes.' } });
  }

  const db = await getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, role, name, email, password_hash, enrolment_id, created_at)
    VALUES (?, 'lawyer', ?, ?, ?, ?, ?)
  `).run(userId, name, email.toLowerCase().trim(), passwordHash, enrolmentId || null, now);

  const authUser: AuthUser = {
    userId,
    role: 'lawyer',
    name,
    email: email.toLowerCase().trim()
  };

  const token = signToken(authUser);
  res.cookie('caselens_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  await logAudit({
    actorId: userId,
    action: 'lawyer_register',
    entityType: 'user',
    entityId: userId,
    details: { email }
  });

  return res.json({ user: authUser, token });
});

// 2. Lawyer Login
authRouter.post('/lawyer/login', async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid credentials format' } });
  }

  const { email, password } = parsed.data;
  const ip = req.ip || 'anonymous';
  if (!checkRateLimit(`login:${ip}:${email}`)) {
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait 15 minutes.' } });
  }

  const db = await getDb();
  const user = db.prepare<any>('SELECT * FROM users WHERE email = ? AND role = ?').get(email.toLowerCase().trim(), 'lawyer');

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  }

  // Reset rate limiting on successful authentication
  rateLimitMap.delete(`login:${ip}:${email}`);

  const authUser: AuthUser = {
    userId: user.id,
    role: 'lawyer',
    name: user.name,
    email: user.email
  };

  const token = signToken(authUser);
  res.cookie('caselens_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  await logAudit({
    actorId: user.id,
    action: 'lawyer_login',
    entityType: 'user',
    entityId: user.id
  });

  return res.json({ user: authUser, token });
});

// 3. Guardian OTP Request
authRouter.post('/guardian/otp/request', async (req: Request, res: Response) => {
  const schema = z.object({
    identifier: z.string().min(3, 'Email or mobile required')
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Identifier is required' } });
  }

  const cleanIdentifier = parsed.data.identifier.trim().toLowerCase();
  const ip = req.ip || 'anonymous';
  if (!checkRateLimit(`otp_req:${ip}:${cleanIdentifier}`, 5, 5 * 60 * 1000)) {
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Please wait a few minutes.' } });
  }

  const db = await getDb();

  // Check if guardian user exists and is linked to at least one case
  const user = db.prepare<any>(`
    SELECT u.id, u.name, u.role
    FROM users u
    JOIN case_access ca ON ca.user_id = u.id
    WHERE (u.email = ? OR u.mobile = ?) AND ca.access_level = 'guardian_view'
    LIMIT 1
  `).get(cleanIdentifier, cleanIdentifier);

  if (!user) {
    return res.status(404).json({
      error: {
        code: 'NOT_LINKED',
        message: 'No cases are linked to this identifier. Please contact your lawyer.'
      }
    });
  }

  // Check recent unconsumed challenge for 30s resend cooldown
  const recentChallenge = db.prepare<any>(`
    SELECT created_at FROM otp_challenges
    WHERE identifier = ? AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(cleanIdentifier);

  if (recentChallenge) {
    const elapsedMs = Date.now() - new Date(recentChallenge.created_at).getTime();
    if (elapsedMs < 30 * 1000) {
      const waitSeconds = Math.ceil((30 * 1000 - elapsedMs) / 1000);
      return res.status(429).json({
        error: { code: 'COOLDOWN', message: `Please wait ${waitSeconds} seconds before requesting a new code.` }
      });
    }
  }

  const code = generateOtpCode();
  const codeHmac = hashOtp(cleanIdentifier, code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const challengeId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO otp_challenges (id, identifier, code_hmac, expires_at, attempts, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(challengeId, cleanIdentifier, codeHmac, expiresAt, now);

  const channel = detectChannel(cleanIdentifier);
  const otpProvider = getOtpProvider();
  const dispatchResult = await otpProvider.send(cleanIdentifier, channel, code);

  return res.json({
    success: true,
    identifier: cleanIdentifier,
    channel,
    mode: dispatchResult.mode,
    devCode: dispatchResult.devCode,
    message: dispatchResult.message || 'Verification code sent.'
  });
});

// 4. Guardian OTP Verify
authRouter.post('/guardian/otp/verify', async (req: Request, res: Response) => {
  const schema = z.object({
    identifier: z.string().min(3),
    code: z.string().length(6, 'Verification code must be 6 digits')
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A 6-digit code is required' } });
  }

  const { identifier, code } = parsed.data;
  const cleanIdentifier = identifier.trim().toLowerCase();
  const db = await getDb();

  const challenge = db.prepare<any>(`
    SELECT * FROM otp_challenges
    WHERE identifier = ? AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(cleanIdentifier);

  if (!challenge) {
    return res.status(400).json({ error: { code: 'NO_ACTIVE_CHALLENGE', message: 'No pending verification code found. Please request a new code.' } });
  }

  // Check expiration
  if (new Date() > new Date(challenge.expires_at)) {
    return res.status(400).json({ error: { code: 'EXPIRED', message: 'Verification code has expired. Please request a new one.' } });
  }

  // Check attempt limit (max 5)
  if (challenge.attempts >= 5) {
    return res.status(400).json({ error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many incorrect attempts. Please request a new code.' } });
  }

  const calculatedHmac = hashOtp(cleanIdentifier, code);
  if (calculatedHmac !== challenge.code_hmac) {
    db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(challenge.id);
    const remaining = 4 - challenge.attempts;
    return res.status(400).json({
      error: {
        code: 'INVALID_CODE',
        message: remaining > 0 ? `Incorrect verification code. ${remaining} attempts remaining.` : 'Too many incorrect attempts. Please request a new code.'
      }
    });
  }

  // Mark consumed
  db.prepare('UPDATE otp_challenges SET consumed_at = ? WHERE id = ?').run(new Date().toISOString(), challenge.id);

  // Retrieve guardian user
  const user = db.prepare<any>(`
    SELECT * FROM users WHERE email = ? OR mobile = ?
  `).get(cleanIdentifier, cleanIdentifier);

  if (!user) {
    return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Guardian user not found.' } });
  }

  const authUser: AuthUser = {
    userId: user.id,
    role: 'guardian',
    name: user.name,
    email: user.email || undefined,
    mobile: user.mobile || undefined
  };

  const token = signToken(authUser);
  res.cookie('caselens_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  await logAudit({
    actorId: user.id,
    action: 'guardian_login',
    entityType: 'user',
    entityId: user.id
  });

  return res.json({ user: authUser, token });
});

// 5. Current User
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

// 6. Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('caselens_token');
  return res.json({ success: true });
});
