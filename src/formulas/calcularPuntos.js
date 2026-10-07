

export const calcularPuntos = (peso) => {
    if (Number(peso) <= 0) {
        throw new Error('El peso debe ser mayor a cero');
    }
    return peso * 10;
}