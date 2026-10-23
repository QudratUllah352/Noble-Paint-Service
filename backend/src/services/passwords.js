import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [salt, hex] = encoded.split(':');
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
