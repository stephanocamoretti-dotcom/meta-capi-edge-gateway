import { webcrypto } from 'node:crypto';

export interface RawUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
  fbclid?: string;
}

export interface NormalizedMetaUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function cleanText(val?: string): string | undefined {
  const trimmed = val?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function cleanPhone(val?: string): string | undefined {
  const digits = val?.replace(/[^\d]/g, '');
  return digits && digits.length >= 7 ? digits : undefined;
}

export function buildFbcFromFbclid(fbclid?: string, timestampSec = Math.floor(Date.now() / 1000)): string | undefined {
  if (!fbclid?.trim()) return undefined;
  return `fb.1.${timestampSec}.${fbclid.trim()}`;
}

export async function normalizeAndHashUserData(raw: RawUserData): Promise<NormalizedMetaUserData> {
  const out: NormalizedMetaUserData = {};

  const email = cleanText(raw.email);
  if (email) out.em = [await sha256Hex(email)];

  const phone = cleanPhone(raw.phone);
  if (phone) out.ph = [await sha256Hex(phone)];

  const fn = cleanText(raw.firstName);
  if (fn) out.fn = [await sha256Hex(fn)];

  const ln = cleanText(raw.lastName);
  if (ln) out.ln = [await sha256Hex(ln)];

  const ct = cleanText(raw.city)?.replace(/\s+/g, '');
  if (ct) out.ct = [await sha256Hex(ct)];

  const st = cleanText(raw.state)?.replace(/\s+/g, '');
  if (st) out.st = [await sha256Hex(st)];

  const zp = cleanText(raw.zip)?.replace(/\s+/g, '');
  if (zp) out.zp = [await sha256Hex(zp)];

  const country = cleanText(raw.country);
  if (country) out.country = [await sha256Hex(country)];

  const extId = raw.externalId?.trim();
  if (extId) out.external_id = [await sha256Hex(extId)];

  if (raw.clientIpAddress) out.client_ip_address = raw.clientIpAddress;
  if (raw.clientUserAgent) out.client_user_agent = raw.clientUserAgent;
  if (raw.fbc) out.fbc = raw.fbc;
  else if (raw.fbclid) out.fbc = buildFbcFromFbclid(raw.fbclid);
  if (raw.fbp) out.fbp = raw.fbp;

  return out;
}

/**
 * Estimates Meta Event Match Quality (0.0 - 10.0) prior to dispatch
 * so AdTech teams can audit signal completeness in real time.
 */
export function estimateMatchQuality(userData: NormalizedMetaUserData): {
  score: number;
  tier: 'low' | 'good' | 'great';
  missing: string[];
} {
  let score = 0;
  const missing: string[] = [];

  if (userData.em?.length) score += 2.5;
  else missing.push('email');

  if (userData.ph?.length) score += 2.2;
  else missing.push('phone');

  if (userData.fbc) score += 1.8;
  else missing.push('fbc/fbclid');

  if (userData.fbp) score += 1.0;
  else missing.push('fbp');

  if (userData.external_id?.length) score += 1.0;
  else missing.push('external_id');

  if (userData.client_ip_address && userData.client_user_agent) score += 0.8;
  else missing.push('ip+ua');

  if (userData.fn?.length || userData.ln?.length || userData.zp?.length) score += 0.7;

  const clamped = Math.min(10, Number(score.toFixed(1)));
  const tier = clamped >= 8.0 ? 'great' : clamped >= 5.5 ? 'good' : 'low';
  return { score: clamped, tier, missing };
}
