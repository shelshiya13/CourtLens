import crypto from 'crypto';
import { env } from '../../config/env.js';
import { OtpProvider, OtpSendResult } from './OtpProvider.js';
import { DevConsoleOtpProvider } from './DevConsoleOtpProvider.js';
import { SmtpOtpProvider } from './SmtpOtpProvider.js';
import { SmsOtpProvider } from './SmsOtpProvider.js';

export function getOtpProvider(): OtpProvider {
  if (env.SMTP_HOST && env.SMTP_USER) {
    return new SmtpOtpProvider();
  }
  if (env.SMS_WEBHOOK_URL) {
    return new SmsOtpProvider();
  }
  return new DevConsoleOtpProvider();
}

export function generateOtpCode(): string {
  // Generate cryptographically secure 6-digit code
  const codeInt = crypto.randomInt(100000, 1000000);
  return codeInt.toString();
}

export function hashOtp(identifier: string, code: string): string {
  return crypto
    .createHmac('sha256', env.OTP_HMAC_SECRET)
    .update(`${identifier.trim().toLowerCase()}:${code.trim()}`)
    .digest('hex');
}

export function detectChannel(identifier: string): 'email' | 'sms' {
  return identifier.includes('@') ? 'email' : 'sms';
}
