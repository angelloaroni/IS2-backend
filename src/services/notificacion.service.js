import eventos, {EVENTOS} from "../utils/eventos.js";

// solo  de referencia por ahora, es la funcion que se usa abajo
export async function notificarReciclaje(idUser){

}


eventos.on(EVENTOS.RESIDUO_REGISTRADO, async (payload) => {
    try {
        await notificarReciclaje(payload.idUser);
    } catch (error) {
        console.log('Error al momento de enviar una notificacion: ', error);
    }
});