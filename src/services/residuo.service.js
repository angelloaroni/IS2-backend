import eventos, {EVENTOS} from "../utils/eventos.js";

//logica que iria al confirmar la trannsacion

//lo q iria despyes de eso seria esto
eventos.emit(EVENTOS.RESIDUO_REGISTRADO, {
  idUser,
  idResiduo,
  idTacho,
  puntosGanados,
  fecha,
});