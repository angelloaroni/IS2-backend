export default class AppError extends Error{
    constructor(mensaje, codigoHttp = 500){
        super(mensaje);
        this.codigoHttp = codigoHttp;
    }
}