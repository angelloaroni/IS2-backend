export function exito(res, data, codigo = 200){
    return res.status(codigo).json({ok: true, data, error: null});
}

export function fallo(res, mensaje, codigo = 500){
    return res.status(codigo).json({ok: false, data: null, mensaje});
}