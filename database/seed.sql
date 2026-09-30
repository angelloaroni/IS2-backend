-- ==========================================
-- 1. TABLAS INDEPENDIENTES
-- ==========================================

-- Inserción de Usuarios
INSERT INTO Usuario (cod_user, id_user, nombre, puntos, tipo, contraseña, estado) VALUES
(1001, 1, 'Carlos Pérez', 150.5, 'Estudiante', 'hashed_pass_123', TRUE),
(1002, 2, 'María Gómez', 320.0, 'Profesor', 'hashed_pass_456', TRUE),
(1003, 3, 'Juan Quispe', 45.0, 'Externo', 'hashed_pass_789', TRUE);

-- Inserción de Tachos Inteligentes
-- (Nota: capacidad como BOOL suele representar si está lleno o no, ej: FALSE = disponible/no lleno)
INSERT INTO TachoInteligente (id_tacho, lat, long, capacidad) VALUES
(1, -12.0464, -77.0428, FALSE),
(2, -12.0475, -77.0415, FALSE),
(3, -12.0500, -77.0450, TRUE);

-- Inserción de Logros
INSERT INTO Logros (id_logro, nombre, tipo_condicion, valor_objetivo) VALUES
(1, 'Reciclador Novato', 'cantidad_residuos', 5.0),
(2, 'Eco Amigo', 'puntos_acumulados', 100.0),
(3, 'Guardián del Planeta', 'peso_total_kg', 10.0);

-- Inserción de Premios
INSERT INTO Premio (id_premio, nombre, descripcion, costo, stock) VALUES
(1, 'Notebook Ecológica', 'Cuaderno hecho con material 100% reciclado', 50.0, 20),
(2, 'Laptop Bag / Mochila', 'Mochila resistente de lona reciclada', 200.0, 5),
(3, 'Sorbete de Acero', 'Kit de sorbetes reutilizables con cepillo', 30.0, 50);


-- ==========================================
-- 2. TABLAS CON DEPENDENCIAS DE 1ER NIVEL
-- ==========================================

-- Inserción de Residuos
INSERT INTO Residuo (id_residuo, nombre, peso, tipo, id_user, id_tacho) VALUES
(1, 'Botella de Plástico PET', 0.25, 'Plástico', 1, 1),
(2, 'Lata de Aluminio', 0.15, 'Metal', 1, 1),
(3, 'Revista de Papel', 0.50, 'Papel', 2, 2),
(4, 'Botella de Vidrio', 0.40, 'Vidrio', 3, 3);

-- Inserción de Logros de Usuario
INSERT INTO Logros_Usuario (fecha_obtencion, id_logro, id_user) VALUES
('2026-06-01', 1, 1),
('2026-06-05', 2, 1),
('2026-06-02', 1, 2),
('2026-06-10', 2, 2);

-- Inserción de Premios Canjeados por Usuario
INSERT INTO usuario_Premio (id_usuario_premio, fecha_obtencion, id_premio, id_user) VALUES
(1, '2026-06-06', 1, 1),
(2, '2026-06-08', 3, 2);


-- ==========================================
-- 3. TABLAS CON DEPENDENCIAS COMPLEJAS
-- ==========================================

-- Inserción de Historial de Reciclaje
INSERT INTO HistorialReciclaje (id_historial, fecha, id_user, id_tacho, id_residuo) VALUES
(1, '2026-06-01', 1, 1, 1),
(2, '2026-06-01', 1, 1, 2),
(3, '2026-06-02', 2, 2, 3),
(4, '2026-06-03', 3, 3, 4);