import app from './src/app.js';
import { iniciarRecepcionMqtt } from './src/services/mqtt.service.js';

const PORT = process.env.PORT || 3000;
const clienteMqtt = iniciarRecepcionMqtt();
const servidor = app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

function cerrarServidor() {
  servidor.close();
  clienteMqtt.end(false, {}, () => process.exit(0));
}

process.once('SIGINT', cerrarServidor);
process.once('SIGTERM', cerrarServidor);