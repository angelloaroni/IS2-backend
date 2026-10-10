//estrucutra q tendra cada uno de los errores siempre s ellama
//throw new AppError('mensaje', codigoHttp);

export default class AppError extends Error {
    constructor(mensaje, codigoHttp = 500) {
        super(mensaje);
        this.name = 'AppError';
        this.codigoHttp = codigoHttp;
        this.statusCode = codigoHttp;
    }
}