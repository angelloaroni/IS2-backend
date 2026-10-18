
export const TARIFAS_PUNTOS_POR_KG = Object.freeze({
    plastico: 10,
    'papel/carton': 10,
    organicos: 10,
});

export const calcularPuntos = (peso, tipo) => {
    const pesoNumero = Number(peso);
    const tarifa = TARIFAS_PUNTOS_POR_KG[tipo];

    if (!Number.isFinite(pesoNumero) || pesoNumero <= 0) {
        throw new Error('El peso debe ser mayor a cero');
    }

    if (tarifa === undefined) {
        throw new Error('El tipo de residuo no es válido');
    }

    return pesoNumero * tarifa;
};