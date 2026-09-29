
async function obtenerInfo(idUsuario) {
  const [usuario, logros, metricas, historial, ranking, tachos] =
    await Promise.all([
      obtenerUsuario(idUsuario),
      obtenerLogros(idUsuario),
      obtenerMetricas(idUsuario),
      obtenerHistorial(idUsuario, { limite: 10 }),
      obtenerRanking(idUsuario),
      obtenerTachos(idUsuario),
    ]);

  return { usuario, logros, metricas, historial, ranking, tachos };
}

export default obtenerInfo;