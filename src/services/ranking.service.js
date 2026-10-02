import eventos, {EVENTOS} from "../utils/eventos.js";

// solo  de referencia por ahora, es la funcion que se usa abajo
export async function actualizarRanking(idUser){

}


eventos.on(EVENTOS.RESIDUO_REGISTRADO, async (payload) => {
    try {
        await actualizarRanking(payload.idUser);
    } catch (error) {
        console.log('Error al momento de actualizar el ranking: ', error);
    }
});