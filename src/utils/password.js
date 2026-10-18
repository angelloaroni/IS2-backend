import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
export const MAX_PASSWORD_BYTES = 72;

export function isPasswordHash(value) {
    return BCRYPT_HASH_PATTERN.test(String(value ?? ''));
}

export async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, storedPassword) {
    if (isPasswordHash(storedPassword)) {
        return bcrypt.compare(password, storedPassword);
    }

    const provided = Buffer.from(password);
    const stored = Buffer.from(String(storedPassword ?? ''));
    return provided.length === stored.length && timingSafeEqual(provided, stored);
}
