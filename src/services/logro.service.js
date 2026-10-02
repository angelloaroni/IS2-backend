import eventos, {EVENTOS} from "../utils/eventos.js";

// solo  de referencia por ahora, es la funcion que se usa abajo
export async function evaluarLogros(idUser){

}


eventos.on(EVENTOS.RESIDUO_REGISTRADO, async (payload) => {
    try {
        await evaluarLogros(payload.idUser);
    } catch (error) {
        console.log('Error evaluando el logro, causa del error:', error);
    }
});