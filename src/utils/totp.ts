/**
 * TOTP (RFC 6238) implementation using jsSHA — compatible with Google Authenticator.
 */
import jsSHA from 'jssha';
import * as Crypto from 'expo-crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomTotpSecret(length = 32): string {
  const bytes = Crypto.getRandomBytes(length);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out.slice(0, length);
}

export function base32Decode(secret: string): Uint8Array {
  const clean = secret.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export async function generateTotp(secret: string, period = 30, digits = 6): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / period);
  return totpAt(secret, counter, digits);
}

export async function totpAt(secret: string, counter: number, digits = 6): Promise<string> {
  // 8-byte big-endian counter
  const msg: number[] = [];
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const keyBytes = base32Decode(secret);
  // jsSHA v3 with ARRAYBUFFER for both key and message
  const hmac = new jsSHA('SHA-1', 'ARRAYBUFFER');
  const keyBuf = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuf).set(keyBytes);
  const msgBuf = new ArrayBuffer(8);
  new Uint8Array(msgBuf).set(msg);
  hmac.setHMACKey(keyBuf, 'ARRAYBUFFER');
  hmac.update(msgBuf);
  const mac = hmac.getHMAC('ARRAYBUFFER');
  const macBytes = new Uint8Array(mac as ArrayBuffer);

  const offset = macBytes[macBytes.length - 1] & 0x0f;
  const bin =
    ((macBytes[offset] & 0x7f) << 24) |
    ((macBytes[offset + 1] & 0xff) << 16) |
    ((macBytes[offset + 2] & 0xff) << 8) |
    (macBytes[offset + 3] & 0xff);

  const code = (bin % 10 ** digits).toString().padStart(digits, '0');
  return code;
}

/** Verify with ±1 window tolerance. */
export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  const clean = (code || '').replace(/\D/g, '');
  if (!secret || clean.length !== 6) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (const c of [counter - 1, counter, counter + 1]) {
    const expected = await totpAt(secret, c);
    if (expected === clean) return true;
  }
  return false;
}

export async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

/** Build otpauth:// URI for manual add into Google Authenticator. */
export function totpUri(secret: string, account: string): string {
  const label = encodeURIComponent(`IR.TRADIng.AN (${account})`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=IR.TRADIng.AN&algorithm=SHA1&digits=6&period=30`;
}
