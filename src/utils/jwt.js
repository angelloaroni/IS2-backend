import jwt from 'jsonwebtoken';
import AppError from './AppError.js';

const JWT_ISSUER = 'is2-backend';
const JWT_AUDIENCE = 'is2-api';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
        throw new AppError('JWT_SECRET debe contener al menos 32 bytes aleatorios', 500);
    }

    return secret;
}

export function createAccessToken(usuario) {
    return jwt.sign(
        {},
        getJwtSecret(),
        {
            algorithm: 'HS256',
            subject: String(usuario.id_user),
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            expiresIn: process.env.JWT_EXPIRES_IN || '1d',
        },
    );
}

export function verifyAccessToken(token) {
    return jwt.verify(token, getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
    });
}