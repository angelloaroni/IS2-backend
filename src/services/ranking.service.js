import RankingRepository from '../repositories/ranking.repository.js';
import eventos, { EVENTOS } from '../utils/eventos.js';

const rankingRepository = new RankingRepository();
const LIMITE_TOP = 10;

export async function obtenerRanking(idUser) {
    const usuarios = await rankingRepository.listarUsuarios();
    const posicion = usuarios.findIndex((usuario) => Number(usuario.id_user) === Number(idUser));

    return {
        top: usuarios.slice(0, LIMITE_TOP).map((usuario, index) => ({
            ...usuario,
            posicion: index + 1,
        })),
        total_usuarios: usuarios.length,
        usuario: posicion === -1
            ? null
            : { ...usuarios[posicion], posicion: posicion + 1 },
    };
}

export async function actualizarRanking(idUser) {
    const ranking = await obtenerRanking(idUser);
    return ranking.usuario;
}

eventos.on(EVENTOS.RESIDUO_REGISTRADO, async ({ idUser }) => {
    try {
        await actualizarRanking(idUser);
    } catch (error) {
        console.error('Error actualizando la posición del usuario en el ranking:', error);
    }
});