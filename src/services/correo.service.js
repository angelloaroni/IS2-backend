import nodemailer from 'nodemailer';
import AppError from '../utils/AppError.js';

function obtenerConfiguracionSMTP() {
    const host = process.env.SMTP_HOST?.trim();
    const usuario = process.env.SMTP_USER?.trim();
    const contraseña = process.env.SMTP_PASSWORD;
    const puerto = Number(process.env.SMTP_PORT || 587);
    const remitente = process.env.SMTP_FROM?.trim() || usuario;
    const secure = process.env.SMTP_SECURE || 'false';

    if (
        !host
        || !remitente
        || !Number.isInteger(puerto)
        || puerto < 1
        || puerto > 65535
        || !['true', 'false'].includes(secure)
    ) {
        throw new AppError('El servidor SMTP no está configurado correctamente', 503);
    }
    if (Boolean(usuario) !== Boolean(contraseña)) {
        throw new AppError('SMTP_USER y SMTP_PASSWORD deben configurarse juntos', 503);
    }

    return {
        host,
        port: puerto,
        secure: secure === 'true',
        auth: usuario ? { user: usuario, pass: contraseña } : undefined,
        from: remitente,
    };
}

export async function enviarCodigoVerificacion(correoInstitucional, codigo, proposito) {
    const configuracion = obtenerConfiguracionSMTP();
    const transportador = nodemailer.createTransport({
        host: configuracion.host,
        port: configuracion.port,
        secure: configuracion.secure,
        auth: configuracion.auth,
    });
    const accion =
        proposito === 'registro' ? 'verificar tu correo institucional' : 'recuperar tu cuenta';

    try {
        await transportador.sendMail({
            from: configuracion.from,
            to: correoInstitucional,
            subject: 'Código de verificación - Tachín Verde',
            text: `Tu código para ${accion} es ${codigo}. Expira en 3 minutos. Si no solicitaste este código, ignora este mensaje.`,
            html: `<p>Tu código para ${accion} es:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${codigo}</p><p>Expira en 3 minutos. Si no solicitaste este código, ignora este mensaje.</p>`,
        });
    } catch (error) {
        console.error('No se pudo enviar el correo de verificación:', error);
        throw new AppError(
            'No se pudo enviar el correo de verificación. Revisa la configuración SMTP.',
            502
        );
    } finally {
        transportador.close();
    }
}
