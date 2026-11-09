import Producto from '../models/Producto.js';

class ProductoRepository {
    async buscarPorCodigo(codProducto) {
        const producto = await Producto.findOne({
            attributes: ['tipo', 'peso_gramos'],
            where: { cod_producto: codProducto },
        });

        if (!producto) {
            return { tipo: 'desconocido', peso: 0 };
        }

        return {
            tipo: producto.tipo,
            peso: producto.peso_gramos,
        };
    }
}

export default new ProductoRepository();
