import 'dotenv/config'; //si o si tiene que ir en la primera linea
import express from 'express';
import cors from 'cors';
import indexRoutes from './routes/index.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';
import AppError from './utils/AppError.js'; //prueba


const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  return res.json({ mensaje: 'API Tachin Verde', code: 200 });
});

app.use('/api', indexRoutes);

//prueba
app.get('/prueba-error', (req, res, next) => {
  next(new AppError('Esto es una prueba', 400));
});

app.get('/prueba-500', (req, res, next) => {
  next(new Error('Fallo inesperado'));
});
//

app.use(errorMiddleware);   // siempre al final

export default app;