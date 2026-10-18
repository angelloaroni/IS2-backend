import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { createAccessToken, verifyAccessToken } from '../src/utils/jwt.js';
import { hashPassword, isPasswordHash, verifyPassword } from '../src/utils/password.js';

test('hashes passwords and verifies them without changing their contents', async () => {
    const password = '  exact password  ';
    const hashed = await hashPassword(password);

    assert.notEqual(hashed, password);
    assert.equal(isPasswordHash(hashed), true);
    assert.equal(await verifyPassword(password, hashed), true);
    assert.equal(await verifyPassword(password.trim(), hashed), false);
});

test('recognizes existing plaintext passwords for one-time migration', async () => {
    assert.equal(await verifyPassword('old password', 'old password'), true);
    assert.equal(await verifyPassword('wrong password', 'old password'), false);
    assert.equal(isPasswordHash('old password'), false);
});

test('signs and verifies an access token with an account subject', () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-bytes';

    try {
        const token = createAccessToken({ id_user: 42 });
        const claims = verifyAccessToken(token);
        assert.equal(claims.sub, '42');
        assert.equal(claims.iss, 'is2-backend');
        assert.equal(claims.aud, 'is2-api');
    } finally {
        if (previousSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousSecret;
        }
    }
});

test('refuses to sign tokens with a missing or weak secret', () => {
    const previousSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    try {
        assert.throws(() => createAccessToken({ id_user: 42 }), /JWT_SECRET/);
    } finally {
        if (previousSecret !== undefined) {
            process.env.JWT_SECRET = previousSecret;
        }
    }
});

test('rejects tokens signed with a different secret', () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-bytes';

    try {
        const token = jwt.sign({ sub: '42' }, 'different-secret', {
            algorithm: 'HS256',
            issuer: 'is2-backend',
            audience: 'is2-api',
        });
        assert.throws(() => verifyAccessToken(token), /invalid signature/i);
    } finally {
        if (previousSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousSecret;
        }
    }
});
